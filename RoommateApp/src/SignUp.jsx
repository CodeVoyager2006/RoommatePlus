import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Home.css";

export default function SignUp() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSignUp(e) {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter a display name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setLoading(false);
      return;
    }

    // Wait briefly for the DB trigger to create the profile row
    await new Promise((resolve) => setTimeout(resolve, 500));

    setLoading(false);
    navigate("/house-setup");
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <h1 className="onboarding-wordmark">
          Roommates<span>Plus</span>
        </h1>
        <p className="onboarding-tagline">Create your account.</p>

        <form onSubmit={handleSignUp} noValidate>
          {error && (
            <div className="onboarding-error" role="alert">{error}</div>
          )}

          <div className="onboarding-field">
            <label className="onboarding-label" htmlFor="signup-name">Display name</label>
            <input
              id="signup-name"
              className="onboarding-input"
              placeholder="How your roommates will see you"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="onboarding-field">
            <label className="onboarding-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className="onboarding-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="onboarding-field">
            <label className="onboarding-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="onboarding-input"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="onboarding-actions">
            <button
              type="submit"
              className="onboarding-btn onboarding-btn-primary"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Sign Up"}
            </button>

            <button
              type="button"
              className="onboarding-btn onboarding-btn-secondary"
              onClick={() => navigate("/login")}
              disabled={loading}
            >
              Already have an account? Log in
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}