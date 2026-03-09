import React, { useMemo, useState, useEffect, useCallback } from "react";
import MachineWidget from "./assets/MachineWidget";
import MachineInfo from "./assets/MachineInfo";
import AddMachine from "./assets/AddMachine";
import { supabase } from "./supabaseClient";
import "./Machine.css";

export default function Machine({ householdId, currentUserId }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selectedId) || null,
    [machines, selectedId]
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const [toast, setToast] = useState({ open: false, message: "" });

  const openToast = (message) => {
    setToast({ open: true, message });
    window.clearTimeout(openToast._t);
    openToast._t = window.setTimeout(() => {
      setToast({ open: false, message: "" });
    }, 2400);
  };

  /* ── Fetch machines ── */
  const fetchMachines = useCallback(async () => {
    if (!householdId) return;
    const { data, error } = await supabase
      .from("machines")
      .select("id, name, image_url, occupied_by, profiles:occupied_by(display_name)")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setMachines(
        data.map((m) => ({
          id: m.id,
          name: m.name,
          image: m.image_url || null,
          status: m.occupied_by ? "busy" : "available",
          occupiedBy: m.profiles?.display_name || null,
          occupiedById: m.occupied_by || null,
        }))
      );
    }
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  /* ── Real-time subscription ── */
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`machines:household:${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machines",
          filter: `household_id=eq.${householdId}`,
        },
        () => fetchMachines()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [householdId, fetchMachines]);

  /* ── Modals ── */
  const onOpenInfo = (id) => {
    setSelectedId(id);
    setIsInfoOpen(true);
  };

  const onCloseInfo = () => {
    setIsInfoOpen(false);
    setSelectedId(null);
  };

  /* ── Add machine ── */
  const addMachine = async ({ name, imageFile }) => {
    let image_url = null;

    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${householdId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("machine")
        .upload(path, imageFile, { upsert: false });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("machine")
          .getPublicUrl(path);
        image_url = urlData?.publicUrl || null;
      }
    }

    const { error } = await supabase.from("machines").insert({
      household_id: householdId,
      name: name.trim(),
      image_url,
      occupied_by: null,
    });

    if (!error) {
      setIsAddOpen(false);
      openToast("Machine added.");
      fetchMachines();
    } else {
      openToast("Failed to add machine.");
    }
  };

  /* ── Occupy ── */
  const requestOccupy = async (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m) return;

    if (m.status === "busy") {
      openToast("Machine is currently being used, please come back later.");
      return;
    }

    const { error } = await supabase
      .from("machines")
      .update({ occupied_by: currentUserId })
      .eq("id", id);

    onCloseInfo();
    if (!error) {
      openToast("Machine occupied.");
      fetchMachines();
    } else {
      openToast("Failed to occupy machine.");
    }
  };

  /* ── Finish ── */
  const requestFinish = async (id) => {
    const m = machines.find((x) => x.id === id);
    if (!m || !(m.status === "busy" && m.occupiedById === currentUserId)) return;

    const { error } = await supabase
      .from("machines")
      .update({ occupied_by: null })
      .eq("id", id);

    onCloseInfo();
    if (!error) {
      openToast("Machine freed.");
      fetchMachines();
    } else {
      openToast("Failed to free machine.");
    }
  };

  const canFinish =
    selectedMachine?.status === "busy" &&
    selectedMachine?.occupiedById === currentUserId;

  return (
    <div className="machine-page">
      {loading ? (
        <div className="machine-loading">Loading machines…</div>
      ) : machines.length === 0 ? (
        <div className="machine-empty">No machines yet. Add one!</div>
      ) : (
        <div className="machine-grid">
          {machines.map((m) => (
            <MachineWidget key={m.id} machine={m} onClick={() => onOpenInfo(m.id)} />
          ))}
        </div>
      )}

      <button
        className="machine-fab"
        type="button"
        aria-label="Add machine"
        onClick={() => setIsAddOpen(true)}
      >
        +
      </button>

      <AddMachine open={isAddOpen} onClose={() => setIsAddOpen(false)} onSave={addMachine} />

      <MachineInfo
        open={isInfoOpen}
        machine={selectedMachine}
        onClose={onCloseInfo}
        onOccupy={() => selectedMachine && requestOccupy(selectedMachine.id)}
        onFinish={() => selectedMachine && requestFinish(selectedMachine.id)}
        canFinish={Boolean(canFinish)}
      />

      {toast.open && (
        <div className="machine-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}