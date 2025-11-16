import React from "react";
import "./MenuBar.css";

export default function MenuBar({ items = [] }) {
  // items: [{ key:"chores", label:"Chores", onClick: ()=>{}, active:false }, ...]
  return (
    <nav className="menu-bar">
      {items.map((it) => (
        <button
          key={it.key}
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
