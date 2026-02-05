import React, { useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * Settings page:
 * - Displays user settings and account management options
 * - Allows user to leave their household (signs out after leaving)
 * - Allows user to sign out of their account
 */
export default function Setting() {
  const [loading, setLoading] = useState(false);

  /**
   * Signs the user out of their account
   * Reloads the page after successful sign out
   */
  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      alert("Error signing out: " + error.message);
    } else {
      alert("Signed out successfully!");
      window.location.reload();
    }
    setLoading(false);
  };

  /**
   * Removes the user from their current household and signs them out
   * Calls the leave_household() PostgreSQL function which:
   * - Deletes all chore assignments for the user
   * - Sets user's household_id to NULL
   * - Preserves the household and chores for other members
   * Then automatically signs the user out and returns to login page
   */
  const handleLeaveHouse = async () => {
    // Show native browser confirmation dialog
    if (!confirm("Are you sure you want to leave your household? This will remove all your chore assignments and sign you out.")) {
      return;
    }

    setLoading(true);
    try {
      // Call the leave_household RPC function
      const { data, error } = await supabase.rpc("leave_household");

      if (error) throw error;

      // Check if the function returned a success response
      if (data && !data.success) {
        throw new Error(data.message || "Failed to leave household");
      }

      alert("Successfully left household!");
      
      // Sign out the user after leaving household
      await supabase.auth.signOut();
      
      // Reload page to return to login
      window.location.reload();
    } catch (error) {
      alert("Error leaving household: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>
      
      {/* Leave House button - always shown for authenticated users in household */}
      <button
        onClick={handleLeaveHouse}
        disabled={loading}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          backgroundColor: "#ffffff",
          color: "#dc2626",
          border: "2px solid #dc2626",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          marginTop: "20px",
          marginRight: "10px"
        }}
      >
        {loading ? "Leaving..." : "Leave House"}
      </button>

      {/* Sign Out button - always shown */}
      <button
        onClick={handleSignOut}
        disabled={loading}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          backgroundColor: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          marginTop: "20px"
        }}
      >
        {loading ? "Signing out..." : "Sign Out"}
      </button>
    </div>
  );
}