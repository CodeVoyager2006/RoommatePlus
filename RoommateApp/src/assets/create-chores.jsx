import React, { useEffect, useMemo, useRef, useState } from "react";
import "./create-chores.css";

/**
 * CreateChores (modal)
 * Props:
 * - isOpen: boolean
 * - roommates: { name: string }[]
 * - onCreate: (newChore: {title, description, dueDate, peopleAssigned, repeatDays}) => Promise<void> | void
 * - onClose: () => void
 */
export default function CreateChores({ isOpen, roommates = [], onCreate, onClose }) {
  const assignablePeople = useMemo(() => {
    const names = roommates.map((r) => r.name);
    return Array.from(new Set(["You", ...names]));
  }, [roommates]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // OPTIONAL
  const [dueDate, setDueDate] = useState(""); // REQUIRED (yyyy-mm-dd)
  const [assignedTo, setAssignedTo] = useState([]); // REQUIRED (>=1)
  const [repeatDays, setRepeatDays] = useState([]); // OPTIONAL
  const [errors, setErrors] = useState({});
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Single native date input (ONLY ONE LINE)
  const dateInputRef = useRef(null);
  const openNativeDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;

    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  const isDirty = useMemo(() => {
    return (
      title.trim() ||
      description.trim() ||
      dueDate ||
      assignedTo.length > 0 ||
      repeatDays.length > 0
    );
  }, [title, description, dueDate, assignedTo, repeatDays]);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedTo([]);
    setRepeatDays([]);
    setErrors({});
    setShowAssignPicker(false);
    setShowClosePrompt(false);
    setIsSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // REQUIRED: title, dueDate, assignedTo
  // OPTIONAL: description, repeatDays
  const validate = () => {
    const next = {};
    if (!title.trim()) next.title = "Chore title is required.";
    if (!dueDate) next.dueDate = "Expected finish time is required.";
    if (!assignedTo.length) next.assignedTo = "Assign at least one person.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const toggleAssigned = (name) => {
    setAssignedTo((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const toggleDay = (day) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const onRequestClose = () => {
    if (!isDirty) {
      onClose?.();
      return;
    }
    setShowClosePrompt(true);
  };

  const discardAndClose = () => {
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
      peopleAssigned: assignedTo,
      repeatDays: dayOrder.filter((d) => repeatDays.includes(d)), // optional
    };

    try {
      setIsSaving(true);
      await Promise.resolve(onCreate?.(payload));
      setShowClosePrompt(false);
      onClose?.();
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        backend: typeof e?.message === "string" ? e.message : "Failed to save chore.",
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="cc-overlay" role="dialog" aria-modal="true" aria-label="Create chore">
      <div className="cc-sheet">
        <button type="button" className="cc-close" aria-label="Close" onClick={onRequestClose}>
          ×
        </button>

        <div className="cc-content">
          {/* Title (required) */}
          <div className="cc-field">
            <label className="cc-label">Title of chores</label>
            <input
              className={`cc-input ${errors.title ? "cc-input-error" : ""}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
            {errors.title && <div className="cc-error">{errors.title}</div>}
          </div>

          {/* Description (optional) */}
          <div className="cc-field">
            <label className="cc-label">Description of the chores (optional)</label>
            <textarea
              className="cc-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={4}
            />
          </div>

          {/* Expected finish time (required) */}
          <div className="cc-field cc-row">
            <div className="cc-row-left">
              <label className="cc-label">Expected finish time</label>

              {/* ONLY ONE INPUT LINE (type="date") */}
              <input
                ref={dateInputRef}
                type="date"
                className={`cc-input cc-date-input ${errors.dueDate ? "cc-input-error" : ""}`}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Expected finish date"
              />

              {errors.dueDate && <div className="cc-error">{errors.dueDate}</div>}
            </div>

            <div className="cc-row-right">
              <button
                type="button"
                className="cc-calendar-pill"
                onClick={openNativeDatePicker}
                aria-label="Open calendar"
              >
                Calendar
              </button>
            </div>
          </div>

          {/* Assign to (required) */}
          <div className="cc-field">
            <label className="cc-label">Assign to</label>

            <div className={`cc-assign ${errors.assignedTo ? "cc-assign-error" : ""}`}>
              <div className="cc-assign-avatars" aria-label="Assigned people">
                {assignedTo.length === 0 ? (
                  <span className="cc-muted">None selected</span>
                ) : (
                  assignedTo.map((name) => (
                    <span key={name} className="cc-avatar" title={name} aria-label={name}>
                      {name === "You"
                        ? "Y"
                        : name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase()}
                    </span>
                  ))
                )}
              </div>

              <button
                type="button"
                className="cc-assign-plus"
                aria-label="Add or remove assignees"
                onClick={() => setShowAssignPicker((s) => !s)}
              >
                +
              </button>
            </div>

            {errors.assignedTo && <div className="cc-error">{errors.assignedTo}</div>}

            {showAssignPicker && (
              <div className="cc-assign-picker" role="listbox" aria-label="Choose assignees">
                {assignablePeople.map((name) => (
                  <label key={name} className="cc-check">
                    <input
                      type="checkbox"
                      checked={assignedTo.includes(name)}
                      onChange={() => toggleAssigned(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Repeat (optional) */}
          <div className="cc-field">
            <label className="cc-label">Repeat (optional)</label>
            <div className="cc-repeat">
              <div className="cc-repeat-days">
                {dayOrder.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`cc-day ${repeatDays.includes(d) ? "cc-day-on" : ""}`}
                    onClick={() => toggleDay(d)}
                    aria-pressed={repeatDays.includes(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div className="cc-repeat-summary">
                {repeatDays.length ? dayOrder.filter((d) => repeatDays.includes(d)).join(", ") : "No repeat selected"}
                <span className="cc-chevron">›</span>
              </div>
            </div>
          </div>

          {errors.backend && <div className="cc-error cc-error-wide">{errors.backend}</div>}

          <div className="cc-actions">
            <button type="button" className="cc-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Close confirmation */}
        {showClosePrompt && (
          <div className="cc-confirm-overlay" role="alertdialog" aria-modal="true" aria-label="Save chore before closing?">
            <div className="cc-confirm">
              <div className="cc-confirm-title">Save this chore?</div>
              <div className="cc-confirm-text">
                You have unsaved changes. Choose Save to keep it, or Discard to close without saving.
              </div>

              <div className="cc-confirm-actions">
                <button type="button" className="cc-confirm-btn" onClick={() => setShowClosePrompt(false)}>
                  Cancel
                </button>
                <button type="button" className="cc-confirm-btn danger" onClick={discardAndClose}>
                  Discard
                </button>
                <button type="button" className="cc-confirm-btn primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
