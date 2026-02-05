// Setting.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

/**
 * Settings page:
 * - Displays user settings and account management options
 * - Checks if user is in a household and shows "Leave House" button accordingly
 * - Allows user to sign out of their account
 * - Calls leave_household() RPC function to remove user from household
 */
export default function Setting() {
  const [loading, setLoading] = useState(false);
  const [isInHousehold, setIsInHousehold] = useState(false);
  const [checkingHousehold, setCheckingHousehold] = useState(true);

  useEffect(() => {
    checkHouseholdStatus();
  }, []);

  /**
   * Checks if the current user is associated with a household
   * Sets isInHousehold state based on whether household_id exists
   */
  const checkHouseholdStatus = async () => {
    try {
      // 1) Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsInHousehold(false);
        setCheckingHousehold(false);
        return;
      }

      // 2) Fetch user's profile to check household_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("household_id")
        .eq("id", user.id)
        .single();

      // 3) Set state based on whether household_id exists
      setIsInHousehold(!!profile?.household_id);
    } catch (error) {
      console.error("Error checking household status:", error);
      setIsInHousehold(false);
    } finally {
      setCheckingHousehold(false);
    }
  };

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
   * Removes the user from their current household
   * Calls the leave_household() PostgreSQL function which:
   * - Deletes all chore assignments for the user
   * - Sets user's household_id to NULL
   * - Preserves the household and chores for other members
   */
  const handleLeaveHouse = async () => {
    // Show native browser confirmation dialog
    if (!confirm("Are you sure you want to leave your household? This will remove all your chore assignments.")) {
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
      
      // Refresh household status to hide the button
      await checkHouseholdStatus();
    } catch (error) {
      alert("Error leaving household: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>
      
      {/* Leave House button - only shown if user is in a household */}
      {!checkingHousehold && isInHousehold && (
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
      )}

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