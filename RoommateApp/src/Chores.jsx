// Chores.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";

/**
 * Chores page:
 * - Always shows a widget for every roommate in the same household (even if no chores exist).
 * - Resolves household_id from DB if the prop is missing/stale.
 * - Then loads chores + assignments (optional) and fills widgets where assigned.
 */
export default function Chores({ householdId }) {
  console.log("[Chores] render");
  const [roommates, setRoommates] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const safeHouseholdId = useMemo(() => householdId ?? null, [householdId]);

  useEffect(() => {
    console.log("[Chores] useEffect fired", { householdId });
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);

      // 1) Auth user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        setRoommates([]);
        setLoading(false);
        return;
      }

      // 2) Resolve household_id (use prop if provided, otherwise fetch from DB)
      let hid = safeHouseholdId;

      if (!hid) {
        const { data: myProfile, error: myProfileError } = await supabase
          .from("profiles")
          .select("household_id")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (myProfileError || !myProfile?.household_id) {
          // User is not in a household yet (or policy blocks it)
          setRoommates([
            {
              id: user.id,
              name: "You",
              chores: [],
            },
          ]);
          setLoading(false);
          return;
        }

        hid = myProfile.household_id;
      }

      // 3) Fetch all profiles in the same household (this requires the correct profiles SELECT RLS)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, household_id")
        .eq("household_id", hid)
        .order("display_name", { ascending: true });
      console.log("[Chores] profiles rows:", profiles, "error:", profilesError);
      if (cancelled) return;

      if (profilesError || !profiles) {
        // If this happens, your RLS is still blocking same-household reads.
        // Show at least the current user widget so the page isn't empty.
        setRoommates([
          {
            id: user.id,
            name: "You",
            chores: [],
          },
        ]);
        setLoading(false);
        return;
      }

      // 4) Build roommates list immediately so widgets show even with zero chores
      const baseRoommates = profiles.map((p) => ({
        id: p.id,
        name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
        chores: [],
      }));
      console.log("[Chores] roommates (base)", baseRoommates);
      setRoommates(baseRoommates);

      // 5) Load chores in this household (optional; widgets should exist even if this is empty)
      const { data: chores, error: choresError } = await supabase
        .from("chores")
        .select("id, name, due_date, description, household_id")
        .eq("household_id", hid);

      if (cancelled) return;

      if (choresError || !chores || chores.length === 0) {
        // No chores yet: keep roommate widgets with empty chores arrays
        setLoading(false);
        return;
      }

      const choreIds = chores.map((c) => c.id);

      // 6) Load assignments ONLY for chores in this household to avoid overfetch/RLS friction
      const { data: assignments, error: assignmentsError } = await supabase
        .from("chore_assignments")
        .select("chore_id, profile_id")
        .in("chore_id", choreIds);

      if (cancelled) return;

      const safeAssignments = assignmentsError || !assignments ? [] : assignments;

      // 7) Map profile_id -> display_name for peopleAssigned display
      const profileIdToName = new Map(
        profiles.map((p) => [p.id, p.display_name || "Unnamed"])
      );

      // 8) Build chores per roommate
      const updated = profiles.map((p) => ({
        id: p.id,
        name: p.id === user.id ? "You" : (p.display_name || "Unnamed"),
        chores: [],
      }));

      // Helper to find a roommate record quickly
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
          repeatDays: [], // keep as-is unless you implement repeat mask decoding
        };

        // If no one assigned, do nothing (widgets still render empty)
        if (assignedProfileIds.length === 0) continue;

        // Push to each assigned roommate widget
        for (const pid of assignedProfileIds) {
          const idx = idxByProfileId.get(pid);
          if (idx !== undefined) {
            updated[idx].chores.push(choreForUI);
          }
        }
      }

      setRoommates(updated);
      setLoading(false);
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [safeHouseholdId]);

  const handleBlockClick = (chore) => setSelectedChore(chore);
  const closePopup = () => setSelectedChore(null);

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);

  if (loading) return null;

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      <div className="widgets-container">
        {roommates.map((r) => (
          <ChoresWidget
            key={r.id}
            roommate={r}
            onBlockClick={handleBlockClick}
          />
        ))}
      </div>

      <button
        type="button"
        className="chores-fab"
        aria-label="Create chore"
        onClick={openCreate}
      >
        +
      </button>

      {selectedChore && (
        <ChoresPopup chore={selectedChore} onClose={closePopup} />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ name: r.name }))}
        onClose={closeCreate}
        onCreate={() => {
          // keep your existing creation flow here if you already have one
          // (after insert, you can reload by re-running loadData or use realtime)
        }}
      />
    </main>
  );
}
