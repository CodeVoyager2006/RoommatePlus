import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Home.css";

export default function HouseLogin({ onSuccess }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function joinHouse() {
    if (!code.trim()) {
      setError("Please enter an invite code.");
      return;
    }
    setError("");
    setLoading(true);

    const { data: house, error: lookupErr } = await supabase
      .from("households")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .single();

    if (lookupErr || !house) {
      setError("Invalid invite code. Please check and try again.");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data?.user) { setLoading(false); return; }

    await supabase
      .from("profiles")
      .update({ household_id: house.id })
      .eq("id", data.user.id);

    await onSuccess?.();
    navigate("/app");
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <button className="onboarding-back" onClick={() => navigate("/house-setup")}>
          ← Back
        </button>

        <h2 className="onboarding-title">Join a house</h2>
        <p className="onboarding-subtitle">Enter the invite code your roommate shared with you.</p>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="onboarding-field">
          <label className="onboarding-label">Invite code</label>
          <input
            className="onboarding-input"
            placeholder="e.g. AB12CD"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinHouse()}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>

        <div className="onboarding-actions">
          <button
            className="onboarding-btn onboarding-btn-primary"
            onClick={joinHouse}
            disabled={loading}
          >
            {loading ? "Joining…" : "Join House"}
          </button>
        </div>
      </div>
    </main>
  );
}