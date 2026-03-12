import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./ChoresHistory.css";

export default function ChoresHistory({ householdId, onClose }) {
  const [allChores, setAllChores] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistoryData();
  }, [householdId]);

  const loadHistoryData = async () => {
    setLoading(true);

    // Get users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("household_id", householdId);

    setUsers(profiles || []);

    // ✅ FIX: Get completed chores with assignments and completed_at
    const { data: chores } = await supabase
      .from("chores")
      .select(
        `
        id,
        name,
        completed_at,
        points,
        chore_assignments (
          profile_id,
          profiles (
            display_name
          )
        )
      `,
      )
      .eq("household_id", householdId)
      .eq("status", "completed") // ✅ FIX: Changed from "passed" to "completed"
      .order("completed_at", { ascending: false });

    setAllChores(chores || []);
    setLoading(false);
  };

  const getFilteredChores = () => {
    let filtered = allChores;

    // Filter by user
    if (selectedUser !== "all") {
      filtered = filtered.filter((chore) =>
        chore.chore_assignments?.some((a) => a.profile_id === selectedUser),
      );
    }

    // Filter by timeline
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - selectedTimeframe);

    filtered = filtered.filter((chore) => {
      const completedDate = new Date(chore.completed_at);
      return completedDate >= cutoff;
    });

    return filtered;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const filteredChores = getFilteredChores();

  return (
    <div className="chores-history-overlay" onClick={onClose}>
      {" "}
      {/* ✅ FIX: Add onClick */}
      <div
        className="chores-history-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2>Chore History</h2>
        <button type="button" className="history-close" onClick={onClose}>
          ×
        </button>

        {/* Filters */}
        <div className="filters-container">
          <label>
            User:
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="all">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Timeline:
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={365}>Last Year</option>
            </select>
          </label>
        </div>

        {/* Results */}
        <div className="history-results">
          <p>Results ({filteredChores.length} Chores):</p>

          {loading ? (
            <div className="history-loading">Loading...</div>
          ) : filteredChores.length === 0 ? (
            <div className="history-empty">No completed chores found</div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Users</th>
                  <th>Chore</th>
                  <th>Date</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {filteredChores.map((chore) => (
                  <tr key={chore.id}>
                    <td>
                      {chore.chore_assignments
                        ?.map((a) => a.profiles?.display_name)
                        .filter(Boolean)
                        .join(", ") || "Unknown"}
                    </td>
                    <td>{chore.name}</td>
                    <td>{formatDate(chore.completed_at)}</td>
                    <td>{chore.points || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
