import React from "react";
import "./ChoresComponent.css";

/**
 * ChoresBlock
 * Props:
 * - title: string
 * - dueDate: string | Date
 * - description?: string
 * - peopleAssigned?: string[]
 * - onClick?: () => void
 */
export default function ChoresBlock({
  title = "",
  dueDate = "",
  description = "",
  peopleAssigned = [],
  onClick,
}) {
  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(
      2,
      "0"
    )}-${dt.getFullYear()}`;
  };

  const handleKeyDown = (e) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const assignedText =
    Array.isArray(peopleAssigned) && peopleAssigned.length > 0
      ? peopleAssigned.join(", ")
      : "Unassigned";

  return (
    <div
      className="chores-block"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      aria-label={title ? `Chore: ${title}` : "Chore"}
    >
      <div className="title">{title || "Untitled chore"}</div>
      <div className="due-date">{formatDate(dueDate) || "No due date"}</div>
      <div className="description">{description || "No description"}</div>

      <div className="people-row">{assignedText}</div>
    </div>
  );
}
