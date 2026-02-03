import React, { useState } from "react";
import { supabaseClient } from "./supabase";

export default function Setting() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      alert("Error signing out: " + error.message);
    } else {
      alert("Signed out successfully!");
      window.location.reload();
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Settings</h2>
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