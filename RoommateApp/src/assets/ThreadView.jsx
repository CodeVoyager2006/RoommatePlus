import React, { useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import "./ThreadView.css";

export default function ThreadView({ thread, onBack, onSend, formatTime }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
  }, [thread?.id]);

  const messages = useMemo(() => thread?.messages || [], [thread]);

  if (!thread) {
    return (
      <div className="tv-wrap">
        <div className="tv-topbar">
          <button type="button" className="tv-back" onClick={onBack} aria-label="Back">
            ←
          </button>
          <div className="tv-title">Thread</div>
        </div>
        <div className="tv-empty">Thread not found.</div>
      </div>
    );
  }

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className="tv-wrap">
      <div className="tv-topbar">
        <button type="button" className="tv-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="tv-title">{thread.title}</div>
      </div>

      <div className="tv-body">
        {messages.map((m) => (
          <div key={m.id} className="tv-msg">
            <div className="tv-msg__bubble">{m.text}</div>
            <div className="tv-msg__meta">
              <Avatar name={m.author} size={22} />
              <div className="tv-msg__time">{formatTime(m.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tv-composer" role="region" aria-label="Send a message in this thread">
        <input
          className="tv-composer__input"
          placeholder="Your message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="tv-composer__btn" type="button" onClick={send} disabled={!text.trim()}>
          Post
        </button>
      </div>
    </div>
  );
}
