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

    // Fetch both 'ongoing' AND 'passed' chores that have a repeat_mask set.
    // We need passed-but-recurring chores so we can revive them when today
    // matches one of their repeat days.
    const { data: chores, error: choresError } = await supabase
      .from("chores")
      .select("id, name, due_date, description, household_id, status, repeat_mask, points, image_url")
      .eq("household_id", hid)
      .or("status.eq.ongoing,and(status.eq.passed,repeat_mask.gt.0)");

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

    // ── Recurrence revival & forward-projection logic ───────────────────────
    // repeat_mask bit layout: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64
    // (bit N = 1 << dayOfWeek, where 0=Sun … 6=Sat)
    //
    // All date arithmetic uses the user's LOCAL timezone so chores flip at
    // their wall-clock midnight, never at UTC midnight.
    const userTz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayISO   = new Date().toLocaleDateString("en-CA", { timeZone: userTz }); // "YYYY-MM-DD"
    const todayLocal = new Date(todayISO); // local midnight — safe numeric anchor
    const todayDow   = todayLocal.getUTCDay(); // 0=Sun … 6=Sat in LOCAL date
    const todayDowBit = 1 << todayDow;

    /**
     * nextRecurringDate(mask, fromISO)
     *
     * Given a repeat bitmask and a "YYYY-MM-DD" anchor, returns the nearest
     * future (or current) "YYYY-MM-DD" that aligns with one of the set bits.
     *
     * Algorithm (no external libraries):
     *   For each of the 7 days starting from today (offset 0 … 6), check
     *   whether (todayDow + offset) % 7 is set in the mask.  The first hit
     *   is the answer.  Offset 0 = "today is a repeat day → due today".
     *   Offset 1–6 = "next occurrence is N days away".
     *
     *   This is equivalent to the modulo hint: (targetDow + 7 - todayDow) % 7
     *   applied across all set bits, then taking the minimum.
     */
    function nextRecurringDate(mask) {
      for (let offset = 0; offset < 7; offset++) {
        const candidateDow = (todayDow + offset) % 7;
        if (mask & (1 << candidateDow)) {
          if (offset === 0) return todayISO;
          const d = new Date(todayLocal);
          d.setUTCDate(d.getUTCDate() + offset);
          return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
        }
      }
      return todayISO; // fallback (mask=0 should never reach here)
    }

    // Chores that need their status flipped to 'ongoing' (were 'passed')
    const choreIdsToRevive = [];
    // Chores already 'ongoing' but whose due_date is stale (past) → project forward
    const dateUpdates = []; // [{ id, due_date }]

    for (const chore of chores) {
      if (!chore.repeat_mask || chore.repeat_mask === 0) continue;

      const nextISO = nextRecurringDate(chore.repeat_mask);

      if (chore.status === "passed") {
        // Guard: already revived this cycle
        if (chore.due_date === nextISO) continue;
        choreIdsToRevive.push(chore.id);
        // Store the computed next date so we can patch in-memory below
        chore._nextISO = nextISO;

      } else if (chore.status === "ongoing") {
        // due_date is stale (in the past) but chore is still active
        if (!chore.due_date || chore.due_date >= todayISO) continue;
        dateUpdates.push({ id: chore.id, due_date: nextISO });
        chore._nextISO = nextISO;
      }
    }

    // ── Persist & patch: revived (passed → ongoing) chores ───────────────────
    if (choreIdsToRevive.length > 0) {
      console.log(`[Chores] reviving ${choreIdsToRevive.length} recurring chore(s):`, choreIdsToRevive);

      // Build per-chore payloads so each gets its own correct next date.
      // Supabase doesn't support per-row values in a bulk update, so we batch
      // individual updates in parallel (one promise per unique target date).
      const byDate = new Map();
      for (const chore of chores) {
        if (!choreIdsToRevive.includes(chore.id)) continue;
        const iso = chore._nextISO ?? todayISO;
        if (!byDate.has(iso)) byDate.set(iso, []);
        byDate.get(iso).push(chore.id);
      }

      const reviveResults = await Promise.all(
        [...byDate.entries()].map(([iso, ids]) =>
          supabase
            .from("chores")
            .update({ status: "ongoing", due_date: iso, drop_reason: "N/A" })
            .in("id", ids)
        )
      );

      const reviveErr = reviveResults.find((r) => r.error)?.error;
      if (reviveErr) {
        console.error("[Chores] recurrence revival error:", reviveErr);
      } else {
        for (const chore of chores) {
          if (choreIdsToRevive.includes(chore.id)) {
            chore.status   = "ongoing";
            chore.due_date = chore._nextISO ?? todayISO;
          }
        }
      }
    }

    // ── Persist & patch: ongoing chores with a stale due_date ────────────────
    if (dateUpdates.length > 0) {
      console.log(`[Chores] forward-projecting ${dateUpdates.length} stale due_date(s):`, dateUpdates);

      const byDate = new Map();
      for (const { id, due_date } of dateUpdates) {
        if (!byDate.has(due_date)) byDate.set(due_date, []);
        byDate.get(due_date).push(id);
      }

      const updateResults = await Promise.all(
        [...byDate.entries()].map(([iso, ids]) =>
          supabase.from("chores").update({ due_date: iso }).in("id", ids)
        )
      );

      const updateErr = updateResults.find((r) => r.error)?.error;
      if (updateErr) {
        console.error("[Chores] stale due_date update error:", updateErr);
      } else {
        for (const chore of chores) {
          const upd = dateUpdates.find((u) => u.id === chore.id);
          if (upd) chore.due_date = upd.due_date;
        }
      }
    }

    // Only surface 'ongoing' chores to the UI (revived ones are now ongoing)
    const ongoingChores = chores.filter((c) => c.status === "ongoing");
    const choreIds = ongoingChores.map((c) => c.id);

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

    for (const chore of ongoingChores) {
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
    // Resolve the user's local timezone from the browser — same source of truth
    // used by the recurrence revival block in loadData().
    const userTz      = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayISO    = new Date().toLocaleDateString("en-CA", { timeZone: userTz }); // "YYYY-MM-DD"
    const todayLocal  = new Date(todayISO); // midnight of local today (numeric anchor)
    const todayDowBit = 1 << todayLocal.getUTCDay(); // day-of-week bit derived from the LOCAL date

    const seen = new Set();
    const overdueChores = [];

    for (const chore of choresForUI) {
      if (seen.has(chore.id)) continue;
      seen.add(chore.id);

      if (!chore.dueDate) continue;

      // Parse the stored "YYYY-MM-DD" as a midnight date so the numeric
      // comparison is apples-to-apples with todayLocal.
      const dueLocal = new Date(chore.dueDate);

      // Skip chores that recur today — they were just revived by the recurrence logic
      const repeatsToday = chore.repeatBitmask && (chore.repeatBitmask & todayDowBit) !== 0;
      if (dueLocal < todayLocal && !repeatsToday) overdueChores.push(chore);
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