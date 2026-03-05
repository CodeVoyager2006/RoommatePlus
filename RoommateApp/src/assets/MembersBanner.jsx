import React from "react";
import Avatar from "./Avatar";
import "./MembersBanner.css";

export default function MembersBanner({ members, houseName = "", onClick }) {
  const shown = members.slice(0, 4);

  return (
    <button type="button" className="mb-banner" onClick={onClick}>
      <div className="mb-house" aria-hidden="true">🏠</div>
      <div className="mb-mid">
        <div className="mb-title">{houseName || "Our Place"}</div>
        <div className="mb-avatars" aria-hidden="true">
          {shown.map((m, idx) => (
            <Avatar
              key={m.id}
              name={m.display_name}
              size={30}
              className="mb-avatar"
              tone={idx % 2 === 0 ? "gray" : "dark"}
            />
          ))}
        </div>
      </div>
      <div className="mb-chevron" aria-hidden="true">›</div>
    </button>
  );
}
