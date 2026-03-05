import { useCallback, useEffect, useState } from "react";
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
   ========================= */
function AppLayout({ profile }) {
  // Manage the active tab in state instead of via React Router.
  // All tab components are always mounted — only their visibility changes.
  // This prevents React Router from unmounting/remounting them on every
  // tab switch, which would re-trigger loadData() each time.
  const [activeTab, setActiveTab] = useState("chores");

  return (
    <>
      <Header
        displayName={profile.display_name}
        points={profile.points}
        streaks={profile.streaks}
      />

      {/* MenuBar receives the active tab + a setter instead of using navigate() */}
      <MenuBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/*
        All tabs are rendered simultaneously but hidden when inactive.
        Using visibility:hidden + height:0 + overflow:hidden (rather than
        display:none) keeps the components fully mounted while preventing
        layout interference from hidden tabs.
      */}
      <div
        style={activeTab === "chores"
          ? undefined
          : { visibility: "hidden", height: 0, overflow: "hidden" }}
      >
        <Chores householdId={profile.household_id} />
      </div>

      <div
        style={activeTab === "chat"
          ? undefined
          : { visibility: "hidden", height: 0, overflow: "hidden" }}
      >
        <Chat />
      </div>

      <div
        style={activeTab === "machine"
          ? undefined
          : { visibility: "hidden", height: 0, overflow: "hidden" }}
      >
        <Machine />
      </div>

      <div
        style={activeTab === "setting"
          ? undefined
          : { visibility: "hidden", height: 0, overflow: "hidden" }}
      >
        <Setting householdId={profile.household_id} />
      </div>
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
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, points, streaks, household_id")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setProfile(data);
    } else {
      setProfile(null);
    }

    setProfileLoading(false);
  }, []);

  useEffect(() => {
    loadProfile(session?.user?.id ?? null);
  }, [session, loadProfile]);

  // Passed to HouseCreate / HouseLogin so they can trigger a profile refresh
  // immediately after the household_id is written — no page reload needed.
  const refreshProfile = useCallback(() => {
    if (session?.user?.id) loadProfile(session.user.id);
  }, [session, loadProfile]);

  if (sessionLoading || profileLoading) return null;

  const isAuthed   = !!session?.user;
  const hasProfile = !!profile;
  const hasHouse   = !!profile?.household_id;

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
            <HouseCreate onSuccess={refreshProfile} />
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
            <HouseLogin onSuccess={refreshProfile} />
          ) : isAuthed && hasProfile && hasHouse ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* APP — single route, tab switching handled inside AppLayout */}
      <Route
        path="/app"
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

      {/* Catch deep /app/* paths and redirect to /app */}
      <Route
        path="/app/*"
        element={<Navigate to="/app" replace />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}