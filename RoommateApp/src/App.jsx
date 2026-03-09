import { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { Analytics } from "@vercel/analytics/next"

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

// Valid tab ids — must match MenuBar's tab keys
const TABS = ["chores", "chat", "machine", "setting"];

function getInitialTab() {
  const hash = window.location.hash.replace("#", "");
  return TABS.includes(hash) ? hash : "chores";
}

/* =========================
   AUTHENTICATED APP LAYOUT
   ========================= */
function AppLayout({ profile, members, refreshProfile }) {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    window.history.replaceState(null, "", `#${activeTab}`);
  }, [activeTab]);

  return (
    <>
      <Analytics />
      <Header
        displayName={profile.display_name}
        points={profile.points}
        streaks={profile.streaks}
      />

      <MenuBar activeTab={activeTab} onTabChange={setActiveTab} />

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
        <Chat
          householdId={profile.household_id}
          currentUserId={profile.id}
          houseName={profile.household_name}
          initialMembers={members}
        />
      </div>

      <div
        style={activeTab === "machine"
          ? undefined
          : { visibility: "hidden", height: 0, overflow: "hidden" }}
      >
        <Machine
          householdId={profile.household_id}
          currentUserId={profile.id}
        />
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
  const [members, setMembers] = useState([]);

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

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setMembers([]);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        display_name,
        points,
        streaks,
        household_id,
        households ( name )
      `)
      .eq("id", userId)
      .single();

    if (!error && data) {
      const enriched = {
        ...data,
        household_name: data.households?.name ?? "",
      };
      setProfile(enriched);

      if (data.household_id) {
        const { data: mems } = await supabase
          .from("profiles")
          .select("id, display_name, points, streaks")
          .eq("household_id", data.household_id)
          .order("points", { ascending: false });
        setMembers(mems ?? []);
      } else {
        setMembers([]);
      }
    } else {
      setProfile(null);
      setMembers([]);
    }

    setProfileLoading(false);
  }, []);

  useEffect(() => {
    loadProfile(session?.user?.id ?? null);
  }, [session, loadProfile]);

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
          !isAuthed ? <Home /> :
          hasProfile ? (
            hasHouse ? <Navigate to="/app" replace /> : <Navigate to="/house-setup" replace />
          ) : <Home />
        }
      />
      <Route
        path="/signup"
        element={
          !isAuthed ? <SignUp /> :
          hasProfile ? (
            hasHouse ? <Navigate to="/app" replace /> : <Navigate to="/house-setup" replace />
          ) : <Home />
        }
      />
      <Route
        path="/login"
        element={
          !isAuthed ? <LogIn /> :
          hasProfile ? (
            hasHouse ? <Navigate to="/app" replace /> : <Navigate to="/house-setup" replace />
          ) : <Home />
        }
      />

      {/* HOUSE SETUP */}
      <Route
        path="/house-setup"
        element={
          isAuthed && hasProfile && !hasHouse ? <HouseSetup /> :
          isAuthed && hasProfile && hasHouse  ? <Navigate to="/app" replace /> :
          <Navigate to="/" replace />
        }
      />
      <Route
        path="/house-create"
        element={
          isAuthed && hasProfile && !hasHouse ? <HouseCreate onSuccess={refreshProfile} /> :
          isAuthed && hasProfile && hasHouse  ? <Navigate to="/app" replace /> :
          <Navigate to="/" replace />
        }
      />
      <Route
        path="/house-login"
        element={
          isAuthed && hasProfile && !hasHouse ? <HouseLogin onSuccess={refreshProfile} /> :
          isAuthed && hasProfile && hasHouse  ? <Navigate to="/app" replace /> :
          <Navigate to="/" replace />
        }
      />

      {/* APP */}
      <Route
        path="/app"
        element={
          isAuthed && hasProfile && hasHouse ? (
            <AppLayout
              profile={profile}
              members={members}
              refreshProfile={refreshProfile}
            />
          ) : isAuthed && hasProfile && !hasHouse ? (
            <Navigate to="/house-setup" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="/app/*" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}