import React from "react";
import "./ChoresComponent.css";

/**
 * ChoresBlock
 * Props:
 * - title: string
 * - dueDate: string | Date
 * - description?: string       (kept in props for ChoresPopup, not rendered here)
 * - peopleAssigned?: string[]
 * - repeatBitmask?: number     (7-bit int: Mon=64, Tue=32, Wed=16, Thu=8, Fri=4, Sat=2, Sun=1)
 * - onClick?: () => void
 */

const DAY_ORDER    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_BIT      = { Mon: 64, Tue: 32, Wed: 16, Thu: 8, Fri: 4, Sat: 2, Sun: 1 };
const WEEKDAY_MASK = 64 | 32 | 16 | 8 | 4; // 124
const WEEKEND_MASK = 2  | 1;                //   3
const ALL_MASK     = 127;

function repeatLabel(bitmask) {
  if (!bitmask || bitmask === 0) return null;
  if (bitmask === ALL_MASK)     return "Every day";
  if (bitmask === WEEKDAY_MASK) return "Every weekday";
  if (bitmask === WEEKEND_MASK) return "Weekend";
  return DAY_ORDER.filter((d) => (bitmask & DAY_BIT[d]) !== 0).join(", ");
}

export default function ChoresBlock({
  title          = "",
  dueDate        = "",
  description    = "",
  peopleAssigned = [],
  repeatBitmask,
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

  const repeat = repeatLabel(repeatBitmask);

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

      {/* description removed from card — visible in popup only */}

      <div className="people-row">{assignedText}</div>

      {repeat && (
        <div className="repeat-row">🔁 {repeat}</div>
      )}
    </div>
  );
}