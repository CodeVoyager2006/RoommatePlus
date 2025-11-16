import React from "react";
import "./ChoresComponent.css";

/**
 * ChoresBlock
 * @param {{title: string, dueDate: string, description: string, peopleAssigned: string[]}} props
 */
export default function ChoresBlock({ title, dueDate, description, peopleAssigned = [] }) {

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}-${dt.getFullYear()}`;
  };

  return (
    <div className="chores-block">
      <div className="title">{title}</div>
      <div className="due-date">{formatDate(dueDate)}</div>
      <div className="description">{description}</div>

      <div className="people-row">
        {peopleAssigned.join(", ")}
      </div>
    </div>
  );
}
