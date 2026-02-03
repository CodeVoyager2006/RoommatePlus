import React, { useState, useEffect } from "react";
import { supabaseClient } from "./supabase";
import Auth from "./Auth";
import Header from "./assets/Header";
import MenuBar from "./assets/MenuBar";
import Chores from "./Chores";
import Chat from "./Chat";
import Machine from "./Machine";
import Setting from "./Setting";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState("chores");

  useEffect(() => {
    // Check active session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!user) {
    return <Auth onAuth={() => setLoading(true)} />;
  }

  const pages = {
    chores: <Chores />,
    chat: <Chat />,
    machine: <Machine />,
    settings: <Setting />
  };

  const menuItems = [
    { key: "chores", label: "Chores", onClick: () => setRoute("chores"), active: route === "chores" },
    { key: "chat", label: "Chat", onClick: () => setRoute("chat"), active: route === "chat" },
    { key: "machine", label: "Machine Available", onClick: () => setRoute("machine"), active: route === "machine" },
    { key: "settings", label: "Settings", onClick: () => setRoute("settings"), active: route === "settings" },
  ];

  return (
    <div className="app-root">
      <Header user={{ name: user.email, points: 1800, score: 900, streak: 10 }} />
      <main className="app-content">
        {pages[route]}
      </main>
      <MenuBar items={menuItems} />
    </div>
  );
}