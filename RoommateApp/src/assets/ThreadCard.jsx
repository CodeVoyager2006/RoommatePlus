import React from "react";
import Avatar from "./Avatar";
import "./ThreadCard.css";

export default function ThreadCard({ title, summary, author, timeLabel, onClick }) {
  return (
    <button type="button" className="tc-card" onClick={onClick}>
      <div className="tc-main">
        <div className="tc-title">{title}</div>
        <div className="tc-summary">{summary}</div>
        <div className="tc-footer">
          <Avatar name={author} size={26} />
          <div className="tc-time">{timeLabel}</div>
        </div>
      </div>
    </button>
  );
}
