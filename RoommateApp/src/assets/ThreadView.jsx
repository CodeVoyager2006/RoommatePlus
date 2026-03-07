import React, { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { supabase } from "../supabaseClient";
import "./ThreadView.css";

/* ─── Thread Info Detail View ────────────────────────────────────────────────
   Shown when the user taps ℹ from the message list.
   Displays thread metadata + Relevant Files (chore image if thread is linked
   to a chore, empty state otherwise).
   No message composer is shown here.
────────────────────────────────────────────────────────────────────────────── */
function ThreadInfoView({ thread, messages, onBack, formatTime }) {
  const lastMsg = messages[messages.length - 1];

  // Fetch the chore's image_url when this thread is linked to a chore
  const [choreImageUrl, setChoreImageUrl] = useState(null);
  const [loadingImage, setLoadingImage]   = useState(false);

  useEffect(() => {
    // Reset whenever the thread changes
    setChoreImageUrl(null);

    if (!thread?.chore_id) return;

    let cancelled = false;
    setLoadingImage(true);

    supabase
      .from("chores")
      .select("image_url")
      .eq("id", thread.chore_id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data?.image_url) setChoreImageUrl(data.image_url);
        setLoadingImage(false);
      });

    return () => { cancelled = true; };
  }, [thread?.id, thread?.chore_id]);

  return (
    <div className="tv-wrap">
      <div className="tv-topbar">
        <button type="button" className="tv-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <div className="tv-title">Thread Info</div>
      </div>

      {/* Meta rows */}
      <div className="tv-info-panel tv-info-panel--page">
        <div className="tv-info-row">
          <span className="tv-info-label">Title</span>
          <span className="tv-info-value">{thread.title}</span>
        </div>
        <div className="tv-info-row">
          <span className="tv-info-label">Posted</span>
          <span className="tv-info-value">
            {formatTime(new Date(thread.created_at).getTime())}
          </span>
        </div>
        {lastMsg && (
          <div className="tv-info-row">
            <span className="tv-info-label">Last message</span>
            <span className="tv-info-value">{formatTime(lastMsg.createdAt)}</span>
          </div>
        )}
        {thread.summary && (
          <div className="tv-info-summary">
            <div className="tv-info-summary-label">AI Summary</div>
            <div className="tv-info-summary-text">{thread.summary}</div>
          </div>
        )}
      </div>

      {/* Relevant Files — shows chore image when thread is linked to a chore */}
      <div className="tv-files-section">
        <div className="tv-files-header">Relevant Files</div>

        {loadingImage && (
          <div className="tv-files-empty">
            <div className="tv-files-empty__text">Loading…</div>
          </div>
        )}

        {!loadingImage && choreImageUrl && (
          <div className="tv-files-grid">
            <div className="tv-files-item">
              <img
                src={choreImageUrl}
                alt="Chore image"
                className="tv-files-img"
              />
            </div>
          </div>
        )}

        {!loadingImage && !choreImageUrl && (
          <div className="tv-files-empty">
            <div className="tv-files-empty__icon" aria-hidden="true">🖼</div>
            <div className="tv-files-empty__text">No files yet.</div>
            <div className="tv-files-empty__sub">
              Images and files related to this thread will appear here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Thread Message View ────────────────────────────────────────────────────
   The default view: message list + composer.
   The ℹ button navigates to ThreadInfoView.
────────────────────────────────────────────────────────────────────────────── */
function ThreadMessagesView({
  thread,
  messages,
  loadingMessages,
  currentUserId,
  onBack,
  onSend,
  onOpenInfo,
  formatTime,
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText("");
  }, [thread?.id]);

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
        <button
          type="button"
          className="tv-info-btn"
          onClick={onOpenInfo}
          aria-label="Thread info"
          title="Thread info"
        >
          ℹ
        </button>
      </div>

      <div className="tv-body">
        {loadingMessages && <div className="tv-empty">Loading messages…</div>}

        {!loadingMessages && messages.length === 0 && (
          <div className="tv-empty">No messages yet. Be the first to reply!</div>
        )}

        {messages.map((m) => {
          const isOwn = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`tv-msg${isOwn ? " tv-msg--own" : ""}`}>
              <div className="tv-msg__bubble">{m.text}</div>
              <div className="tv-msg__meta">
                <Avatar name={m.author} size={22} />
                <div className="tv-msg__time">{formatTime(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tv-composer" role="region" aria-label="Send a message in this thread">
        <input
          className="tv-composer__input"
          placeholder="Your message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <button
          type="button"
          className="tv-composer__icon-btn"
          aria-label="Attach photo"
          title="Attach photo (coming soon)"
          disabled
        >
          📷
        </button>
        <button
          className="tv-composer__btn"
          type="button"
          onClick={send}
          disabled={!text.trim()}
        >
          Post
        </button>
      </div>
    </div>
  );
}

/* ─── ThreadView (root) ───────────────────────────────────────────────────── */
export default function ThreadView({
  thread,
  messages,
  loadingMessages,
  currentUserId,
  onBack,
  onSend,
  formatTime,
}) {
  // "messages" | "info"
  const [subView, setSubView] = useState("messages");

  // Reset sub-view whenever we switch threads
  useEffect(() => {
    setSubView("messages");
  }, [thread?.id]);

  if (!thread) {
    return (
      <div className="tv-wrap">
        <div className="tv-topbar">
          <button type="button" className="tv-back" onClick={onBack} aria-label="Back">←</button>
          <div className="tv-title">Thread</div>
        </div>
        <div className="tv-empty">Thread not found.</div>
      </div>
    );
  }

  if (subView === "info") {
    return (
      <ThreadInfoView
        thread={thread}
        messages={messages}
        onBack={() => setSubView("messages")}
        formatTime={formatTime}
      />
    );
  }

  return (
    <ThreadMessagesView
      thread={thread}
      messages={messages}
      loadingMessages={loadingMessages}
      currentUserId={currentUserId}
      onBack={onBack}
      onSend={onSend}
      onOpenInfo={() => setSubView("info")}
      formatTime={formatTime}
    />
  );
}
