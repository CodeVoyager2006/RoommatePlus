import React from "react";
import "./Header.css";

export default function Header({ user = { name: "User Name", avatar: null, points: 1800, score: 900 } }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="avatar">
          {/* Replace with: <img src={user.avatar} alt="avatar" /> */}
        </div>
        <div className="user-info">
          <div className="user-name">{user.name}</div>
          <div className="user-pts">PTs <span className="pts-value">{user.points}</span></div>
        </div>
      </div>

      <div className="header-right">
        <div className="score-bubble">
          <div className="score-value">{user.score}</div>
        </div>
      </div>
    </header>
  );
}
