// LogIn.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./Home.css";

const REMEMBER_EMAIL_KEY = "rmplus_remember_email";

export async function logInWithEmailPassword(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");

  if (!cleanEmail || !cleanPassword) {
    throw new Error("Email and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  if (error) {
    console.error("Supabase signInWithPassword error:", {
      status: error.status,
      name: error.name,
      message: error.message,
    });

    const msg = (error.message || "").toLowerCase();
    if (error.status === 400 && msg.includes("email not confirmed")) {
      throw new Error("Email not confirmed. Check your inbox for the confirmation email.");
    }
    if (error.status === 400 && msg.includes("invalid login credentials")) {
      throw new Error("Invalid email or password.");
    }

    throw new Error(error.message || "Login failed.");
  }

  const session = data?.session ?? null;
  if (!session) {
    throw new Error("Login succeeded but no session was returned.");
  }

  return session;
}

export default function LogIn({ onLoggedIn }) {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch { /* storage may be blocked */ }
  }, []);

  const canSubmit = useMemo(
    () => !loading && email.trim().length > 0 && password.length > 0,
    [loading, email, password]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const session = await logInWithEmailPassword(email, password);

      try {
        if (remember) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch { /* ignore */ }

      onLoggedIn?.(session);
    } catch (err) {
      setErrorMsg(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <h1 className="onboarding-wordmark">
          Roommates<span>Plus</span>
        </h1>
        <p className="onboarding-tagline">Welcome back.</p>

        <form onSubmit={handleSubmit} noValidate>
          {errorMsg && (
            <div className="onboarding-error" role="alert">{errorMsg}</div>
          )}

          <div className="onboarding-field">
            <label className="onboarding-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="onboarding-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="onboarding-field">
            <label className="onboarding-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="onboarding-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="onboarding-remember">
            <label className="onboarding-check-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Remember email</span>
            </label>
          </div>

          <div className="onboarding-actions">
            <button
              type="submit"
              className="onboarding-btn onboarding-btn-primary"
              disabled={!canSubmit}
            >
              {loading ? "Logging in…" : "Log In"}
            </button>

            <button
              type="button"
              className="onboarding-btn onboarding-btn-secondary"
              onClick={() => navigate("/signup")}
            >
              Create an account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}