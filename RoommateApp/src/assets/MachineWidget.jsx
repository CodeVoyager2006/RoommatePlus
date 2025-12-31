import React from "react";
import "./MachineWidget.css";

export default function MachineWidget({ machine, onClick }) {
  const isBusy = machine.status === "busy";

  return (
    <button type="button" className="machine-widget" onClick={onClick}>
      <div className="machine-widget__image">
        {machine.image ? (
          <img src={machine.image} alt={machine.name} />
        ) : (
          <div className="machine-widget__placeholder" aria-hidden="true">
            <div className="mw-icon" />
          </div>
        )}
      </div>

      <div className="machine-widget__name">{machine.name}</div>

      <div className={`machine-widget__status ${isBusy ? "busy" : "available"}`}>
        {isBusy ? "Busy" : "Available"}
      </div>
    </button>
  );
}
