import React, { useMemo, useState } from "react";
import MachineWidget from "./assets/MachineWidget";
import MachineInfo from "./assets/MachineInfo";
import AddMachine from "./assets/AddMachine";
import "./Machine.css";

const CURRENT_USER = "You";

const seedMachines = [
  {
    id: "m1",
    name: "Machine #1",
    image: null,
    status: "available",
    occupiedBy: "",
  },
  {
    id: "m2",
    name: "Machine #2",
    image: null,
    status: "busy",
    occupiedBy: "Alex",
  },
];

export default function Machine() {
  const [machines, setMachines] = useState(seedMachines);

  const [selectedId, setSelectedId] = useState(null);
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId) || null,
    [machines, selectedId]
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const [toast, setToast] = useState({ open: false, message: "" });

  const openToast = (message) => {
    setToast({ open: true, message });
    window.clearTimeout(openToast._t);
    openToast._t = window.setTimeout(() => {
      setToast({ open: false, message: "" });
    }, 2400);
  };

  const onOpenInfo = (id) => {
    setSelectedId(id);
    setIsInfoOpen(true);
  };

  const onCloseInfo = () => {
    setIsInfoOpen(false);
    setSelectedId(null);
  };

  const addMachine = ({ name, image }) => {
    const newMachine = {
      id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      image: image || null,
      status: "available",
      occupiedBy: "",
    };
    setMachines((prev) => [newMachine, ...prev]);
    setIsAddOpen(false);
    openToast("Machine added.");
  };

  const requestOccupy = (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m) return;

    if (m.status === "busy") {
      openToast("Machine is currently being used please come back later");
      return;
    }

    setMachines((prev) =>
      prev.map((mm) =>
        mm.id === id ? { ...mm, status: "busy", occupiedBy: CURRENT_USER } : mm
      )
    );

    onCloseInfo();
    openToast("Machine occupied.");
  };

  // NEW: free/finish feature
  const requestFinish = (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m) return;

    // Only allow finishing if current user is the occupier
    if (!(m.status === "busy" && m.occupiedBy === CURRENT_USER)) return;

    setMachines((prev) =>
      prev.map((mm) =>
        mm.id === id ? { ...mm, status: "available", occupiedBy: "" } : mm
      )
    );

    onCloseInfo();
    openToast("Machine freed.");
  };

  const canFinish =
    selectedMachine?.status === "busy" && selectedMachine?.occupiedBy === CURRENT_USER;

  return (
    <div className="machine-page">
      <div className="machine-grid">
        {machines.map((m) => (
          <MachineWidget key={m.id} machine={m} onClick={() => onOpenInfo(m.id)} />
        ))}
      </div>

      <button
        className="machine-fab"
        type="button"
        aria-label="Add machine"
        onClick={() => setIsAddOpen(true)}
      >
        +
      </button>

      <AddMachine open={isAddOpen} onClose={() => setIsAddOpen(false)} onSave={addMachine} />

      <MachineInfo
        open={isInfoOpen}
        machine={selectedMachine}
        onClose={onCloseInfo}
        onOccupy={() => selectedMachine && requestOccupy(selectedMachine.id)}
        onFinish={() => selectedMachine && requestFinish(selectedMachine.id)}
        canFinish={Boolean(canFinish)}
      />

      {toast.open && (
        <div className="machine-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}
