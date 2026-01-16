// RoommateApp/src/Machine.jsx
import React, { useMemo, useState, useEffect } from "react";
import MachineWidget from "./assets/MachineWidget";
import MachineInfo from "./assets/MachineInfo";
import AddMachine from "./assets/AddMachine";
import { fetchMachines } from "./config/supabaseApi";
import "./Machine.css";

const CURRENT_USER = "You";

export default function Machine() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId) || null,
    [machines, selectedId]
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const [toast, setToast] = useState({ open: false, message: "" });

  // Fetch machines on mount
  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMachines();
      setMachines(data);
    } catch (err) {
      console.error('Failed to load machines:', err);
      setError('Failed to load machines. Please try again.');
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

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
    
    // Optimistically update UI
    setMachines((prev) => [newMachine, ...prev]);
    setIsAddOpen(false);
    openToast("Machine added.");

    // TODO: Add actual API call to create machine in database
    // await supabase.from('machines').insert({...})
  };

  const requestOccupy = (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m) return;

    if (m.status === "busy") {
      openToast("Machine is currently being used please come back later");
      return;
    }

    // Optimistically update UI
    setMachines((prev) =>
      prev.map((mm) =>
        mm.id === id ? { ...mm, status: "busy", occupiedBy: CURRENT_USER } : mm
      )
    );

    onCloseInfo();
    openToast("Machine occupied.");

    // TODO: Add actual API call to update machine occupation
    // await supabase.from('machines').update({is_occupied: true, ...}).eq('id', id)
  };

  const requestFinish = (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m) return;

    // Only allow finishing if current user is the occupier
    if (!(m.status === "busy" && m.occupiedBy === CURRENT_USER)) return;

    // Optimistically update UI
    setMachines((prev) =>
      prev.map((mm) =>
        mm.id === id ? { ...mm, status: "available", occupiedBy: "" } : mm
      )
    );

    onCloseInfo();
    openToast("Machine freed.");

    // TODO: Add actual API call to free machine
    // await supabase.from('machines').update({is_occupied: false, occupied_by: null}).eq('id', id)
  };

  const canFinish =
    selectedMachine?.status === "busy" && selectedMachine?.occupiedBy === CURRENT_USER;

  if (loading) {
    return (
      <div className="machine-page">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading machines...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="machine-page">
        <div style={{ padding: '20px', textAlign: 'center', color: '#7a1010' }}>
          {error}
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={loadMachines}
              style={{ 
                padding: '8px 16px', 
                background: '#d9d9d9', 
                color: '#222',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="machine-page">
      {machines.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          No machines found. Add your first machine!
        </div>
      ) : (
        <div className="machine-grid">
          {machines.map((m) => (
            <MachineWidget key={m.id} machine={m} onClick={() => onOpenInfo(m.id)} />
          ))}
        </div>
      )}

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