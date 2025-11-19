import React, { useState } from "react";
import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import "./assets/ChoresComponent.css";

export default function Chores() {
  const [selectedChore, setSelectedChore] = useState(null);

  const roommates = [
    {
      name: "You",
      chores: [
        {
          title: "Wash Dishes",
          dueDate: "2025-06-30",
          description: "Clean all dishes after dinner",
          peopleAssigned: ["You", "Alice"]
        },
        {
          title: "Vacuum Living Room",
          dueDate: "2025-07-03",
          description: "Vacuum carpets and rugs",
          peopleAssigned: ["You"]
        }
      ]
    },
    {
      name: "Roommate #1",
      chores: [
        {
          title: "Mow Lawn",
          dueDate: "2025-07-04",
          description: "Front yard only",
          peopleAssigned: ["Roommate #1"]
        }
      ]
    },
    {
      name: "Roommate #2",
      chores: [
        {
          title: "Grocery Run",
          dueDate: "2025-07-05",
          description: "Buy milk, eggs, bread",
          peopleAssigned: ["Roommate #2", "Roommate #1"]
        }
      ]
    }
  ];

  const handleBlockClick = (chore) => {
    setSelectedChore(chore);
  };

  const closePopup = () => setSelectedChore(null);

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>
      <div className="widgets-container">
        {roommates.map((r, i) => (
          <ChoresWidget
            key={i}
            roommate={r}
            onBlockClick={handleBlockClick}
          />
        ))}
      </div>

      {selectedChore && (
        <ChoresPopup chore={selectedChore} onClose={closePopup} />
      )}
    </main>
  );
}
