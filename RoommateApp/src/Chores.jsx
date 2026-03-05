import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
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
  // `silent` — when true, skips setLoading(true) so the UI doesn't flash blank.
  //            Used by the overdue check's second fetch.
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

    // Resolve household
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

    // Profiles
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

    // Chores
    const { data: chores, error: choresError } = await supabase
      .from("chores")
      .select("id, name, due_date, description, household_id, status, repeat_mask, points")
      .eq("household_id", hid)
      .eq("status", "ongoing");

    if (choresError || !chores || chores.length === 0) {
      // Still paint the empty roommate list
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

    // Assignments
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

    // Build UI objects and collect them for the overdue check
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
      };

      allChoresForUI.push(choreForUI);

      for (const pid of assignedProfileIds) {
        const idx = idxByProfileId.get(pid);
        if (idx !== undefined) updated[idx].chores.push(choreForUI);
      }
    }

    setRoommates(updated);
    setLoading(false);

    // ── Overdue check — runs once per mount only ──────────────────────────
    if (!overdueChecked.current) {
      overdueChecked.current = true;
      // Run inline here (not via a separate useCallback) to avoid the
      // circular dependency: markOverdueChores → loadData → markOverdueChores
      await runOverdueCheck(allChoresForUI);
    }
  }, [safeHouseholdId]); // only re-create when household changes

  // ── runOverdueCheck ─────────────────────────────────────────────────────────
  // Defined as a plain async function inside the component so it closes over
  // `loadData` without creating a useCallback circular dependency.
  // Called only from within loadData, so it's always in scope.
  async function runOverdueCheck(choresForUI) {
    // Today at UTC midnight — chores due today are still "ongoing"
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // Deduplicate (same chore can appear under multiple roommates)
    const seen = new Set();
    const overdueIds = [];

    for (const chore of choresForUI) {
      if (seen.has(chore.id)) continue;
      seen.add(chore.id);

      if (!chore.dueDate) continue;

      const d = new Date(chore.dueDate);
      const dueUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

      // Strictly before today → overdue
      if (dueUTC < todayUTC) overdueIds.push(chore.id);
    }

    if (overdueIds.length === 0) return;

    console.log(`[Chores] marking ${overdueIds.length} overdue chore(s) as passed:`, overdueIds);

    const { error } = await supabase
      .from("chores")
      .update({ status: "passed", drop_reason: "passed due date" })
      .in("id", overdueIds);

    if (error) {
      console.error("[Chores] overdue bulk update error:", error);
      return;
    }

    // Silent refresh — don't show the loading spinner for this background update
    await loadData(true);
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── refreshProfileStats ─────────────────────────────────────────────────────
  // Fetches the latest points + streaks for the current user from Supabase
  // and calls the refreshProfile callback so App.jsx re-renders the Header
  // with up-to-date values.  Safe to call after any chore action.
  const refreshProfileStats = async () => {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.warn("[Chores] refreshProfileStats — could not get user:", userErr);
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("points, streaks")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      console.warn("[Chores] refreshProfileStats — profile fetch error:", profileErr);
      return;
    }

    console.log("[Chores] refreshProfileStats →", { points: profile.points, streaks: profile.streaks });

    // Propagate the fresh values up to App.jsx so Header re-renders
    refreshProfile?.();
  };

  // ── Abandon / finish ─────────────────────────────────────────────────────────
  const handleChoreAction = async (chore, meta) => {
    if (!chore?.id) return;

    // Get the current user once — needed by both branches for profile updates
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Could not resolve current user.");

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

      // 2) Fetch current profile so we can safely decrement points
      const { data: profile, error: profileFetchErr } = await supabase
        .from("profiles")
        .select("points, streaks")
        .eq("id", user.id)
        .single();

      if (profileFetchErr) {
        console.error("[Chores] abandon — could not fetch profile:", profileFetchErr);
      } else {
        const chorePoints  = typeof chore.points === "number" ? chore.points : 0;
        const currentPoints = typeof profile.points  === "number" ? profile.points  : 0;

        const { error: profileUpdateErr } = await supabase
          .from("profiles")
          .update({
            // Deduct points (floor at 0 so it never goes negative)
            points:  Math.max(0, currentPoints - chorePoints),
            // Reset streak to 0 on abandon
            streaks: 0,
          })
          .eq("id", user.id);

        if (profileUpdateErr) {
          console.error("[Chores] abandon — profile update error:", profileUpdateErr);
        } else {
          console.log("[Chores] abandon — profile updated:", {
            pointsDeducted: chorePoints,
            newPoints: Math.max(0, currentPoints - chorePoints),
            streaksReset: true,
          });
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

      // 1) Mark chore as completed
      const { data: choreData, error: choreErr } = await supabase
        .from("chores")
        .update({ status: "completed", completed_at: now.toISOString() })
        .eq("id", chore.id)
        .select("id, status, completed_at")
        .single();

      console.log("[Chores] finish result:", { data: choreData, error: choreErr });
      if (choreErr) throw choreErr;

      // 2) Fetch current profile fields needed for streak + points logic
      const { data: profile, error: profileFetchErr } = await supabase
        .from("profiles")
        .select("points, streaks, prev_streak_day")
        .eq("id", user.id)
        .single();

      if (profileFetchErr) {
        console.error("[Chores] finish — could not fetch profile:", profileFetchErr);
      } else {
        const chorePoints   = typeof chore.points === "number" ? chore.points : 0;
        const currentPoints = typeof profile.points  === "number" ? profile.points  : 0;
        const currentStreak = typeof profile.streaks === "number" ? profile.streaks : 0;

        // ── Streak logic ──────────────────────────────────────────────────────
        // Increment streak by 1 if and only if today is exactly 1 calendar day
        // after prev_streak_day (consecutive days rule).
        let newStreak = currentStreak;

        if (profile.prev_streak_day) {
          const prev = new Date(profile.prev_streak_day);
          // Normalise both dates to local midnight for a clean day-diff
          const prevMidnight = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate());
          const nowMidnight  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
          const diffDays = Math.round(
            (nowMidnight.getTime() - prevMidnight.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 1) {
            // Completed exactly the next calendar day → extend streak
            newStreak = currentStreak + 1;
          } else if (diffDays === 0) {
            // Same day — streak stays as-is (already incremented today)
            newStreak = currentStreak;
          } else {
            // Missed one or more days → streak resets to 1 (this completion starts a new one)
            newStreak = 1;
          }
        } else {
          // No previous streak day on record — this is the first ever completion
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
        } else {
          console.log("[Chores] finish — profile updated:", {
            pointsAdded: chorePoints,
            newPoints:   currentPoints + chorePoints,
            newStreak,
          });
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
            // ---- 0) Preconditions ----
            if (!resolvedHouseholdId) {
              console.error("[CreateChores] No resolvedHouseholdId; cannot create chore.", {
                resolvedHouseholdId,
              });
              return;
            }

            // ---- 1) Normalize scalar inputs ----
            const name        = (payload?.name ?? payload?.title ?? "").trim();
            const description = (payload?.description ?? "").trim() || null;
            const due_date    = payload?.due_date ?? payload?.dueDate ?? null;

            if (!name) {
              console.error("[CreateChores] Missing chore name/title.", { payload });
              return;
            }

            // ---- 2) Resolve assignees → UUIDs via profiles table -----------------
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

            // ---- 3) Extract repeat_mask and points ------------------------------
            const repeat_mask =
              typeof payload?.repeatBitmask === "number" ? payload.repeatBitmask : 0;

            const points =
              typeof payload?.points === "number" ? payload.points : null;

            // ---- 4) Snapshot assignment count (before) ---------------------------
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

            // ---- 5) Insert chore ------------------------------------------------
            const { data: newChore, error: choreErr } = await supabase
              .from("chores")
              .insert({
                household_id: resolvedHouseholdId,
                name,
                description,
                due_date,
                status:      "ongoing",
                repeat_mask,
                points: points?points:1,
              })
              .select("id")
              .single();

            if (choreErr) {
              console.error("[CreateChores] chore insert error:", choreErr);
              return;
            }

            // ---- 6) Insert chore_assignments ------------------------------------
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

            // ---- 7) Verify -------------------------------------------------------
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

            // ---- 8) Close + refresh ---------------------------------------------
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