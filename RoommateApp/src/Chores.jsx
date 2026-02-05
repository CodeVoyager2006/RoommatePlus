import React, { useCallback, useEffect, useMemo, useState } from "react";
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
      name: p.display_name || "Unnamed",
      chores: [],
    }));
    setRoommates(baseRoommates);

    // Chores
    const { data: chores, error: choresError } = await supabase
    .from("chores")
    .select("id, name, due_date, description, household_id, status")
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
      profiles.map((p) => [p.id, p.display_name || "Unnamed"])
    );

    const updated = profiles.map((p) => ({
      id: p.id,
      name: p.display_name || "Unnamed",
      chores: [],
    }));
    const idxByProfileId = new Map(updated.map((r, idx) => [r.id, idx]));

    for (const chore of chores) {
      const assignedProfileIds = safeAssignments
        .filter((a) => a.chore_id === chore.id)
        .map((a) => a.profile_id);

      const assignedNames = assignedProfileIds
        .map((pid) => profileIdToName.get(pid))
        .filter(Boolean);

      const choreForUI = {
        id: chore.id,
        title: chore.name,
        dueDate: chore.due_date,
        description: chore.description,
        peopleAssigned: assignedNames,
        status: chore.status,
        assigneeIds: assignedProfileIds,
        repeatDays: []
      };

      for (const pid of assignedProfileIds) {
        const idx = idxByProfileId.get(pid);
        if (idx !== undefined) updated[idx].chores.push(choreForUI);
      }
    }

    setRoommates(updated);
    setLoading(false);
  }, [safeHouseholdId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ✅ THIS IS WHAT ChoresPopup NEEDS
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
        status: "completed",
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
  try {
    // ---- 0) Preconditions ----
    if (!resolvedHouseholdId) {
      console.error("[CreateChores] No resolvedHouseholdId; cannot create chore.", {
        resolvedHouseholdId,
      });
      return;
    }

    // ---- 1) Normalize inputs ----
    const name = (payload?.name ?? payload?.title ?? "").trim();
    const description = (payload?.description ?? "").trim() || null;
    const due_date = payload?.due_date ?? payload?.dueDate ?? null;

    if (!name) {
      console.error("[CreateChores] Missing chore name/title.", { payload });
      return;
    }

    // Accept multiple possible shapes from CreateChores:
    // - payload.assigneeIds: ["uuid", ...]
    // - payload.assignees / payload.assignedTo / payload.selectedRoommates: ["uuid", ...] OR [{id,...}, ...]
    const rawAssignees =
      payload?.assigneeIds ??
      payload?.assignees ??
      payload?.assignedTo ??
      payload?.selectedRoommates;

    if (!Array.isArray(rawAssignees)) {
      console.error(
        "[CreateChores] Assignees missing or not an array. Expected payload.assigneeIds/assignees/assignedTo/selectedRoommates to be an array.",
        { payload }
      );
      return;
    }

    const assignees = rawAssignees
      .map((a) => (typeof a === "object" && a !== null ? a.id : a))
      .filter(Boolean);

    if (assignees.length === 0) {
      console.error("[CreateChores] Assignees array is empty after normalization.", {
        rawAssignees,
        payload,
      });
      return;
    }

    // ---- 2) Snapshot current assignment count for this household (before) ----
    // Count chore_assignments linked to chores in this household
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

    // ---- 3) Insert chore ----
    const { data: newChore, error: choreErr } = await supabase
      .from("chores")
      .insert({
        household_id: resolvedHouseholdId,
        name,
        description,
        due_date,
        status: "ongoing",
      })
      .select("id")
      .single();

    if (choreErr) {
      console.error("[CreateChores] chore insert error:", choreErr);
      return;
    }

    // ---- 4) Insert assignments (required) ----
    const rows = assignees.map((profile_id) => ({
      chore_id: newChore.id,
      profile_id,
    }));

    const { error: assignErr } = await supabase.from("chore_assignments").insert(rows);

    if (assignErr) {
      console.error("[CreateChores] assignment insert error:", assignErr, { rows });
      return;
    }

    // ---- 5) Verify table size changed (after) ----
    // We check if assignments exist for this chore; and also compare counts when beforeCount was available.
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
      typeof afterCount === "number" &&
      afterCount > beforeCount;

    const hasRowsForChore = Array.isArray(verifyRows) && verifyRows.length > 0;

    if (sizeChanged || hasRowsForChore) {
      console.log("chores assignments is updated", {
        beforeCount,
        afterCount,
        insertedForChore: verifyRows?.length ?? null,
        chore_id: newChore.id,
      });
    } else {
      console.warn("[CreateChores] Expected chore_assignments to change but did not detect it.", {
        beforeCount,
        afterCount,
        verifyRows,
        chore_id: newChore.id,
      });
      // Treat as error condition per your requirement
      return;
    }

    // ---- 6) Close + refresh ----
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
