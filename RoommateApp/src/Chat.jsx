import React, { useState } from "react";
import MembersBanner from "./assets/MembersBanner";
import ThreadCard from "./assets/ThreadCard";
import MembersList from "./assets/MembersList";
import ThreadView from "./assets/ThreadView";
import NewThreadModal from "./assets/NewThreadModal";
import { useChat } from "./useChat";
import "./Chat.css";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Chat
 *
 * Props (all provided by AppLayout in App.jsx — no fetch needed here):
 *   householdId   {string}  UUID — current user's household
 *   currentUserId {string}  UUID — authenticated user (profiles.id / auth.users.id)
 *   houseName     {string}  Already-loaded household name
 *   initialMembers {Array}  Already-loaded member list
 */
export default function Chat({ householdId, currentUserId, houseName, initialMembers }) {
  const {
    household,
    members,
    threads,
    messages,
    selectedThread,
    view,
    loadingThreads,
    loadingMessages,
    error,
    openThread,
    openMembers,
    goBackToThreads,
    handleCreateThread,
    handlePostMessage,
  } = useChat(householdId, currentUserId, houseName, initialMembers);

  const [composerText, setComposerText] = useState("");
  const [isNewOpen, setIsNewOpen]       = useState(false);
  const [prefillBody, setPrefillBody]   = useState("");

  const openNewThread = () => {
    setPrefillBody(composerText.trim());
    setIsNewOpen(true);
  };

  const onCreate = async ({ title, body }) => {
    await handleCreateThread({ title, body });
    setComposerText("");
    setIsNewOpen(false);
    setPrefillBody("");
  };

  // household/members are pre-loaded from App — no blocking loading state.
  // Only surface errors if something actually went wrong.
  if (error) {
    return <div className="chat-page chat-error">Error: {error}</div>;
  }

  return (
    <div className="chat-page">
      {view === "threads" && (
        <>
          <MembersBanner
            members={members}
            houseName={household?.name ?? houseName ?? ""}
            onClick={openMembers}
          />

          <div className="chat-thread-list">
            {loadingThreads && threads.length === 0 && (
              <p className="chat-empty">Loading threads…</p>
            )}
            {!loadingThreads && threads.length === 0 && (
              <p className="chat-empty">No discussions yet. Start one below!</p>
            )}
            {threads.map((t) => (
              <ThreadCard
                key={t.id}
                title={t.title}
                summary={t.summary ?? ""}
                author={t.authorName ?? ""}
                timeLabel={formatTime(new Date(t.created_at).getTime())}
                onClick={() => openThread(t.id)}
              />
            ))}
          </div>

          <div
            className="chat-composer"
            role="region"
            aria-label="Create a new discussion thread"
          >
            <input
              className="chat-composer__input"
              placeholder="Your message..."
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
            />
            <button
              className="chat-composer__btn"
              type="button"
              onClick={openNewThread}
              disabled={!composerText.trim()}
            >
              Post
            </button>
          </div>

          <NewThreadModal
            open={isNewOpen}
            onClose={() => {
              setIsNewOpen(false);
              setPrefillBody("");
            }}
            onCreate={onCreate}
            prefillBody={prefillBody}
          />
        </>
      )}

      {view === "members" && (
        <MembersList
          members={members}
          houseName={household?.name ?? houseName ?? ""}
          onBack={goBackToThreads}
        />
      )}

      {view === "thread" && (
        <ThreadView
          thread={selectedThread}
          messages={messages}
          loadingMessages={loadingMessages}
          currentUserId={currentUserId}
          onBack={goBackToThreads}
          onSend={(text) =>
            selectedThread && handlePostMessage(selectedThread.id, text)
          }
          formatTime={formatTime}
        />
      )}
    </div>
  );
}
