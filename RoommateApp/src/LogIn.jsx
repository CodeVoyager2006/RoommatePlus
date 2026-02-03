// LogIn.jsx
import React, { useEffect, useMemo, useState } from "react";
import {supabase} from "./supabaseClient";

const REMEMBER_EMAIL_KEY = "rmplus_remember_email";

/**
 * Helper: Email/password login via Supabase.
 * Returns the session on success; throws a readable Error on failure.
 */
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
    // Keep full details in console for debugging
    console.error("Supabase signInWithPassword error:", {
      status: error.status,
      name: error.name,
      message: error.message,
    });

    // More helpful messages for common 400s
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

/**
 * Default UI component.
 * Props:
 * - onLoggedIn?: (session) => void
 */
export default function LogIn({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load remembered email (if any)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      // ignore (storage may be blocked)
    }
  }, []);

  const canSubmit = useMemo(() => {
    return !loading && email.trim().length > 0 && password.length > 0;
  }, [loading, email, password]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const session = await logInWithEmailPassword(email, password);

      // Remember email if enabled
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
      } catch {
        // ignore
      }

      onLoggedIn?.(session);
    } catch (err) {
      setErrorMsg(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Remember email</span>
        </label>

        {errorMsg ? (
          <div role="alert" style={{ color: "crimson" }}>
            {errorMsg}
          </div>
        ) : null}

        <button type="submit" disabled={!canSubmit}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </div>
    </form>
  );
}
