import React from "react";
import "./MachineInfo.css";

export default function MachineInfo({
  open,
  machine,
  onClose,
  onOccupy,
  onFinish,
  canFinish,
}) {
  if (!open) return null;

  const isBusy = machine?.status === "busy";

  return (
    <div className="mi-overlay" role="dialog" aria-modal="true">
      <div className="mi-card">
        <button type="button" className="mi-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="mi-title">{machine?.name || "Machine"}</div>

        <div className="mi-image">
          {machine?.image ? (
            <img src={machine.image} alt={machine.name} />
          ) : (
            <div className="mi-placeholder" aria-hidden="true">
              <div className="mi-icon" />
            </div>
          )}
        </div>

        <div className="mi-row">
          <div className="mi-label">Status</div>
          <div className={`mi-pill ${isBusy ? "busy" : "available"}`}>
            {isBusy ? "Busy" : "Free"}
          </div>
        </div>

        <div className="mi-row">
          <div className="mi-label">Occupied by</div>
          <div className="mi-occupied">
            {isBusy ? (machine?.occupiedBy || "Unknown") : "—"}
          </div>
        </div>

        <div className="mi-actions">
          <button type="button" className="mi-btn secondary" onClick={onClose}>
            Exit
          </button>

          {/* NEW: Occupy becomes Finish when occupied by current user */}
          {canFinish ? (
            <button type="button" className="mi-btn primary" onClick={onFinish}>
              Finish
            </button>
          ) : (
            <button type="button" className="mi-btn primary" onClick={onOccupy}>
              Occupy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
