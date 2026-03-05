import React from "react";
import ChoresBlock from "./ChoresBlock";
import "./ChoresComponent.css";

/**
 * ChoresWidget
 * Props:
 * - roommate: { id?: string, name: string, chores: any[] }
 * - onBlockClick?: (chore: any) => void
 */
export default function ChoresWidget({ roommate, onBlockClick }) {
  const name = roommate?.name || "Roommate";
  const chores = Array.isArray(roommate?.chores) ? roommate.chores : [];

  return (
    <section className="chores-widget" aria-label={`Chores for ${name}`}>
      <h3 className="widget-title">{name}</h3>

      <div className="chores-list">
        {chores.length === 0 ? (
          <div className="empty">No chores assigned</div>
        ) : (
          chores.map((c) => (
            <ChoresBlock
              key={c?.id || `${c?.title || "chore"}-${c?.dueDate || "nodate"}`}
              title={c?.title}
              dueDate={c?.dueDate}
              description={c?.description}
              peopleAssigned={c?.peopleAssigned}
              onClick={() => {
                if (typeof onBlockClick === "function") {
                  onBlockClick({ ...c, roommateName: name });
                }
              }}
            />
          ))
        )}
      </div>
    </section>
  );
}
