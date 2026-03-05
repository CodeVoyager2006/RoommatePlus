import React from "react";
import Avatar from "./Avatar";
import "./MembersList.css";

export default function MembersList({ members, houseName = "", onBack }) {
  return (
    <div className="ml-wrap">
      <div className="ml-topbar">
        <button type="button" className="ml-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="ml-topbar-title">House Members</div>
      </div>

      {/* House banner */}
      <div className="ml-house-banner">
        <div className="ml-house-img" aria-hidden="true">🏠</div>
        <div className="ml-house-name">{houseName}</div>
      </div>

      <div className="ml-list">
        {members.map((m) => (
          <div key={m.id} className="ml-row">
            <Avatar name={m.display_name} size={44} />
            <div className="ml-meta">
              <div className="ml-name">{m.display_name}</div>
              <div className="ml-stats">
                pts: {m.points ?? 0}&nbsp;&nbsp;streaks: {m.streaks ?? 0}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
