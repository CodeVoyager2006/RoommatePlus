import { supabase } from "./supabaseClient";

// ─── Household ────────────────────────────────────────────────────────────────

/** Fetch the household the current user belongs to. */
export async function fetchHousehold(householdId) {
  const { data, error } = await supabase
    .from("households")
    .select("id, name, invite_code, created_at")
    .eq("id", householdId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Profiles (members) ───────────────────────────────────────────────────────

/** Fetch all profiles in a household. */
export async function fetchMembers(householdId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, points, streaks")
    .eq("household_id", householdId)
    .order("points", { ascending: false });
  if (error) throw error;
  return data;
}

// ─── Threads ──────────────────────────────────────────────────────────────────

/** Fetch all threads for a household, newest first. */
export async function fetchThreads(householdId) {
  const { data, error } = await supabase
    .from("threads")
    .select("id, title, summary, created_at, chore_id")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Fetch a single thread with its first message's author as the thread "author".
 * Returns { thread, authorName }.
 */
export async function fetchThreadWithAuthor(threadId) {
  const { data: thread, error: tErr } = await supabase
    .from("threads")
    .select("id, title, summary, created_at, chore_id")
    .eq("id", threadId)
    .single();
  if (tErr) throw tErr;

  // Get first message to determine thread author
  const { data: firstMsg } = await supabase
    .from("messages")
    .select("sender_id, profiles(display_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const authorName = firstMsg?.profiles?.display_name ?? "Unknown";
  return { thread, authorName };
}

/**
 * Create a new thread, optionally with a first message.
 *
 * @param {object} params
 * @param {string} params.householdId  - UUID of the household
 * @param {string} params.title        - Thread title
 * @param {string|null} params.body    - Optional first message body
 * @param {string} params.senderId     - UUID of the creating user
 * @param {string|null} [params.chore_id] - Optional UUID of the linked chore
 */
export async function createThread({ householdId, title, body, senderId, chore_id = null }) {
  // Build the insert payload — only include chore_id when it's actually provided
  const insertPayload = {
    household_id: householdId,
    title: title.trim() || "Untitled",
  };
  if (chore_id) insertPayload.chore_id = chore_id;

  const { data: thread, error: tErr } = await supabase
    .from("threads")
    .insert(insertPayload)
    .select("id, title, summary, created_at, chore_id")
    .single();
  if (tErr) throw tErr;

  if (body?.trim()) {
    await createMessage({ threadId: thread.id, senderId, content: body.trim() });
  }

  return thread;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

/** Fetch all messages in a thread with sender display_name. */
export async function fetchMessages(threadId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, created_at, sender_id, profiles(display_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return data.map((m) => ({
    id: m.id,
    author: m.profiles?.display_name ?? "Unknown",
    senderId: m.sender_id,
    text: m.content,
    createdAt: new Date(m.created_at).getTime(),
  }));
}

/** Post a new message to a thread. */
export async function createMessage({ threadId, senderId, content }) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ thread_id: threadId, sender_id: senderId, content })
    .select("id, content, created_at, sender_id, profiles(display_name)")
    .single();
  if (error) throw error;

  return {
    id: data.id,
    author: data.profiles?.display_name ?? "Unknown",
    senderId: data.sender_id,
    text: data.content,
    createdAt: new Date(data.created_at).getTime(),
  };
}

/** Subscribe to new messages in a thread (realtime). Returns unsubscribe fn. */
export function subscribeToMessages(threadId, onNewMessage) {
  const channel = supabase
    .channel(`messages:thread_id=eq.${threadId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
      async (payload) => {
        // Fetch sender display_name since realtime payload lacks joined columns
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", payload.new.sender_id)
          .single();

        onNewMessage({
          id: payload.new.id,
          author: profile?.display_name ?? "Unknown",
          senderId: payload.new.sender_id,
          text: payload.new.content,
          createdAt: new Date(payload.new.created_at).getTime(),
        });
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
