// Chores.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

import ChoresWidget from "./assets/ChoresWidget";
import ChoresPopup from "./assets/ChoresPopup";
import CreateChores from "./assets/create-chores";
import "./assets/ChoresComponent.css";

/**
 * Chores page:
 * - Shows a widget for every roommate in the same household (even if no chores exist).
 * - Resolves household_id from DB if the prop is missing/stale.
 * - Loads chores + assignments and fills widgets where assigned.
 * - Supports DB writes: create chore, abandon, finish (optional image upload).
 */
export default function Chores({ householdId }) {
  console.log("[Chores] render");
  const [roommates, setRoommates] = useState([]);
  const [selectedChore, setSelectedChore] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [resolvedHouseholdId, setResolvedHouseholdId] = useState(null);
  const [me, setMe] = useState(null); // { id, name }

  const safeHouseholdId = useMemo(() => householdId ?? null, [householdId]);

  const loadData = useCallback(async () => {
    setLoading(true);

    // 1) Auth user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRoommates([]);
      setResolvedHouseholdId(null);
      setMe(null);
      setLoading(false);
      return;
    }

    // 2) Get my profile (for display_name + household_id fallback)
    let myDisplayName = "You";
    const { data: myProfileRow, error: myProfileErr } = await supabase
      .from("profiles")
      .select("display_name, household_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!myProfileErr && myProfileRow?.display_name) {
      myDisplayName = myProfileRow.display_name;
    }
    setMe({ id: user.id, name: myDisplayName });

    // 3) Resolve household_id
    let hid = safeHouseholdId;
    if (!hid) {
      hid = myProfileRow?.household_id ?? null;
    }

    if (!hid) {
      // Not in a household yet
      setRoommates([{ id: user.id, name: myDisplayName, chores: [] }]);
      setResolvedHouseholdId(null);
      setLoading(false);
      return;
    }
    setResolvedHouseholdId(hid);

    // 4) Fetch all profiles in household (requires correct RLS on profiles)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, household_id")
      .eq("household_id", hid)
      .order("display_name", { ascending: true });

    console.log("[Chores] profiles rows:", profiles, "error:", profilesError);

    if (profilesError || !profiles) {
      setRoommates([{ id: user.id, name: myDisplayName, chores: [] }]);
      setLoading(false);
      return;
    }

    // Base widgets (always show)
    const baseRoommates = profiles.map((p) => ({
      id: p.id,
      name: p.display_name || "Unnamed",
      chores: [],
    }));
    setRoommates(baseRoommates);

    // 5) Load chores in household
    const { data: chores, error: choresError } = await supabase
      .from("chores")
      .select("id, name, due_date, description, household_id, status")
      .eq("household_id", hid);

    if (choresError || !chores || chores.length === 0) {
      setLoading(false);
      return;
    }

    const choreIds = chores.map((c) => c.id);

    // 6) Load assignments for these chores
    const { data: assignments, error: assignmentsError } = await supabase
      .from("chore_assignments")
      .select("chore_id, profile_id")
      .in("chore_id", choreIds);

    const safeAssignments = assignmentsError || !assignments ? [] : assignments;

    // Maps
    const profileIdToName = new Map(
      profiles.map((p) => [p.id, p.display_name || "Unnamed"])
    );
    const idxByProfileId = new Map(baseRoommates.map((r, idx) => [r.id, idx]));

    // Build updated list
    const updated = profiles.map((p) => ({
      id: p.id,
      name: p.display_name || "Unnamed",
      chores: [],
    }));

    const updatedIdxByProfileId = new Map(updated.map((r, idx) => [r.id, idx]));

    for (const chore of chores) {
      const assigneeIds = safeAssignments
        .filter((a) => a.chore_id === chore.id)
        .map((a) => a.profile_id);

      const assignedNames = assigneeIds
        .map((pid) => profileIdToName.get(pid))
        .filter(Boolean);

      const choreForUI = {
        id: chore.id,
        title: chore.name,
        dueDate: chore.due_date,
        description: chore.description,
        peopleAssigned: assignedNames,
        assigneeIds,
        status: chore.status,
        repeatDays: [],
      };

      if (assigneeIds.length === 0) continue;

      for (const pid of assigneeIds) {
        const idx = updatedIdxByProfileId.get(pid);
        if (idx !== undefined) updated[idx].chores.push(choreForUI);
      }
    }

    setRoommates(updated);
    setLoading(false);
  }, [safeHouseholdId]);

  useEffect(() => {
    console.log("[Chores] useEffect fired", { householdId });
    let cancelled = false;

    (async () => {
      try {
        await loadData();
      } catch (e) {
        console.error("[Chores] loadData error:", e);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadData, householdId]);

  const handleBlockClick = (chore) => setSelectedChore(chore);
  const closePopup = () => setSelectedChore(null);

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);

  const handleCreateChore = async (payload) => {
    if (!resolvedHouseholdId) throw new Error("No household found for this user.");

    const title = payload?.title?.trim() || "";
    const dueDate = payload?.dueDate || "";
    const description = payload?.description?.trim() || null;
    const assigneeIds = Array.isArray(payload?.assigneeIds) ? payload.assigneeIds : [];

    if (!title) throw new Error("Title is required.");
    if (!dueDate) throw new Error("Due date is required.");
    if (assigneeIds.length === 0) throw new Error("Assign at least one person.");

    // 1) Insert chore
    const { data: inserted, error: insErr } = await supabase
      .from("chores")
      .insert([
        {
          household_id: resolvedHouseholdId,
          name: title,
          description,
          due_date: dueDate,
          status: "ongoing",
        },
      ])
      .select("id")
      .single();

    if (insErr) throw insErr;

    // 2) Insert assignments
    const rows = assigneeIds.map((profileId) => ({
      chore_id: inserted.id,
      profile_id: profileId,
    }));

    const { error: asgErr } = await supabase.from("chore_assignments").insert(rows);
    if (asgErr) throw asgErr;

    await loadData();
  };

  // Note: ChoresPopup uses prop name "onDelete" but it’s really an action callback.
  const handleChoreAction = async (chore, meta) => {
    if (!chore?.id) return;

    const mode = meta?.mode;

    if (mode === "abandon") {
      const reason = (meta?.reason || "").trim() || "N/A";
      const { error } = await supabase
        .from("chores")
        .update({ status: "passed", drop_reason: reason })
        .eq("id", chore.id);

      if (error) throw error;

      setSelectedChore(null);
      await loadData();
      return;
    }

    if (mode === "finish") {
      let imageUrl = null;
      const file = meta?.imageFile || null;

      // Optional upload (requires Storage bucket: "chore-images")
      if (file) {
        try {
          const ext = (file.name || "jpg").split(".").pop();
          const path = `chores/${chore.id}/${Date.now()}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("chore-images")
            .upload(path, file, { upsert: true });

          if (!upErr) {
            const { data } = supabase.storage.from("chore-images").getPublicUrl(path);
            imageUrl = data?.publicUrl || null;
          }
        } catch (e) {
          console.warn("[Chores] image upload failed:", e);
        }
      }

      const updates = {
        status: "completed",
        completed_at: new Date().toISOString(),
      };
      if (imageUrl) updates.image_url = imageUrl;

      const { error } = await supabase.from("chores").update(updates).eq("id", chore.id);
      if (error) throw error;

      setSelectedChore(null);
      await loadData();
    }
  };

  if (loading) return null;

  return (
    <main className="chores-page">
      <h2 className="page-title">Your chores</h2>

      <div className="widgets-container">
        {roommates.map((r) => (
          <ChoresWidget key={r.id} roommate={r} onBlockClick={handleBlockClick} />
        ))}
      </div>

      <button
        type="button"
        className="chores-fab"
        aria-label="Create chore"
        onClick={openCreate}
      >
        +
      </button>

      {selectedChore && (
        <ChoresPopup chore={selectedChore} onClose={closePopup} onDelete={handleChoreAction} />
      )}

      <CreateChores
        isOpen={isCreateOpen}
        roommates={roommates.map((r) => ({ id: r.id, name: r.name }))}
        me={me}
        onClose={closeCreate}
        onCreate={async (payload) => {
          await handleCreateChore(payload);
          closeCreate();
        }}
      />
    </main>
  );
}
