import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MenuBar.css";

export default function MenuBar({ items }) {
  const navigate = useNavigate();
  const location = useLocation();

  // If App.jsx doesn't pass items, use sensible defaults for your /app routes
  const defaults = [
    { key: "chores", label: "Chores", to: "/app" },
    { key: "chat", label: "Chat", to: "/app/chat" },
    { key: "machine", label: "Machine", to: "/app/machine" },
    { key: "setting", label: "Setting", to: "/app/setting" },
  ];

  const list = (items && items.length ? items : defaults).map((it) => {
    // Support both shapes:
    // - { key, label, to }
    // - { key, label, onClick, active }
    const to = it.to;
    const active =
      typeof it.active === "boolean"
        ? it.active
        : to
        ? location.pathname === to
        : false;

    const onClick =
      it.onClick ??
      (to ? () => navigate(to) : undefined);

    return { ...it, active, onClick };
  });

  return (
    <nav className="menu-bar">
      {list.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`menu-item ${it.active ? "active" : ""}`}
          onClick={it.onClick}
        >
          <div className="menu-icon" aria-hidden />
          <div className="menu-label">{it.label}</div>
        </button>
      ))}
    </nav>
  );
}
