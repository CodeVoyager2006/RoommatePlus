import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";

export default function Chores({ householdId }) {
  const [roommates, setRoommates] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const safeHouseholdId = useMemo(() => householdId ?? null, [householdId]);
  const [resolvedHouseholdId, setResolvedHouseholdId] = useState(null);

  // ── Overdue check ────────────────────────────────────────────────────────────
  // Tracks whether we've already run the overdue check this session so it
  // only fires once on mount, not on every subsequent loadData() call
  // (e.g. after creating a chore or finishing one).
  const overdueChecked = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);

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

    // Base roommates
    const baseRoommates = profiles.map((p) => ({
      id: p.id,
      name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
      chores: [],
    }));
    setRoommates(baseRoommates);

    // Chores — include repeat_mask and points so they round-trip back to the UI
    const { data: chores, error: choresError } = await supabase
      .from("chores")
      .select("id, name, due_date, description, household_id, status, repeat_mask, points")
      .eq("household_id", hid)
      .eq("status", "ongoing");

    if (choresError || !chores || chores.length === 0) {
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

    // Collect chores as UI objects first — overdue check runs after
    const allChoresForUI = [];

    for (const chore of chores) {
      const assignedProfileIds = safeAssignments
        .filter((a) => a.chore_id === chore.id)
        .map((a) => a.profile_id);

      const assignedNames = assignedProfileIds
        .map((pid) => profileIdToName.get(pid))
        .filter(Boolean);

      const choreForUI = {
        id:             chore.id,
        title:          chore.name,
        dueDate:        chore.due_date,
        description:    chore.description,
        peopleAssigned: assignedNames,
        status:         chore.status,
        assigneeIds:    assignedProfileIds,
        repeatDays:     [],
        repeatBitmask:  chore.repeat_mask ?? 0,
        points:         chore.points ?? null,
      };

      allChoresForUI.push(choreForUI);

      for (const pid of assignedProfileIds) {
        const idx = idxByProfileId.get(pid);
        if (idx !== undefined) updated[idx].chores.push(choreForUI);
      }
    }

    setRoommates(updated);
    setLoading(false);

    // ── Overdue check (runs once per mount) ─────────────────────────────────
    // Only execute on the very first loadData() call so tab switches and
    // post-action refreshes don't trigger it again.
    if (!overdueChecked.current) {
      overdueChecked.current = true;
      await markOverdueChores(allChoresForUI);
    }
  }, [safeHouseholdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── markOverdueChores ───────────────────────────────────────────────────────
  // Steps:
  //   1. Capture the current timestamp once.
  //   2. Walk each unique ongoing chore.
  //   3. If due_date < today (i.e. the chore is PAST its due date), update it
  //      to status "passed" with drop_reason "passed due date".
  //   4. Re-fetch so the UI reflects the updated list.
  const markOverdueChores = useCallback(async (choresForUI) => {
    // Step 1 — current timestamp (start of today, so a chore due today is not yet overdue)
    const now = new Date();
    // Normalise to midnight so "due today" is still considered ongoing
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Deduplicate by id (each chore may appear under multiple roommates)
    const seen = new Set();
    const unique = choresForUI.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    const overdueIds = [];

    for (const chore of unique) {
      if (!chore.dueDate) continue; // no due date → skip

      const due = new Date(chore.dueDate);
      // due_date from Supabase is a date string "YYYY-MM-DD"; parsing it gives
      // midnight UTC, so compare against UTC midnight of today to be consistent.
      const dueUTC  = new Date(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
      const todayUTC = new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

      // Step 3 — overdue when the due date is strictly before today
      if (dueUTC < todayUTC) {
        overdueIds.push(chore.id);
      }
    }

    if (overdueIds.length === 0) return;

    console.log(`[Chores] marking ${overdueIds.length} overdue chore(s) as passed:`, overdueIds);

    // Step 3 — bulk update in one DB call rather than one per chore
    const { error } = await supabase
      .from("chores")
      .update({ status: "passed", drop_reason: "passed due date" })
      .in("id", overdueIds);

    if (error) {
      console.error("[Chores] overdue bulk update error:", error);
      return;
    }

    // Step 4 — refresh so overdue chores disappear from the UI
    await loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Abandon / finish ─────────────────────────────────────────────────────────
  const handleChoreAction = async (chore, meta) => {
    if (!chore?.id) return;

    if (meta?.mode === "abandon") {
      const reason = (meta?.reason || "").trim() || "N/A";

      const { data, error } = await supabase
        .from("chores")
        .update({ status: "passed", drop_reason: reason })
        .eq("id", chore.id)
        .select("id,status,drop_reason")
        .single();

      console.log("[Chores] abandon result:", { data, error });
      if (error) throw error;

      setSelectedChore(null);
      await loadData();
      return;
    }

    if (meta?.mode === "finish") {
      const updates = {
        status:       "completed",
        completed_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("chores")
        .update(updates)
        .eq("id", chore.id)
        .select("id,status,completed_at")
        .single();

      console.log("[Chores] finish result:", { data, error });
      if (error) throw error;

      setSelectedChore(null);
      await loadData();
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
          console.log(payload);
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

            console.log("[CreateChores] resolved assignees:", { rawAssignees, assignees });

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
              console.warn("[CreateChores] Could not compute beforeCount for chore_assignments.", beforeErr);
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
                points,
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

            // ---- 7) Verify table size changed (after) ----------------------------
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
              console.warn("[CreateChores] Could not compute afterCount for chore_assignments.", afterErr);
            }

            const { data: verifyRows, error: verifyErr } = await supabase
              .from("chore_assignments")
              .select("chore_id, profile_id")
              .eq("chore_id", newChore.id);

            if (verifyErr) {
              console.warn("[CreateChores] Could not verify inserted chore_assignments rows.", verifyErr);
            }

            const sizeChanged =
              typeof beforeCount === "number" &&
              typeof afterCount  === "number" &&
              afterCount > beforeCount;

            const hasRowsForChore = Array.isArray(verifyRows) && verifyRows.length > 0;

            if (sizeChanged || hasRowsForChore) {
              console.log("chores assignments is updated", {
                beforeCount,
                afterCount,
                insertedForChore: verifyRows?.length ?? null,
                chore_id:         newChore.id,
                repeat_mask,
                points,
              });
            } else {
              console.warn("[CreateChores] Expected chore_assignments to change but did not detect it.", {
                beforeCount,
                afterCount,
                verifyRows,
                chore_id: newChore.id,
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