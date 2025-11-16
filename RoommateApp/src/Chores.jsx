import React from "react";
import ChoresWidget from "./assets/ChoresWidget";
/**
 * Top-level Chores page (preset data)
 */
export default function Chores() {
  // Preset roommates + chores (modify as needed)
  const roommates = [
    {
      name: "You",
      chores: [
        { title: "Wash Dishes", dueDate: "2025-07-01", description: "Clean all dishes after dinner", peopleAssigned: ["You", "Alice"] },
        { title: "Vacuum Living Room", dueDate: "2025-07-03", description: "Vacuum carpets and rugs", peopleAssigned: ["You"] },
        { title: "Take Out Trash", dueDate: "2025-07-02", description: "Kitchen and bathroom trash", peopleAssigned: ["You", "Bob"] }
      ]
    },
    {
      name: "Roommate #1",
      chores: [
        { title: "Mow Lawn", dueDate: "2025-07-05", description: "Front yard only", peopleAssigned: ["Roommate #1"] },
        { title: "Clean Bathroom", dueDate: "2025-07-04", description: "Scrub shower and sink", peopleAssigned: ["Roommate #1", "You"] }
      ]
    },
    {
      name: "Roommate #2",
      chores: [
        { title: "Grocery Run", dueDate: "2025-07-06", description: "Buy milk, eggs, bread", peopleAssigned: ["Roommate #2", "Roommate #1"] }
      ]
    }
  ];

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>
      <div className="widgets-container">
        {roommates.map((r, i) => (
          <ChoresWidget key={i} roommate={r} />
        ))}
      </div>
    </main>
  );
}
