import React, { useState, useEffect } from "react";
import MachineWidget from "./assets/MachineWidget";
import MachineInfo from "./assets/MachineInfo";
import "./Machine.css";
import {
  getHouseholdMachines,
  subscribeToMachines,
  formatUserName
} from './config/supabaseClient';

export default function Machine({ householdId }) {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) return;

    loadMachines();

    const sub = subscribeToMachines(() => loadMachines());
    return () => sub.unsubscribe();
  }, [householdId]);

  const loadMachines = async () => {
    try {
      setLoading(true);
      const data = await getHouseholdMachines(householdId);
      
      // Transform to component format
      const transformed = data.map(m => ({
        id: m.id,
        name: m.name,
        image: m.image_url,
        status: m.status === 'in_use' ? 'busy' : 'available',
        occupiedBy: m.status === 'in_use' && m.AppUser 
          ? formatUserName(m.AppUser) 
          : ''
      }));
      
      setMachines(transformed);
    } catch (err) {
      console.error('Error loading machines:', err);
    } finally {
      setLoading(false);
    }
  };

  const openInfo = (machineId) => {
    const machine = machines.find(m => m.id === machineId);
    setSelectedMachine(machine);
    setIsInfoOpen(true);
  };

  if (loading) {
    return <div className="machine-page">Loading machines...</div>;
  }

  return (
    <div className="machine-page">
      <div className="machine-grid">
        {machines.map((m) => (
          <MachineWidget 
            key={m.id} 
            machine={m} 
            onClick={() => openInfo(m.id)} 
          />
        ))}
      </div>

      {/* Add/Occupy/Free buttons disabled until POST/PUT methods added */}
      <button
        className="machine-fab"
        type="button"
        aria-label="Add machine"
        onClick={() => alert('Add machine (POST method) coming soon')}
      >
        +
      </button>

      <MachineInfo
        open={isInfoOpen}
        machine={selectedMachine}
        onClose={() => setIsInfoOpen(false)}
        onOccupy={() => alert('Occupy (UPDATE method) coming soon')}
        onFinish={() => alert('Finish (UPDATE method) coming soon')}
        canFinish={false}
      />
    </div>
  );
}