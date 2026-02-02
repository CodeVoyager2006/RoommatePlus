import React, { useMemo, useState } from "react";
import MembersBanner from "./assets/MembersBanner";
import ThreadCard from "./assets/ThreadCard";
import MembersList from "./assets/MembersList";
import ThreadView from "./assets/ThreadView";
import NewThreadModal from "./assets/NewThreadModal";
import "./Chat.css";

const CURRENT_USER = "You";

const seedMembers = [
  { id: "u1", name: "Alex"},
  { id: "u2", name: "Sam"},
  { id: "u3", name: "Jamie"},
  { id: "u4", name: "Taylor"},
];

const seedThreads = [
  {
    id: "t1",
    title: "Kitchen cleanup",
    summary: "AI Summary: Reminder to reset counters, take out trash, and run dishwasher tonight.",
    author: "Alex",
    createdAt: Date.now() - 1000 * 60 * 60 * 4,
    messages: [
      {
        id: "m1",
        author: "Alex",
        text: "Can we all do a quick kitchen reset tonight?",
        createdAt: Date.now() - 1000 * 60 * 60 * 4,
      },
      {
        id: "m2",
        author: "Jamie",
        text: "I can do counters + wipe the stove.",
        createdAt: Date.now() - 1000 * 60 * 60 * 3.5,
      },
    ],
  },
  {
    id: "t2",
    title: "Laundry schedule",
    summary: "AI Summary: Suggestion to add a simple washer/dryer rotation so nobody blocks machines.",
    author: "Sam",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    messages: [
      {
        id: "m3",
        author: "Sam",
        text: "Can we agree on a laundry rotation?",
        createdAt: Date.now() - 1000 * 60 * 60 * 24,
      },
    ],
  },
];

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function makeSummaryFromBody(body) {
  const cleaned = body.trim().replace(/\s+/g, " ");
  const short = cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
  return `AI Summary: ${short || "No summary available."}`;
}

export default function Chat() {
  const [members] = useState(seedMembers);
  const [threads, setThreads] = useState(seedThreads);

  // "threads" | "members" | "thread"
  const [view, setView] = useState("threads");
  const [selectedId, setSelectedId] = useState(null);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedId) || null,
    [threads, selectedId]
  );

  const [composerText, setComposerText] = useState("");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newPrefillBody, setNewPrefillBody] = useState("");

  const openMembers = () => setView("members");

  const openThread = (id) => {
    setSelectedId(id);
    setView("thread");
  };

  const goBackToThreads = () => {
    setView("threads");
    setSelectedId(null);
  };

  const openNewThread = () => {
    const body = composerText.trim();
    setNewPrefillBody(body);
    setIsNewOpen(true);
  };

  const createThread = ({ title, body }) => {
    const now = Date.now();
    const newThread = {
      id: `t_${now}_${Math.random().toString(16).slice(2)}`,
      title: title.trim() || "Untitled",
      summary: makeSummaryFromBody(body),
      author: CURRENT_USER,
      createdAt: now,
      messages: body.trim()
        ? [
            {
              id: `m_${now}_0`,
              author: CURRENT_USER,
              text: body.trim(),
              createdAt: now,
            },
          ]
        : [],
    };

    setThreads((prev) => [newThread, ...prev]);
    setComposerText("");
    setIsNewOpen(false);
    setNewPrefillBody("");
  };

  const postMessage = (threadId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const now = Date.now();
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const msg = {
          id: `m_${now}_${Math.random().toString(16).slice(2)}`,
          author: CURRENT_USER,
          text: trimmed,
          createdAt: now,
        };
        return { ...t, messages: [...t.messages, msg] };
      })
    );
  };

  return (
    <div className="chat-page">
      {view === "threads" && (
        <>
          <MembersBanner members={members} onClick={openMembers} />

          <div className="chat-thread-list">
            {threads.map((t) => (
              <ThreadCard
                key={t.id}
                title={t.title}
                summary={t.summary}
                author={t.author}
                timeLabel={formatTime(t.createdAt)}
                onClick={() => openThread(t.id)}
              />
            ))}
          </div>

          <div className="chat-composer" role="region" aria-label="Create a new discussion thread">
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
              setNewPrefillBody("");
            }}
            onCreate={createThread}
            prefillBody={newPrefillBody}
          />
        </>
      )}

      {view === "members" && (
        <MembersList members={members} onBack={goBackToThreads} />
      )}

      {view === "thread" && (
        <ThreadView
          thread={selectedThread}
          onBack={goBackToThreads}
          onSend={(text) => selectedThread && postMessage(selectedThread.id, text)}
          formatTime={formatTime}
        />
      )}
    </div>
  );
}
