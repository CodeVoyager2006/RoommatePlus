// RoommateApp/src/Chores.jsx
import React, { useState, useEffect } from "react";
import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import { fetchChores, fetchUsers } from "./config/supabaseApi";
import "./assets/ChoresComponent.css";

const genId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ch_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export default function Chores() {
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roommates, setRoommates] = useState([]);
  const [users, setUsers] = useState([]); // For create chore dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch chores data on mount
  useEffect(() => {
    loadChoresData();
    loadUsers();
  }, []);

  const loadChoresData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChores();
      setRoommates(data);
    } catch (err) {
      console.error('Failed to load chores:', err);
      setError('Failed to load chores. Please try again.');
      // Fallback to empty state
      setRoommates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const handleBlockClick = (chore) => {
    setSelectedChore(chore);
  };

  const closePopup = () => setSelectedChore(null);

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);

  // Create chore: REQUIRED title, dueDate, peopleAssigned (description/repeat optional)
  const createChore = async (newChore) => {
    const requiredOk =
      newChore &&
      newChore.title &&
      newChore.dueDate &&
      Array.isArray(newChore.peopleAssigned) &&
      newChore.peopleAssigned.length > 0;

    if (!requiredOk) {
      throw new Error("Missing required fields. Please complete the form.");
    }

    const choreWithId = { ...newChore, id: newChore.id || genId() };

    // Optimistically update UI
    setRoommates((prev) =>
      prev.map((r) => {
        if (choreWithId.peopleAssigned.includes(r.name)) {
          return { ...r, chores: [choreWithId, ...r.chores] };
        }
        return r;
      })
    );

    // TODO: Add actual API call to create chore in database
    // await supabase.from('chores').insert(...)
  };

  // Delete chore: used by BOTH abandon and finish flows (meta ignored for now)
  const deleteChore = (choreToDelete) => {
    if (!choreToDelete?.id) return;

    // Optimistically update UI
    setRoommates((prev) =>
      prev.map((r) => ({
        ...r,
        chores: r.chores.filter((c) => c.id !== choreToDelete.id),
      }))
    );

    // Close popup if the deleted chore was selected
    if (selectedChore?.id === choreToDelete.id) {
      setSelectedChore(null);
    }

    // TODO: Add actual API call to delete chore from database
    // await supabase.from('chores').delete().eq('id', choreToDelete.id)
  };

  if (loading) {
    return (
      <main className="chores-page">
        <h2 className="page-title">Your chores</h2>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading chores...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="chores-page">
        <h2 className="page-title">Your chores</h2>
        <div style={{ padding: '20px', textAlign: 'center', color: '#7a1010' }}>
          {error}
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={loadChoresData}
              style={{ 
                padding: '8px 16px', 
                background: '#6fa86f', 
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      {roommates.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          No chores found. Create your first chore!
        </div>
      ) : (
        <div className="widgets-container">
          {roommates.map((r) => (
            <ChoresWidget key={r.name} roommate={r} onBlockClick={handleBlockClick} />
          ))}
        </div>
      )}

      {/* Floating "+" button */}
      <button type="button" className="chores-fab" aria-label="Create chore" onClick={openCreate}>
        +
      </button>

      {selectedChore && (
        <ChoresPopup
          chore={selectedChore}
          onClose={closePopup}
          onDelete={deleteChore}
        />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={users.length > 0 ? users : roommates.map((r) => ({ name: r.name }))}
        onCreate={createChore}
        onClose={closeCreate}
      />
    </main>
  );
}