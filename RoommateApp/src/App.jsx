// RoommateApp/src/App.jsx
import React, { useState, useEffect } from "react";
import Header from "./assets/Header";
import MenuBar from "./assets/MenuBar";
import Chores from "./Chores";
import Chat from "./Chat";
import Machine from "./Machine";
import Setting from "./Setting";
import { getCurrentUser } from "./config/supabaseApi";
import "./App.css";

export default function App() {
  const [route, setRoute] = useState("chores");
  const [user, setUser] = useState({
    name: "User Name",
    points: 0,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch current user on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const userData = await getCurrentUser();
      
      if (userData) {
        setUser({
          name: userData.name,
          points: userData.points,
          streak: userData.streak
        });
      } else {
        // No user session, use default
        console.log('No active user session');
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      // Keep default user data on error
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="app-root">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          background: '#ffffff'
        }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <Header user={user} />

      <main className="app-content">
        {pages[route]}
      </main>

      <MenuBar items={menuItems} />
    </div>
  );
}