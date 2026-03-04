import React, { useEffect, useMemo, useRef, useState } from "react";
import "./create-chores.css";

/**
 * Day order: Mon=bit6, Tue=bit5, Wed=bit4, Thu=bit3, Fri=bit2, Sat=bit1, Sun=bit0
 *
 * Bitmask positions (MSB → LSB):
 *   Mon  Tue  Wed  Thu  Fri  Sat  Sun
 *    64   32   16    8    4    2    1
 *
 * Examples:
 *   Mon only          → 1000000 (64)
 *   Every weekday     → 1111100 (124)
 *   Every day         → 1111111 (127)
 */

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Each day's bit value (Mon is MSB = 64)
const DAY_BIT = {
  Mon: 64,
  Tue: 32,
  Wed: 16,
  Thu:  8,
  Fri:  4,
  Sat:  2,
  Sun:  1,
};

/** Convert a Set of day strings → 7-bit bitmask integer */
function daysToBitmask(daySet) {
  return DAY_ORDER.reduce((mask, day) => {
    return daySet.has(day) ? mask | DAY_BIT[day] : mask;
  }, 0);
}

/** Convert 7-bit bitmask integer → array of day strings */
function bitmaskToDays(mask) {
  return DAY_ORDER.filter((day) => (mask & DAY_BIT[day]) !== 0);
}

/** Pretty-print selected days; collapse to "Every day" / "Weekdays" / "Weekends" when appropriate */
function summariseDays(daySet) {
  if (daySet.size === 0) return "No repeat selected";
  if (daySet.size === 7) return "Every day";

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekend  = ["Sat", "Sun"];
  if (weekdays.every((d) => daySet.has(d)) && weekend.every((d) => !daySet.has(d)))
    return "Every weekday";
  if (weekend.every((d) => daySet.has(d)) && weekdays.every((d) => !daySet.has(d)))
    return "Weekends";

  // Otherwise list in order
  return DAY_ORDER.filter((d) => daySet.has(d)).join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateChores({ isOpen, roommates = [], onCreate, onClose }) {
  const assignablePeople = useMemo(() => {
    const names = roommates.map((r) => r.name);
    return Array.from(new Set(["You", ...names]));
  }, [roommates]);

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [assignedTo,  setAssignedTo]  = useState([]);

  // Use a Set for O(1) toggle lookups
  const [selectedDays, setSelectedDays] = useState(new Set());

  const [errors,          setErrors]          = useState({});
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showClosePrompt,  setShowClosePrompt]  = useState(false);
  const [isSaving,         setIsSaving]         = useState(false);

  const dateInputRef = useRef(null);

  // ── Reset when modal opens ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedTo([]);
    setSelectedDays(new Set());
    setErrors({});
    setShowAssignPicker(false);
    setShowClosePrompt(false);
    setIsSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty =
    title.trim() ||
    description.trim() ||
    dueDate ||
    assignedTo.length > 0 ||
    selectedDays.size > 0;

  // ── Derived bitmask (recomputed on every render, cheap) ───────────────────
  const repeatBitmask = daysToBitmask(selectedDays);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const toggleAssigned = (name) => {
    setAssignedTo((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };

  const openNativeDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else { el.focus(); el.click(); }
  };

  const validate = () => {
    const next = {};
    if (!title.trim())    next.title     = "Chore title is required.";
    if (!dueDate)         next.dueDate   = "Expected finish time is required.";
    if (!assignedTo.length) next.assignedTo = "Assign at least one person.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onRequestClose = () => {
    if (!isDirty) { onClose?.(); return; }
    setShowClosePrompt(true);
  };

  const discardAndClose = () => { setShowClosePrompt(false); onClose?.(); };

  const handleSave = async () => {
    setErrors({});
    if (!validate()) return;
    console.log(assignedTo);
    const payload = {
      title:          title.trim(),
      description:    description.trim(),
      dueDate,
      peopleAssigned: assignedTo, //for chores widget
      // Human-readable array kept for UI display elsewhere
      repeatDays:     bitmaskToDays(selectedDays),
      // Bitmask integer for database storage
      repeatBitmask,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cc-overlay" role="dialog" aria-modal="true" aria-label="Create chore">
      <div className="cc-sheet">
        <button type="button" className="cc-close" aria-label="Close" onClick={onRequestClose}>
          ×
        </button>

        <div className="cc-content">

          {/* Title */}
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

          {/* Description */}
          <div className="cc-field">
            <label className="cc-label">Description (optional)</label>
            <textarea
              className="cc-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={4}
            />
          </div>

          {/* Due date */}
          <div className="cc-field cc-row">
            <div className="cc-row-left">
              <label className="cc-label">Expected finish time</label>
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
              <button type="button" className="cc-calendar-pill" onClick={openNativeDatePicker} aria-label="Open calendar">
                Calendar
              </button>
            </div>
          </div>

          {/* Assign to */}
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

          {/* ── Repeat (bitmask) ── */}
          <div className="cc-field">
            <label className="cc-label">Repeat (optional)</label>

            <div className="cc-repeat">
              {/* Day toggle pills */}
              <div className="cc-repeat-days" role="group" aria-label="Repeat days">
                {DAY_ORDER.map((day) => {
                  const active = selectedDays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`cc-day ${active ? "cc-day-on" : ""}`}
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      aria-label={`${active ? "Remove" : "Add"} ${day}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Summary row */}
              <div className="cc-repeat-summary">
                <span className="cc-repeat-text">
                  {summariseDays(selectedDays)}
                </span>
                {/* Show bitmask value as subtle hint when any day selected */}
                {selectedDays.size > 0 && (
                  <span className="cc-repeat-bitmask" title="Bitmask value stored in DB">
                    {repeatBitmask.toString(2).padStart(7, "0")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {errors.backend && <div className="cc-error cc-error-wide">{errors.backend}</div>}

          <div className="cc-actions">
            <button type="button" className="cc-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save"}
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
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
