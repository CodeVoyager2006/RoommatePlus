import React from "react";
import "./Avatar.css";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 36, tone = "gray", className = "" }) {
  return (
    <div
      className={`avatar avatar--${tone} ${className}`}
      style={{ width: size, height: size }}
      aria-label={name}
      title={name}
    >
      <span className="avatar__text">{initials(name)}</span>
    </div>
  );
}
