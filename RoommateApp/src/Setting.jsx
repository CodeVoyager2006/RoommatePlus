import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./Setting.css";

export default function Setting({ householdId }) {
  const [loading, setLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [inviteLoading, setInviteLoading] = useState(true);

  useEffect(() => {
    const fetchInviteCode = async () => {
      if (!householdId) {
        setInviteCode("");
        setInviteLoading(false);
        return;
      }

      setInviteLoading(true);

      const { data, error } = await supabase
        .from("households")
        .select("invite_code")
        .eq("id", householdId)
        .single();

      if (error) setInviteCode("Can't retrieve invite code");
      else setInviteCode(data?.invite_code ?? "");

      setInviteLoading(false);
    };

    fetchInviteCode();
  }, [householdId]);

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();

    if (error) alert("Error signing out: " + error.message);
    else {
      alert("Signed out successfully!");
      window.location.reload();
    }
    setLoading(false);
  };

  const handleLeaveHouse = async () => {
    if (
      !confirm(
        "Are you sure you want to leave your household? This will remove all your chore assignments."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("leave_household");
      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.message || "Failed to leave household");
      }

      alert("Successfully left household!");
      window.location.reload();
    } catch (error) {
      alert("Error leaving household: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="setting-page">
      <h2 className="setting-title">Settings</h2>

      <div className="setting-actions">
        <button
          onClick={handleLeaveHouse}
          disabled={loading}
          className="btn btn-outline-danger"
        >
          {loading ? "Leaving..." : "Leave House"}
        </button>

        <button
          onClick={handleSignOut}
          disabled={loading}
          className="btn btn-danger"
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>

      <div className="invite-section">
        <h3 className="invite-title">Invite code:</h3>
        <p className="invite-code">
          {inviteLoading ? "Loading..." : inviteCode || "—"}
        </p>
      </div>
    </div>
  );
}