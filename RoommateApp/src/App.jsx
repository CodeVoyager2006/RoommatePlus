import React, { useState, useEffect } from "react";
import { getCurrentUserProfile } from "./config/supabaseClient";
import Header from "./assets/Header";
import MenuBar from "./assets/MenuBar";
import Chores from "./Chores";
import Chat from "./Chat";
import Machine from "./Machine";
import Setting from "./Setting";
import "./App.css";

export default function App() {
  const [route, setRoute] = useState("chores");
  const [userData, setUserData] = useState(null);
  const [householdId, setHouseholdId] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // TODO: Replace with actual current user email from auth
      localStorage.setItem('current_user_email', 'chris@demo.com');
      
      const user = await getCurrentUserProfile();
      setUserData(user);
      setHouseholdId(user.household_id);
      
      console.log('Loaded user:', user);
    } catch (err) {
      console.error('Error loading user:', err);
    }
  };

  const pages = {
    chores: <Chores householdId={householdId} />,
    chat: <Chat />,
    machine: <Machine householdId={householdId} />,
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
      <Header user={userData ? {
        name: `${userData.first_name} ${userData.last_name}`,
        points: userData.points,
        streak: userData.streak
      } : {
        name: 'Loading...',
        points: 0,
        streak: 0
      }} />

      <main className="app-content">
        {pages[route]}
      </main>

      <MenuBar items={menuItems} />
    </div>
  );
}