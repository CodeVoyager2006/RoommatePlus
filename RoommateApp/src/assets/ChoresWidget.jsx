import React from "react";
import ChoresBlock from "./ChoresBlock";
import "./ChoresComponent.css";

/**
 * @param {{roommate:{name:string, chores:any[]}, onBlockClick?:(chore:any)=>void}} props
 */
export default function ChoresWidget({ roommate, onBlockClick }) {
  return (
    <section
      className="chores-widget"
      aria-label={`Chores for ${roommate.name}`}
    >
      <h3 className="widget-title">{roommate.name}</h3>
      <div className="chores-list">
        {roommate.chores.length === 0 ? (
          <div className="empty">No chores assigned</div>
        ) : (
          roommate.chores.map((c) => (
            <ChoresBlock
              key={c.id || `${c.title}-${c.dueDate}`} // ✅ FIX: stable key
              title={c.title}
              dueDate={c.dueDate}
              description={c.description}
              peopleAssigned={c.peopleAssigned}
              repeatDays={c.repeatDays}
              onClick={
                () =>
                  onBlockClick &&
                  onBlockClick({ ...c, roommateName: roommate.name }) // keeps id + adds owner label
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
