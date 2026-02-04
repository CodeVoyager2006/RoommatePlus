import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

import Header from "./assets/Header";
import MenuBar from "./assets/MenuBar";

import Home from "./Home";
import SignUp from "./SignUp";
import LogIn from "./LogIn";
import HouseSetup from "./HouseSetup";
import HouseCreate from "./HouseCreate";
import HouseLogin from "./HouseLogin";

import Chores from "./Chores";
import Chat from "./Chat";
import Machine from "./Machine";
import Setting from "./Setting";

/* =========================
   AUTHENTICATED APP LAYOUT
   Mounted at /app/*
   ========================= */
function AppLayout({ profile }) {
  return (
    <>
      <Header
        displayName={profile.display_name}
        points={profile.points}
        streaks={profile.streaks}
      />
      <MenuBar />

      <Routes>
        {/* Pass household_id so Chores can fetch all members/chores in same house */}
        <Route index element={<Chores householdId={profile.household_id} />} />
        <Route path="chat" element={<Chat />} />
        <Route path="machine" element={<Machine />} />
        <Route path="setting" element={<Setting />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

/* =========================
   APP ROOT
   ========================= */
export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  /* =========================
     SUPABASE AUTH CONNECTION
     ========================= */
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      setSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* =========================
     LOAD PROFILE
     ========================= */
  useEffect(() => {
    let cancelled = false;

    if (!session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, points, streaks, household_id")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;

      if (!error && data) {
        setProfile(data);
      } else {
        setProfile(null);
      }

      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (sessionLoading || profileLoading) return null;

  const isAuthed = !!session?.user;
  const hasProfile = !!profile;
  const hasHouse = !!profile?.household_id;

  return (
    <Routes>
      {/* PUBLIC */}
      <Route
        path="/"
        element={
          !isAuthed ? (
            <Home />
          ) : hasProfile ? (
            hasHouse ? (
              <Navigate to="/app" replace />
            ) : (
              <Navigate to="/house-setup" replace />
            )
          ) : (
            <Home />
          )
        }
      />
      <Route
        path="/signup"
        element={
          !isAuthed ? (
            <SignUp />
          ) : hasProfile ? (
            hasHouse ? (
              <Navigate to="/app" replace />
            ) : (
              <Navigate to="/house-setup" replace />
            )
          ) : (
            <Home />
          )
        }
      />
      <Route
        path="/login"
        element={
          !isAuthed ? (
            <LogIn />
          ) : hasProfile ? (
            hasHouse ? (
              <Navigate to="/app" replace />
            ) : (
              <Navigate to="/house-setup" replace />
            )
          ) : (
            <Home />
          )
        }
      />

      {/* HOUSE SETUP */}
      <Route
        path="/house-setup"
        element={
          isAuthed && hasProfile && !hasHouse ? (
            <HouseSetup />
          ) : isAuthed && hasProfile && hasHouse ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/house-create"
        element={
          isAuthed && hasProfile && !hasHouse ? (
            <HouseCreate />
          ) : isAuthed && hasProfile && hasHouse ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route
        path="/house-login"
        element={
          isAuthed && hasProfile && !hasHouse ? (
            <HouseLogin />
          ) : isAuthed && hasProfile && hasHouse ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* APP */}
      <Route
        path="/app/*"
        element={
          isAuthed && hasProfile && hasHouse ? (
            <AppLayout profile={profile} />
          ) : isAuthed && hasProfile && !hasHouse ? (
            <Navigate to="/house-setup" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
