import React, { useState } from "react";
import Header from "./assets/Header";
import MenuBar from "./assets/MenuBar";
import Chores from "./Chores";
import Chat from "./Chat";
import Machine from "./Machine";
import Setting from "./Setting";
import "./App.css";

export default function App() {
  const [route, setRoute] = useState("chores");

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
      <Header user={{ name: "User Name", points: 1800, score: 900 }} />

      <main className="app-content">
        {pages[route]}
      </main>

      <MenuBar items={menuItems} />
    </div>
  );
}
