import React from "react";
import "./Header.css";
/**
 * 
 * @param name a string that stores username
 * @param points a number that stores user points
 * @param streak a number that stores user streak
 * @returns 
 */
export default function Header({displayName, points, streaks}) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="avatar">
          {/* Replace with: <img src={user.avatar} alt="avatar" /> */}
        </div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
          <div className="user-pts">PTs <span className="pts-value">{points}</span></div>
        </div>
      </div>

      <div className="header-right">
        <div className="streak">
          <div className="streak-value">Streaks: {streaks}</div>
        </div>
      </div>
    </header>
  );
}
