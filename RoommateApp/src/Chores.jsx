import React, { useState, useEffect } from "react";
import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";
import {
  getHouseholdChores,
  getHouseholdUsers,
  getCurrentUserEmail,
  initializeSession,
  subscribeToChores,
  getBitmaskDays,
  formatUserName,
  isChoreOverdue
} from './config/supabaseClient';

export default function Chores({ householdId }) {
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [roommates, setRoommates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

  // Initialize session on mount
  useEffect(() => {
    const init = async () => {
      const userEmail = await initializeSession();
      setCurrentUserEmail(userEmail);
    };
    init();
  }, []);

  // Load chores when household ID is available
  useEffect(() => {
    if (!householdId || !currentUserEmail) {
      setLoading(false);
      return;
    }

    loadChoresAndMembers();

    // Subscribe to real-time updates
    const subscription = subscribeToChores(() => {
      console.log('Chore updated, reloading...');
      loadChoresAndMembers();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [householdId, currentUserEmail]);

  const loadChoresAndMembers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading chores for household:', householdId);

      // Load household members
      const members = await getHouseholdUsers(householdId);
      console.log('Loaded members:', members);
      
      // Load all chores for the household
      const allChores = await getHouseholdChores(householdId);
      console.log('Loaded chores:', allChores);

      // Transform database format to component format
      const transformedChores = allChores.map(dbChore => {
        // Build list of assigned people
        const assignedPeople = [];
        
        // Add primary assigned user
        if (dbChore.assigned_user) {
          const fullName = formatUserName(dbChore.assigned_user);
          assignedPeople.push(
            dbChore.assigned_user.email === currentUserEmail ? 'You' : fullName
          );
        }
        
        // Add additional assigned users from UserChore junction table
        if (dbChore.UserChore && dbChore.UserChore.length > 0) {
          dbChore.UserChore.forEach(uc => {
            if (uc.AppUser) {
              const fullName = formatUserName(uc.AppUser);
              const displayName = uc.AppUser.email === currentUserEmail ? 'You' : fullName;
              if (!assignedPeople.includes(displayName)) {
                assignedPeople.push(displayName);
              }
            }
          });
        }

        return {
          id: dbChore.id,
          title: dbChore.title,
          dueDate: dbChore.due_date,
          description: dbChore.description || '',
          peopleAssigned: assignedPeople,
          repeatDays: dbChore.repeat_unit === 'weekly' 
            ? getBitmaskDays(dbChore.repeat_days) 
            : [],
          status: dbChore.status,
          pointValue: dbChore.point_value,
          isOverdue: isChoreOverdue(dbChore),
          // Store original DB data for reference
          _dbData: dbChore
        };
      });

      console.log('Transformed chores:', transformedChores);

      // Group chores by assigned person
      const roommatesData = members.map(member => {
        const fullName = formatUserName(member);
        const isCurrentUser = member.email === currentUserEmail;
        const displayName = isCurrentUser ? 'You' : fullName;
        
        // Find chores where this person is assigned
        const memberChores = transformedChores.filter(chore => {
          // Check if member's name or "You" is in the assigned list
          return chore.peopleAssigned.includes(displayName) ||
                 (isCurrentUser && chore.peopleAssigned.includes('You'));
        });

        return {
          name: displayName,
          email: member.email,
          chores: memberChores
        };
      });

      console.log('Roommates data:', roommatesData);

      setRoommates(roommatesData);
    } catch (err) {
      console.error('Error loading chores:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockClick = (chore) => {
    setSelectedChore(chore);
  };

  const closePopup = () => setSelectedChore(null);

  const openCreate = () => {
    // TODO: Implement create functionality
    alert('Create chore feature will be implemented with POST methods later');
  };
  
  const closeCreate = () => setIsCreateOpen(false);

  const handleDeleteChore = async (choreToDelete, meta) => {
    // TODO: Implement delete functionality
    alert('Delete chore feature will be implemented with DELETE methods later');
  };

  if (loading) {
    return (
      <main className="chores-page">
        <h2 className="page-title">Loading chores...</h2>
        <p style={{ padding: '20px', textAlign: 'center' }}>
          Fetching data from Supabase...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="chores-page">
        <h2 className="page-title">Error Loading Chores</h2>
        <div style={{ padding: '20px' }}>
          <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>
          <button 
            onClick={loadChoresAndMembers}
            style={{
              padding: '10px 20px',
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
      </main>
    );
  }

  if (!householdId) {
    return (
      <main className="chores-page">
        <h2 className="page-title">No Household Selected</h2>
        <p style={{ padding: '20px', textAlign: 'center' }}>
          Please create or join a household first.
        </p>
      </main>
    );
  }

  if (roommates.length === 0) {
    return (
      <main className="chores-page">
        <h2 className="page-title">No Roommates Found</h2>
        <p style={{ padding: '20px', textAlign: 'center' }}>
          Add members to your household to see chores.
        </p>
      </main>
    );
  }

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      <div className="widgets-container">
        {roommates.map((r) => (
          <ChoresWidget 
            key={r.email} 
            roommate={r} 
            onBlockClick={handleBlockClick} 
          />
        ))}
      </div>

      {/* Floating "+" button - disabled until POST methods added */}
      <button 
        type="button" 
        className="chores-fab" 
        aria-label="Create chore" 
        onClick={openCreate}
        title="Create chore (coming soon with POST methods)"
      >
        +
      </button>

      {selectedChore && (
        <ChoresPopup
          chore={selectedChore}
          onClose={closePopup}
          onDelete={handleDeleteChore} // Will be enabled with DELETE methods
        />
      )}

      {/* CreateChores modal - will be enabled with POST methods */}
      {isCreateOpen && (
        <CreateChores
          isOpen={isCreateOpen}
          roommates={roommates.map((r) => ({ name: r.name }))}
          onCreate={() => alert('POST methods not implemented yet')}
          onClose={closeCreate}
        />
      )}
    </main>
  );
}