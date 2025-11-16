import React from "react";
import ChoresBlock from "./ChoresBlock";
import "./ChoresComponent.css";

/**
 * ChoresWidget
 * @param {{roommate: {name: string, chores: Array}}} props
 */
export default function ChoresWidget({ roommate }) {
  return (
    <section className="chores-widget" aria-label={`Chores for ${roommate.name}`}>
      <h3 className="widget-title">{roommate.name}</h3>
      <div className="chores-list">
        {roommate.chores.length === 0 ? (
          <div className="empty">No chores assigned</div>
        ) : (
          roommate.chores.map((c, idx) => (
            <ChoresBlock
              key={idx}
              title={c.title}
              dueDate={c.dueDate}
              description={c.description}
              peopleAssigned={c.peopleAssigned}
            />
          ))
        )}
      </div>
    </section>
  );
}
