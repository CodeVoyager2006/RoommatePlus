// create-chores.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./ChoresComponent.css";

/**
 * CreateChores (modal)
 * Props:
 * - isOpen: boolean
 * - roommates: { id: string, name: string }[]
 * - me: { id: string, name: string } | null
 * - onCreate: (newChore: { title, description, dueDate, assigneeIds: string[], repeatDays: string[] }) => Promise<void> | void
 * - onClose: () => void
 */
export default function CreateChores({
  isOpen,
  roommates = [],
  me = null,
  onCreate,
  onClose,
}) {
  const dayOrder = useMemo(
    () => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    []
  );

  // Build assignable list using IDs (required for chore_assignments.profile_id)
  const assignablePeople = useMemo(() => {
    const map = new Map();

    // Roommates
    for (const r of roommates) {
      if (r?.id) {
        map.set(r.id, { id: r.id, name: r.name || "Unnamed" });
      }
    }

    // Ensure "me" included
    if (me?.id) {
      map.set(me.id, { id: me.id, name: me.name || "You" });
    }

    return Array.from(map.values());
  }, [roommates, me]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToIds, setAssignedToIds] = useState([]); // UUIDs
  const [repeatDays, setRepeatDays] = useState([]);

  const [errors, setErrors] = useState({});
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = useMemo(() => {
    return (
      title.trim() ||
      description.trim() ||
      dueDate ||
      assignedToIds.length > 0 ||
      repeatDays.length > 0
    );
  }, [title, description, dueDate, assignedToIds, repeatDays]);

  // Reset form when opened
  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedToIds([]);
    setRepeatDays([]);
    setErrors({});
    setShowAssignPicker(false);
    setShowClosePrompt(false);
    setIsSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const next = {};
    if (!title.trim()) next.title = "Chore title is required.";
    if (!dueDate) next.dueDate = "Expected finish time is required.";
    if (assignedToIds.length === 0) next.assignedTo = "Assign at least one person.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toggleAssigned = (id) => {
    setAssignedToIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRepeat = (day) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const requestClose = () => {
    if (isSaving) return;
    if (!isDirty) {
      onClose?.();
      return;
    }
    setShowClosePrompt(true);
  };

  const confirmCloseDiscard = () => {
    setShowClosePrompt(false);
    onClose?.();
  };

  const handleSave = async () => {
    setErrors({});
    if (!validate()) return;

    const payload = {
      title: title.trim(),
      description: description.trim(), // optional
      dueDate,
      assigneeIds: assignedToIds,
      repeatDays: dayOrder.filter((d) => repeatDays.includes(d)),
    };

    setIsSaving(true);
    try {
      await Promise.resolve(onCreate?.(payload));
    } catch (e) {
      console.error("[CreateChores] onCreate failed:", e);
      setErrors((prev) => ({
        ...prev,
        submit: e?.message || "Failed to create chore. Check console/logs.",
      }));
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
  };

  const renderAssignedAvatars = () => {
    if (assignedToIds.length === 0) return <span className="cc-muted">None selected</span>;

    return assignedToIds.map((id) => {
      const person = assignablePeople.find((p) => p.id === id);
      const name = person?.name || "U";
      const letter = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "U";
      return (
        <span key={id} className="cc-avatar" title={name} aria-label={name}>
          {letter}
        </span>
      );
    });
  };

  return (
    <div className="chore-popup-overlay" role="dialog" aria-modal="true">
      <div className="chore-popup">
        <button type="button" className="chore-popup-close" onClick={requestClose} aria-label="Close">
          ×
        </button>

        <h3 className="chore-popup-title">Create a chore</h3>

        <div className="cc-field">
          <label className="cc-label">Chore name</label>
          <input
            className={`cc-input ${errors.title ? "cc-input-error" : ""}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Take out trash"
          />
          {errors.title && <div className="cc-error">{errors.title}</div>}
        </div>

        <div className="cc-field">
          <label className="cc-label">Description (optional)</label>
          <textarea
            className="cc-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Extra details..."
            rows={3}
          />
        </div>

        <div className="cc-field">
          <label className="cc-label">Expected finish time</label>
          <input
            type="date"
            className={`cc-input ${errors.dueDate ? "cc-input-error" : ""}`}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {errors.dueDate && <div className="cc-error">{errors.dueDate}</div>}
        </div>

        <div className="cc-field">
          <label className="cc-label">Assign to</label>

          <div className={`cc-assign ${errors.assignedTo ? "cc-assign-error" : ""}`}>
            <div className="cc-assign-avatars" aria-label="Assigned people">
              {renderAssignedAvatars()}
            </div>

            <button
              type="button"
              className="cc-assign-toggle"
              onClick={() => setShowAssignPicker((v) => !v)}
              disabled={isSaving}
            >
              {showAssignPicker ? "Done" : "Select"}
            </button>

            {errors.assignedTo && <div className="cc-error">{errors.assignedTo}</div>}

            {showAssignPicker && (
              <div className="cc-assign-picker" role="listbox" aria-label="Choose assignees">
                {assignablePeople.length === 0 ? (
                  <div className="cc-muted">No roommates found.</div>
                ) : (
                  assignablePeople.map((p) => (
                    <label key={p.id} className="cc-check">
                      <input
                        type="checkbox"
                        checked={assignedToIds.includes(p.id)}
                        onChange={() => toggleAssigned(p.id)}
                        disabled={isSaving}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="cc-field">
          <label className="cc-label">Repeat (optional)</label>
          <div className="cc-days">
            {dayOrder.map((d) => (
              <button
                key={d}
                type="button"
                className={`cc-day ${repeatDays.includes(d) ? "cc-day-on" : ""}`}
                onClick={() => toggleRepeat(d)}
                disabled={isSaving}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {errors.submit && <div className="cc-error cc-submit-error">{errors.submit}</div>}

        <div className="cc-actions">
          <button type="button" className="cc-btn" onClick={requestClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="cc-btn primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {showClosePrompt && (
          <div className="chore-action-overlay" role="presentation">
            <div className="chore-action-card">
              <div className="chore-action-title">Discard changes?</div>
              <div className="chore-action-hint">
                You have unsaved changes. Closing will discard them.
              </div>
              <div className="chore-action-buttons">
                <button
                  type="button"
                  className="chore-action-small"
                  onClick={() => setShowClosePrompt(false)}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  className="chore-action-small danger"
                  onClick={confirmCloseDiscard}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
