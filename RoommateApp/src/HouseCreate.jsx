import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Home.css";

export default function HouseCreate({ onSuccess }) {
  const navigate = useNavigate();
  const [houseName, setHouseName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [houseId, setHouseId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async function createHouse() {
    if (!houseName.trim()) {
      setError("Please enter a house name.");
      return;
    }
    setError("");
    setLoading(true);

    while (true) {
      const code = generateCode();

      const { data, error: insertErr } = await supabase
        .from("households")
        .insert({ name: houseName.trim(), invite_code: code })
        .select()
        .single();

      if (!insertErr) {
        setInviteCode(code);
        setHouseId(data.id);
        setLoading(false);
        break;
      }

      // Only retry on duplicate invite_code conflicts; bail on other errors
      if (insertErr.code !== "23505") {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
    }
  }

  async function continueToApp() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    await supabase
      .from("profiles")
      .update({ household_id: houseId })
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

        {!inviteCode ? (
          <>
            <h2 className="onboarding-title">Create your house</h2>
            <p className="onboarding-subtitle">Give your household a name to get started.</p>

            {error && <div className="onboarding-error">{error}</div>}

            <div className="onboarding-field">
              <label className="onboarding-label">House name</label>
              <input
                className="onboarding-input"
                placeholder="e.g. The Green House"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createHouse()}
              />
            </div>

            <div className="onboarding-actions">
              <button
                className="onboarding-btn onboarding-btn-primary"
                onClick={createHouse}
                disabled={loading}
              >
                {loading ? "Creating…" : "Create House"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="onboarding-title">House created! 🎉</h2>
            <p className="onboarding-subtitle">Share this code with your roommates so they can join.</p>

            <div className="onboarding-code-box">
              <div className="onboarding-code-label">Invite Code</div>
              <div className="onboarding-code">{inviteCode}</div>
              <div className="onboarding-code-hint">Roommates can enter this on the join screen.</div>
            </div>

            <div className="onboarding-actions">
              <button
                className="onboarding-btn onboarding-btn-primary"
                onClick={continueToApp}
              >
                Continue to App
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}