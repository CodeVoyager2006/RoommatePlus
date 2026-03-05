import { useCallback, useEffect, useRef, useState } from "react";
import {
  createMessage,
  createThread,
  fetchMessages,
  fetchThreads,
  subscribeToMessages,
} from "./chatApi";

/**
 * useChat
 *
 * @param {string}   householdId     — UUID of the current user's household
 * @param {string}   currentUserId   — UUID of the authenticated user (auth.users.id)
 * @param {string}   houseName       — Already-loaded household name (from App)
 * @param {Array}    initialMembers  — Already-loaded member list (from App)
 */
export function useChat(householdId, currentUserId, houseName, initialMembers) {
  // ── Pre-seeded from App — no extra fetch needed ──────────────────────────
  const household = houseName ? { name: houseName } : null;
  const members   = initialMembers ?? [];

  // ── Thread + message state ────────────────────────────────────────────────
  const [threads, setThreads]   = useState([]);
  const [messages, setMessages] = useState([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState("threads"); // "threads" | "members" | "thread"
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  const [loadingThreads,  setLoadingThreads]  = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);

  const unsubRef = useRef(null);

  // ── Fetch threads (runs once on mount, and on manual refresh) ─────────────
  const loadThreads = useCallback(async () => {
    if (!householdId) return;
    setLoadingThreads(true);
    setError(null);
    try {
      const thrs = await fetchThreads(householdId);
      setThreads(thrs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingThreads(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // ── Open a thread: load messages + subscribe to realtime ──────────────────
  const openThread = useCallback(async (threadId) => {
    setSelectedThreadId(threadId);
    setView("thread");
    setLoadingMessages(true);
    setMessages([]);

    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    try {
      const msgs = await fetchMessages(threadId);
      setMessages(msgs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMessages(false);
    }

    unsubRef.current = subscribeToMessages(threadId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });
  }, []);

  // Cleanup realtime on unmount
  useEffect(() => () => unsubRef.current?.(), []);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goBackToThreads = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setView("threads");
    setSelectedThreadId(null);
    setMessages([]);
  }, []);

  const openMembers = useCallback(() => setView("members"), []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCreateThread = useCallback(
    async ({ title, body }) => {
      if (!householdId || !currentUserId) return;
      try {
        const thread = await createThread({
          householdId,
          title,
          body,
          senderId: currentUserId,
        });
        // Optimistically prepend; then re-fetch so the list is authoritative
        setThreads((prev) => [thread, ...prev]);
        // Full refresh in background to pick up any server-side changes
        loadThreads();
        return thread;
      } catch (e) {
        setError(e.message);
      }
    },
    [householdId, currentUserId, loadThreads]
  );

  const handlePostMessage = useCallback(
    async (threadId, text) => {
      if (!text.trim() || !currentUserId) return;

      const tempId = `temp_${Date.now()}`;
      const optimistic = {
        id: tempId,
        author: "You",
        senderId: currentUserId,
        text: text.trim(),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const confirmed = await createMessage({
          threadId,
          senderId: currentUserId,
          content: text.trim(),
        });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? confirmed : m)));
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(e.message);
      }
    },
    [currentUserId]
  );

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  return {
    // data — household/members come from App, no loading state needed
    household,
    members,
    threads,
    messages,
    selectedThread,
    // ui state
    view,
    // household is always ready on first render — no blocking spinner
    loadingHousehold: false,
    loadingThreads,
    loadingMessages,
    error,
    // actions
    openThread,
    openMembers,
    goBackToThreads,
    handleCreateThread,
    handlePostMessage,
    refreshThreads: loadThreads,
  };
}
