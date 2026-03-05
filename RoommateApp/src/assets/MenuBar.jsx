import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MenuBar.css";

/**
 * MenuBar
 *
 * Supports two modes:
 *
 * 1. Tab-state mode (used inside AppLayout after the persistent-tabs refactor):
 *      <MenuBar activeTab="chores" onTabChange={setActiveTab} />
 *    Tab keys: "chores" | "chat" | "machine" | "setting"
 *    No navigation occurs — the active component is shown/hidden in App.jsx.
 *
 * 2. Legacy route mode (fallback when neither prop is provided):
 *      <MenuBar />
 *    Uses react-router navigate() + location.pathname to determine active state.
 *    Kept so any other usage outside AppLayout continues to work unchanged.
 */
const TAB_ITEMS = [
  { key: "chores",  label: "Chores"  },
  { key: "chat",    label: "Chat"    },
  { key: "machine", label: "Machine" },
  { key: "setting", label: "Setting" },
];

const ROUTE_ITEMS = [
  { key: "chores",  label: "Chores",  to: "/app"          },
  { key: "chat",    label: "Chat",    to: "/app/chat"      },
  { key: "machine", label: "Machine", to: "/app/machine"   },
  { key: "setting", label: "Setting", to: "/app/setting"   },
];

export default function MenuBar({ activeTab, onTabChange, items }) {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Tab-state mode ──────────────────────────────────────────────────────────
  // Used when App.jsx passes activeTab + onTabChange (persistent-tabs pattern).
  // In this mode we never call navigate() — switching tabs is pure state.
  if (activeTab !== undefined && typeof onTabChange === "function") {
    return (
      <nav className="menu-bar">
        {TAB_ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`menu-item ${activeTab === it.key ? "active" : ""}`}
            onClick={() => onTabChange(it.key)}
          >
            <div className="menu-icon" aria-hidden />
            <div className="menu-label">{it.label}</div>
          </button>
        ))}
      </nav>
    );
  }

  // ── Legacy route mode ───────────────────────────────────────────────────────
  // Falls back to the original navigate() + location.pathname behaviour.
  // Also still supports the custom `items` prop for any one-off overrides.
  const defaults = ROUTE_ITEMS;
  const list = (items && items.length ? items : defaults).map((it) => {
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