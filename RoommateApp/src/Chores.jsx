import React, { useState } from "react";
import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";

const genId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ch_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export default function Chores() {
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // NOTE: added id to each initial chore
  const [roommates, setRoommates] = useState([
    {
      name: "You",
      chores: [
        {
          id: genId(),
          title: "Wash Dishes",
          dueDate: "2025-06-30",
          description: "Clean all dishes after dinner",
          peopleAssigned: ["You", "Alice"],
          repeatDays: ["Mon"],
        },
        {
          id: genId(),
          title: "Vacuum Living Room",
          dueDate: "2025-07-03",
          description: "Vacuum carpets and rugs",
          peopleAssigned: ["You"],
          repeatDays: ["Wed"],
        },
      ],
    },
    {
      name: "Roommate #1",
      chores: [
        {
          id: genId(),
          title: "Mow Lawn",
          dueDate: "2025-07-04",
          description: "Front yard only",
          peopleAssigned: ["Roommate #1"],
          repeatDays: ["Sat"],
        },
      ],
    },
    {
      name: "Roommate #2",
      chores: [
        {
          id: genId(),
          title: "Grocery Run",
          dueDate: "2025-07-05",
          description: "Buy milk, eggs, bread",
          peopleAssigned: ["Roommate #2", "Roommate #1"],
          repeatDays: ["Tue"],
        },
      ],
    },
  ]);

  const handleBlockClick = (chore) => {
    setSelectedChore(chore);
  };

  const closePopup = () => setSelectedChore(null);

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);

  // Create chore: REQUIRED title, dueDate, peopleAssigned (description/repeat optional)
  const createChore = async (newChore) => {
    const requiredOk =
      newChore &&
      newChore.title &&
      newChore.dueDate &&
      Array.isArray(newChore.peopleAssigned) &&
      newChore.peopleAssigned.length > 0;

    if (!requiredOk) {
      throw new Error("Missing required fields. Please complete the form.");
    }

    const choreWithId = { ...newChore, id: newChore.id || genId() };

    setRoommates((prev) =>
      prev.map((r) => {
        if (choreWithId.peopleAssigned.includes(r.name)) {
          return { ...r, chores: [choreWithId, ...r.chores] };
        }
        return r;
      })
    );
  };

  // Delete chore: used by BOTH abandon and finish flows (meta ignored for now)
  const deleteChore = (choreToDelete) => {
    if (!choreToDelete?.id) return;

    setRoommates((prev) =>
      prev.map((r) => ({
        ...r,
        chores: r.chores.filter((c) => c.id !== choreToDelete.id),
      }))
    );

    // Close popup if the deleted chore was selected
    if (selectedChore?.id === choreToDelete.id) {
      setSelectedChore(null);
    }
  };

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      <div className="widgets-container">
        {roommates.map((r) => (
          <ChoresWidget key={r.name} roommate={r} onBlockClick={handleBlockClick} />
        ))}
      </div>

      {/* Floating "+" button */}
      <button type="button" className="chores-fab" aria-label="Create chore" onClick={openCreate}>
        +
      </button>

      {selectedChore && (
        <ChoresPopup
          chore={selectedChore}
          onClose={closePopup}
          onDelete={deleteChore}   // ✅ FIX: enables delete buttons
        />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ name: r.name }))}
        onCreate={createChore}
        onClose={closeCreate}
      />
    </main>
  );
}
