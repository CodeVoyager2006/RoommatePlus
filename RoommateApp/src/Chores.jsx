import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";

export default function Chores() {
  const [roommates, setRoommates] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  /* =========================
     Load roommates + chores
     ========================= */
  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 1. Load profile (to get household_id)
      const { data: profile } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", user.id)
        .single();

      if (!profile?.household_id) return;

      // 2. Load all roommates
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("household_id", profile.household_id);

      // 3. Load chores
      const { data: chores } = await supabase
        .from("chores")
        .select("*")
        .eq("household_id", profile.household_id);

      // 4. Load assignments
      const { data: assignments } = await supabase
        .from("chore_assignments")
        .select("chore_id, profile_id");

      // 5. Build UI structure
      const roommateMap = profiles.map((p) => ({
        name: p.display_name,
        chores: [],
      }));

      chores.forEach((chore) => {
        const assignedProfiles = assignments
          .filter((a) => a.chore_id === chore.id)
          .map((a) =>
            profiles.find((p) => p.id === a.profile_id)?.display_name
          );

        const choreForUI = {
          id: chore.id,
          title: chore.name,
          dueDate: chore.due_date,
          description: chore.description,
          peopleAssigned: assignedProfiles,
          repeatDays: [], // TODO: decode repeat_mask later
        };

        roommateMap.forEach((r) => {
          if (assignedProfiles.includes(r.name)) {
            r.chores.push(choreForUI);
          }
        });
      });

      setRoommates(roommateMap);
      setLoading(false);
    };

    loadData();
  }, []);

  /* =========================
     Handlers
     ========================= */
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
            key={r.name}
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
        <ChoresPopup
          chore={selectedChore}
          onClose={closePopup}
        />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ name: r.name }))}
        onClose={closeCreate}
        onCreate={() => {
          /* creation logic handled later */
        }}
      />
    </main>
  );
}
