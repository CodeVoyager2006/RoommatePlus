import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export default function Setting({ householdId }) {
  const [loading, setLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState("");     // displayed value
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
        .single(); // expect exactly 1 row

      if (error) {
        setInviteCode("Can't retrieve invite code");
      } else {
        setInviteCode(data?.invite_code ?? "");
      }

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
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>

      <div>
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
            marginRight: "10px",
          }}
        >
          {loading ? "Leaving..." : "Leave House"}
        </button>

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
            marginTop: "20px",
          }}
        >
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>

      <div>
        <h3>Invite code:</h3>
        <p>{inviteLoading ? "Loading..." : (inviteCode || "—")}</p>
      </div>
    </div>
  );
}