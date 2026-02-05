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
      name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
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
      name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
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

      {selectedChore && (
        <ChoresPopup chore={selectedChore} onClose={closePopup} onDelete={handleChoreAction} />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ id: r.id, name: r.name }))}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (payload) => {
          // insert chore + assignments here (same logic you used previously)
          // then: await loadData();
        }}
      />
    </main>
  );
}
