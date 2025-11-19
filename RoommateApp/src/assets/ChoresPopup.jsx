import React from "react";
import "./ChoresComponent.css";

export default function ChoresPopup({ chore, onClose }) {
  if (!chore) return null;

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}-${dt.getFullYear()}`;
  };

  return (
    <div className="chore-popup-overlay">
      <div className="chore-popup">
        <button
          type="button"
          className="chore-popup-close"
          onClick={onClose}
        >
          ×
        </button>

        <h3 className="chore-popup-title">{chore.title}</h3>

        {chore.roommateName && (
          <div className="chore-popup-row">
            List owner: {chore.roommateName}
          </div>
        )}

        <div className="chore-popup-row">
          Due: {formatDate(chore.dueDate)}
        </div>

        <div className="chore-popup-row">
          Description:
          <div className="chore-popup-description">{chore.description}</div>
        </div>

        <div className="chore-popup-row">
          Assigned to: {chore.peopleAssigned?.join(", ")}
        </div>
      </div>
    </div>
  );
}
