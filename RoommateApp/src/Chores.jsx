import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import { createThread, createMessage } from "./chatApi";
import "./assets/ChoresComponent.css";

export default function Chores({ householdId, refreshProfile }) {
  const [roommates, setRoommates] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const safeHouseholdId = useMemo(() => householdId ?? null, [householdId]);
  const [resolvedHouseholdId, setResolvedHouseholdId] = useState(null);

  // Tracks whether the overdue check has already run this mount so it only
  // fires once — not on every post-action loadData() call.
  const overdueChecked = useRef(false);

  // ── Core fetch ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRoommates([]);
      setResolvedHouseholdId(null);
      setLoading(false);
      return;
    }

    let hid = safeHouseholdId;

    if (!hid) {
      const { data: myProfile, error: myProfileError } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", user.id)
        .single();

      if (myProfileError || !myProfile?.household_id) {
        setRoommates([{ id: user.id, name: "You", chores: [] }]);
        setResolvedHouseholdId(null);
        setLoading(false);
        return;
      }
      hid = myProfile.household_id;
    }

    setResolvedHouseholdId(hid);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, household_id")
      .eq("household_id", hid)
      .order("display_name", { ascending: true });

    if (profilesError || !profiles) {
      setRoommates([{ id: user.id, name: "You", chores: [] }]);
      setLoading(false);
      return;
    }

    const { data: chores, error: choresError } = await supabase
      .from("chores")
      .select("id, name, due_date, description, household_id, status, repeat_mask, points, image_url")
      .eq("household_id", hid)
      .eq("status", "ongoing");

    if (choresError || !chores || chores.length === 0) {
      setRoommates(
        profiles.map((p) => ({
          id: p.id,
          name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
          chores: [],
        }))
      );
      setLoading(false);
      return;
    }

    const choreIds = chores.map((c) => c.id);

    const { data: assignments, error: assignmentsError } = await supabase
      .from("chore_assignments")
      .select("chore_id, profile_id")
      .in("chore_id", choreIds);

    const safeAssignments = assignmentsError || !assignments ? [] : assignments;

    const profileIdToName = new Map(
      profiles.map((p) => [p.id, p.id === user.id ? "You" : (p.display_name || "Unnamed")])
    );

    const updated = profiles.map((p) => ({
      id: p.id,
      name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
      chores: [],
    }));
    const idxByProfileId = new Map(updated.map((r, idx) => [r.id, idx]));

    const allChoresForUI = [];

    for (const chore of chores) {
      const assignedProfileIds = safeAssignments
        .filter((a) => a.chore_id === chore.id)
        .map((a) => a.profile_id);

      const assignedNames = assignedProfileIds
        .map((pid) => profileIdToName.get(pid))
        .filter(Boolean);

      const choreForUI = {
        id:            chore.id,
        title:         chore.name,
        dueDate:       chore.due_date,
        description:   chore.description,
        peopleAssigned: assignedNames,
        status:        chore.status,
        assigneeIds:   assignedProfileIds,
        repeatDays:    [],
        repeatBitmask: chore.repeat_mask ?? 0,
        points:        chore.points ?? null,
        imageUrl:      chore.image_url ?? null,
      };

      allChoresForUI.push(choreForUI);

      for (const pid of assignedProfileIds) {
        const idx = idxByProfileId.get(pid);
        if (idx !== undefined) updated[idx].chores.push(choreForUI);
      }
    }

    setRoommates(updated);
    setLoading(false);

    if (!overdueChecked.current) {
      overdueChecked.current = true;
      await runOverdueCheck(allChoresForUI);
    }
  }, [safeHouseholdId]);

  // ── runOverdueCheck ─────────────────────────────────────────────────────────
  // Auto-marks passed-due chores and creates a "Missed deadline" thread for each.
  async function runOverdueCheck(choresForUI) {
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const seen = new Set();
    const overdueChores = [];

    for (const chore of choresForUI) {
      if (seen.has(chore.id)) continue;
      seen.add(chore.id);

      if (!chore.dueDate) continue;

      const d = new Date(chore.dueDate);
      const dueUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

      if (dueUTC < todayUTC) overdueChores.push(chore);
    }

    if (overdueChores.length === 0) return;

    const overdueIds = overdueChores.map((c) => c.id);
    console.log(`[Chores] marking ${overdueIds.length} overdue chore(s) as passed:`, overdueIds);

    const { error } = await supabase
      .from("chores")
      .update({ status: "passed", drop_reason: "passed due date" })
      .in("id", overdueIds);

    if (error) {
      console.error("[Chores] overdue bulk update error:", error);
      return;
    }

    // Get current user to use as thread sender
    const { data: { user } } = await supabase.auth.getUser();
    const hid = resolvedHouseholdId ?? safeHouseholdId;

    if (user && hid) {
      for (const chore of overdueChores) {
        try {
          await createThread({
            householdId: hid,
            title: `Missed deadline for: ${chore.title}`,
            body: null,
            chore_id:chore.id,
            senderId: user.id,
          });
        } catch (e) {
          console.error("[Chores] failed to create missed-deadline thread:", e);
        }
      }
    }

    await loadData(true);
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── refreshProfileStats ─────────────────────────────────────────────────────
  const refreshProfileStats = async () => {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) return;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("points, streaks")
      .eq("id", user.id)
      .single();

    if (profileErr) return;

    refreshProfile?.();
  };

  // ── handleChoreAction ───────────────────────────────────────────────────────
  const handleChoreAction = async (chore, meta) => {
    if (!chore?.id) return;

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Could not resolve current user.");

    // Fetch the user's display_name for thread titles
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("display_name, points, streaks")
      .eq("id", user.id)
      .single();

    const actorName = actorProfile?.display_name || "Someone";
    const hid = resolvedHouseholdId ?? safeHouseholdId;

    // ── Abandon ────────────────────────────────────────────────────────────────
    if (meta?.mode === "abandon") {
      const reason = (meta?.reason || "").trim() || "N/A";

      // 1) Mark chore as passed
      const { data: choreData, error: choreErr } = await supabase
        .from("chores")
        .update({ status: "passed", drop_reason: reason })
        .eq("id", chore.id)
        .select("id, status, drop_reason")
        .single();

      console.log("[Chores] abandon result:", { data: choreData, error: choreErr });
      if (choreErr) throw choreErr;

      // 2) Deduct points + reset streak
      if (actorProfile) {
        const chorePoints   = typeof chore.points === "number" ? chore.points : 0;
        const currentPoints = typeof actorProfile.points === "number" ? actorProfile.points : 0;

        const { error: profileUpdateErr } = await supabase
          .from("profiles")
          .update({
            points:  Math.max(0, currentPoints - chorePoints),
            streaks: 0,
          })
          .eq("id", user.id);

        if (profileUpdateErr) {
          console.error("[Chores] abandon — profile update error:", profileUpdateErr);
        }
      }

      // 3) Create a thread for this abandon action
      if (hid) {
        try {
          const threadTitle = `${actorName} abandons the chore: ${chore.title}`;
          // Only post the reason as a first message if the user provided one
          // (not "N/A", which is our default when no reason was given)
          const hasRealReason = meta?.reason?.trim();

          await createThread({
            householdId: hid,
            title: threadTitle,
            chore_id:chore.id,
            body: hasRealReason ? hasRealReason : null,
            senderId: user.id,
          });
        } catch (e) {
          console.error("[Chores] failed to create abandon thread:", e);
        }
      }

      setSelectedChore(null);
      await loadData();
      await refreshProfileStats();
      return;
    }

    // ── Finish ─────────────────────────────────────────────────────────────────
    if (meta?.mode === "finish") {
      const now = new Date();

      // 1a) Upload proof-of-finish image to Storage (if the user attached one).
      //     ChoresPopup passes the raw File object as meta.imageFile.
      //     Bucket : proves_of_finish
      //     Path   : proof/{choreId}/{timestamp}.{ext}
      //       - segment 1 "proof"   matched by RLS: split_part(name,'/',1) = 'proof'
      //       - segment 2 {choreId} cast to ::uuid: split_part(name,'/',2)::uuid
      //       - segment 3 filename  not checked by RLS
      let uploadedImageUrl = null;

      if (meta?.imageFile instanceof File) {
        try {
          const file        = meta.imageFile;
          const ext         = file.name.split(".").pop() || "jpg";
          const storagePath = `proof/${chore.id}/${now.getTime()}.${ext}`;

          console.log("[Chores] uploading proof image ->", storagePath);

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("proves_of_finish")
            .upload(storagePath, file, { upsert: true, contentType: file.type });

          if (uploadErr) {
            console.error("[Chores] proof image upload error:", {
              message:    uploadErr.message,
              statusCode: uploadErr.statusCode,
              error:      uploadErr.error,
              storagePath,
              choreId:    chore.id,
            });
          } else {
            console.log("[Chores] upload succeeded:", uploadData);
            const { data: urlData } = supabase.storage
              .from("proves_of_finish")
              .getPublicUrl(storagePath);

            uploadedImageUrl = urlData?.publicUrl ?? null;
            console.log("[Chores] proof image public URL:", uploadedImageUrl);
          }
        } catch (e) {
          console.error("[Chores] proof image upload exception:", e);
        }
      }

      // 1b) Mark chore as completed and persist the proof image URL.
      //     Prefer the freshly uploaded URL; fall back to any pre-existing imageUrl.
      const finishPayload = {
        status:       "completed",
        completed_at: now.toISOString(),
      };
      const resolvedImageUrl = uploadedImageUrl ?? chore.imageUrl ?? null;
      if (resolvedImageUrl) finishPayload.image_url = resolvedImageUrl;

      const { data: choreData, error: choreErr } = await supabase
        .from("chores")
        .update(finishPayload)
        .eq("id", chore.id)
        .select("id, status, completed_at, image_url")
        .single();

      console.log("[Chores] finish result:", { data: choreData, error: choreErr });
      if (choreErr) throw choreErr;

      // 2) Update points + streak
      if (actorProfile) {
        const chorePoints   = typeof chore.points === "number" ? chore.points : 0;
        const currentPoints = typeof actorProfile.points === "number" ? actorProfile.points : 0;
        const currentStreak = typeof actorProfile.streaks === "number" ? actorProfile.streaks : 0;

        let newStreak = currentStreak;

        if (actorProfile.prev_streak_day) {
          const prev = new Date(actorProfile.prev_streak_day);
          const prevMidnight = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
          const nowMidnight  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
          const diffDays = Math.round(
            (nowMidnight.getTime() - prevMidnight.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 1)      newStreak = currentStreak + 1;
          else if (diffDays === 0) newStreak = currentStreak;
          else                     newStreak = 1;
        } else {
          newStreak = 1;
        }

        const { error: profileUpdateErr } = await supabase
          .from("profiles")
          .update({
            last_finished:   now.toISOString(),
            prev_streak_day: now.toISOString(),
            points:          currentPoints + chorePoints,
            streaks:         newStreak,
          })
          .eq("id", user.id);

        if (profileUpdateErr) {
          console.error("[Chores] finish — profile update error:", profileUpdateErr);
        }
      }

      // 3) Create a thread for this finish action
      if (hid) {
        try {
          await createThread({
            householdId: hid,
            title: `${actorName} marks as finish for chore: ${chore.title}`,
            body: null,
            chore_id:chore.id,
            senderId: user.id,
          });
        } catch (e) {
          console.error("[Chores] failed to create finish thread:", e);
        }
      }

      setSelectedChore(null);
      await loadData();
      await refreshProfileStats();
    }
  };

  const handleBlockClick = (chore) => setSelectedChore(chore);
  const closePopup = () => setSelectedChore(null);

  if (loading) return null;

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      <div className="widgets-container">
        {roommates.map((r) => (
          <ChoresWidget key={r.id} roommate={r} onBlockClick={handleBlockClick} />
        ))}
      </div>

      <button
        type="button"
        className="chores-fab"
        onClick={() => setIsCreateOpen(true)}
      >
        +
      </button>

      {selectedChore && (
        <ChoresPopup chore={selectedChore} onClose={closePopup} onDelete={handleChoreAction} />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ id: r.id, name: r.name }))}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (payload) => {
          try {
            if (!resolvedHouseholdId) {
              console.error("[CreateChores] No resolvedHouseholdId; cannot create chore.", {
                resolvedHouseholdId,
              });
              return;
            }

            const name        = (payload?.name ?? payload?.title ?? "").trim();
            const description = (payload?.description ?? "").trim() || null;
            const due_date    = payload?.due_date ?? payload?.dueDate ?? null;

            if (!name) {
              console.error("[CreateChores] Missing chore name/title.", { payload });
              return;
            }

            const rawAssignees = payload.peopleAssigned;

            if (!Array.isArray(rawAssignees) || rawAssignees.length === 0) {
              console.error("[CreateChores] No assignees were added", { payload });
              return;
            }

            const {
              data: { user: currentUser },
              error: currentUserErr,
            } = await supabase.auth.getUser();

            if (currentUserErr || !currentUser) {
              console.error("[CreateChores] Could not get current user.", currentUserErr);
              return;
            }

            const otherNames = rawAssignees.filter((n) => n !== "You");

            let profileRows = [];
            if (otherNames.length > 0) {
              const { data: foundProfiles, error: profileLookupErr } = await supabase
                .from("profiles")
                .select("id, display_name")
                .eq("household_id", resolvedHouseholdId)
                .in("display_name", otherNames);

              if (profileLookupErr) {
                console.error("[CreateChores] profiles lookup error:", profileLookupErr);
                return;
              }

              profileRows = foundProfiles ?? [];
            }

            const nameToId = new Map(profileRows.map((p) => [p.display_name, p.id]));

            const assignees = rawAssignees
              .map((n) => (n === "You" ? currentUser.id : nameToId.get(n)))
              .filter(Boolean);

            if (assignees.length === 0) {
              console.error(
                "[CreateChores] Assignees array is empty after normalization.",
                { rawAssignees, profileRows }
              );
              return;
            }

            const repeat_mask =
              typeof payload?.repeatBitmask === "number" ? payload.repeatBitmask : 0;

            const points =
              typeof payload?.points === "number" ? payload.points : null;

            const { count: beforeCount, error: beforeErr } = await supabase
              .from("chore_assignments")
              .select("chore_id", { count: "exact", head: true })
              .in(
                "chore_id",
                (
                  await supabase
                    .from("chores")
                    .select("id")
                    .eq("household_id", resolvedHouseholdId)
                ).data?.map((c) => c.id) ?? []
              );

            if (beforeErr) {
              console.warn("[CreateChores] Could not compute beforeCount.", beforeErr);
            }

            const { data: newChore, error: choreErr } = await supabase
              .from("chores")
              .insert({
                household_id: resolvedHouseholdId,
                name,
                description,
                due_date,
                status:      "ongoing",
                repeat_mask,
                points: points ? points : 1,
              })
              .select("id")
              .single();

            if (choreErr) {
              console.error("[CreateChores] chore insert error:", choreErr);
              return;
            }

            const rows = assignees.map((profile_id) => ({
              chore_id:   newChore.id,
              profile_id,
            }));

            const { error: assignErr } = await supabase
              .from("chore_assignments")
              .insert(rows);

            if (assignErr) {
              console.error("[CreateChores] assignment insert error:", assignErr, { rows });
              return;
            }

            const { count: afterCount, error: afterErr } = await supabase
              .from("chore_assignments")
              .select("chore_id", { count: "exact", head: true })
              .in(
                "chore_id",
                (
                  await supabase
                    .from("chores")
                    .select("id")
                    .eq("household_id", resolvedHouseholdId)
                ).data?.map((c) => c.id) ?? []
              );

            if (afterErr) {
              console.warn("[CreateChores] Could not compute afterCount.", afterErr);
            }

            const { data: verifyRows, error: verifyErr } = await supabase
              .from("chore_assignments")
              .select("chore_id, profile_id")
              .eq("chore_id", newChore.id);

            if (verifyErr) {
              console.warn("[CreateChores] Could not verify chore_assignments rows.", verifyErr);
            }

            const sizeChanged =
              typeof beforeCount === "number" &&
              typeof afterCount  === "number" &&
              afterCount > beforeCount;

            const hasRowsForChore = Array.isArray(verifyRows) && verifyRows.length > 0;

            if (sizeChanged || hasRowsForChore) {
              console.log("chores assignments is updated", {
                beforeCount, afterCount,
                insertedForChore: verifyRows?.length ?? null,
                chore_id: newChore.id,
                repeat_mask, points,
              });
            } else {
              console.warn("[CreateChores] chore_assignments did not change as expected.", {
                beforeCount, afterCount, verifyRows, chore_id: newChore.id,
              });
              return;
            }

            setIsCreateOpen(false);
            await loadData();

          } catch (e) {
            console.error("[CreateChores] onCreate fatal error:", e, { payload });
          }
        }}
      />
    </main>
  );
}