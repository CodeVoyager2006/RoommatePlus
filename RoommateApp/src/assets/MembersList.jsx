import React from "react";
import Avatar from "./Avatar";
import "./MembersList.css";

export default function MembersList({ members, onBack }) {
  return (
    <div className="ml-wrap">
      <div className="ml-topbar">
        <button type="button" className="ml-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="ml-topbar-title">House Members</div>
      </div>

      <div className="ml-list">
        {members.map((m) => (
          <div key={m.id} className="ml-row">
            <Avatar name={m.name} size={44} />
            <div className="ml-meta">
              <div className="ml-name">{m.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
