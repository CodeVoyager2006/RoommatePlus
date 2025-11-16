import React from "react";
import "./Header.css";
/**
 * 
 * @param name a string that stores username
 * @param points a number that stores user points
 * @param streak a number that stores user streak
 * @returns 
 */
export default function Header({ user = {name, points, streak} }) {
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
        <div className="streak">
          <div className="streak-value">Streaks: {user.streak}</div>
        </div>
      </div>
    </header>
  );
}
