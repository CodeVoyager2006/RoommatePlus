import React from "react";
import "./ChoresComponent.css";

/**
 * ChoresBlock
 * @param {{title: string, dueDate: string, description: string, repeatDays: string[], peopleAssigned: string[], onClick?: () => void}} props
 */
export default function ChoresBlock({
  title,
  dueDate,
  description,
  repeatDays = [],
  peopleAssigned = [],
  onClick,
}) {
  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}-${dt.getFullYear()}`;
  };

  // Helper function to format repeat days
  const formatRepeatDays = () => {
    if (!repeatDays || repeatDays.length === 0) return "";

    // If all 7 days are selected format for better readability
    if (repeatDays.length === 7) {
      return "Repeats: Every day";
    }
    // Otherwise, list the selected days
    return `Repeats: ${repeatDays.join(", ")}`;
  };

  return (
    <div className="chores-block" onClick={onClick}>
      <div className="title">{title}</div>
      <div className="due-date">{formatDate(dueDate)}</div>
      <div className="description">{description}</div>
      <div className="repeat-days-row">{formatRepeatDays()}</div>
      <div className="people-row">{peopleAssigned.join(", ")}</div>
    </div>
  );
}
