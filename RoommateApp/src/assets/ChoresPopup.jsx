import React, { useMemo, useState } from "react";
import "./ChoresComponent.css";

/**
 * ChoresPopup
 *
 * Props:
 * - chore: {
 *     id, title, dueDate, description, peopleAssigned,
 *     repeatBitmask?, roommateName?, ...
 *   }
 * - onClose: () => void
 * - onDelete: (chore, meta) => Promise<void> | void
 *     meta:
 *      - { mode: "abandon", reason: string }
 *      - { mode: "finish", imageFile: File | null }
 */

const DAY_ORDER    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_BIT      = { Mon: 64, Tue: 32, Wed: 16, Thu: 8, Fri: 4, Sat: 2, Sun: 1 };
const WEEKDAY_MASK = 64 | 32 | 16 | 8 | 4;
const WEEKEND_MASK = 2  | 1;
const ALL_MASK     = 127;

function repeatLabel(bitmask) {
  if (!bitmask || bitmask === 0) return null;
  if (bitmask === ALL_MASK)     return "Every day";
  if (bitmask === WEEKDAY_MASK) return "Every weekday";
  if (bitmask === WEEKEND_MASK) return "Weekend";
  return DAY_ORDER.filter((d) => (bitmask & DAY_BIT[d]) !== 0).join(", ");
}

export default function ChoresPopup({ chore, onClose, onDelete }) {
  if (!chore) return null;

  const [flow,          setFlow]          = useState(null); // null | "abandon" | "finish"
  const [abandonReason, setAbandonReason] = useState("");
  const [finishImage,   setFinishImage]   = useState(null);
  const [actionError,   setActionError]   = useState("");
  const [isActing,      setIsActing]      = useState(false);

  const canAct = useMemo(() => typeof onDelete === "function", [onDelete]);

  // ── Action handlers — each calls onDelete exactly once ───────────────────

  const submitAbandon = async () => {
    if (!canAct || isActing) return;
    setActionError("");
    setIsActing(true);
    try {
      console.log("[ChoresPopup] submitAbandon", { choreId: chore.id, reason: abandonReason });
      await Promise.resolve(onDelete(chore, { mode: "abandon", reason: abandonReason }));
      setFlow(null);
      setAbandonReason("");
    } catch (e) {
      console.error("[ChoresPopup] abandon failed:", e);
      setActionError(e?.message || "Abandon failed. Check RLS and console logs.");
    } finally {
      setIsActing(false);
    }
  };

  const submitFinish = async () => {
    if (!canAct || isActing) return;
    setActionError("");
    setIsActing(true);
    try {
      console.log("[ChoresPopup] submitFinish", { choreId: chore.id, hasFile: !!finishImage });
      await Promise.resolve(onDelete(chore, { mode: "finish", imageFile: finishImage }));
      setFlow(null);
      setFinishImage(null);
    } catch (e) {
      console.error("[ChoresPopup] finish failed:", e);
      setActionError(e?.message || "Finish failed. Check RLS and console logs.");
    } finally {
      setIsActing(false);
    }
  };

  const assignedText =
    Array.isArray(chore.peopleAssigned) && chore.peopleAssigned.length > 0
      ? chore.peopleAssigned.join(", ")
      : "Unassigned";

  const repeat = repeatLabel(chore.repeatBitmask);

  return (
    <div className="chore-popup-overlay" role="dialog" aria-modal="true" aria-label="Chore details">
      <div className="chore-popup">
        <button type="button" className="chore-popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h3 className="chore-popup-title">{chore.title || "Untitled chore"}</h3>

        {chore.roommateName && (
          <div className="chore-popup-row">List owner: {chore.roommateName}</div>
        )}

        <div className="chore-popup-row">Due: {chore.dueDate || "No due date"}</div>

        <div className="chore-popup-row">
          Description:
          <div className="chore-popup-description">{chore.description || "No description"}</div>
        </div>
        <div className="chore-popup-row">
          Points:
          <div className="chore-popup-description">{chore.points || "Not provided"}</div>
        </div>
        <div className="chore-popup-row">Assigned to: {assignedText}</div>

        {repeat && (
          <div className="chore-popup-row">
            Repeats: <span className="chore-popup-repeat">🔁 {repeat}</span>
          </div>
        )}

        {actionError && (
          <div className="chore-popup-error" role="alert">{actionError}</div>
        )}

        {/* Actions */}
        <div className="chore-popup-actions" aria-label="Chore actions">
          <button
            type="button"
            className="chore-action-btn danger"
            onClick={() => setFlow("abandon")}
            disabled={!canAct || isActing}
          >
            Abandon Chore
          </button>
          <button
            type="button"
            className="chore-action-btn primary"
            onClick={() => setFlow("finish")}
            disabled={!canAct || isActing}
          >
            Mark as finish
          </button>
        </div>

        {/* Abandon prompt */}
        {flow === "abandon" && (
          <div
            className="chore-action-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-label="Abandon chore"
          >
            <div className="chore-action-card">
              <div className="chore-action-title">Reason to abandon</div>
              <textarea
                className="chore-action-textarea"
                rows={4}
                placeholder="(Optional)"
                value={abandonReason}
                onChange={(e) => setAbandonReason(e.target.value)}
              />
              <div className="chore-action-buttons">
                <button
                  type="button"
                  className="chore-action-small"
                  onClick={() => setFlow(null)}
                  disabled={isActing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="chore-action-small danger"
                  onClick={submitAbandon}
                  disabled={!canAct || isActing}
                >
                  {isActing ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Finish prompt */}
        {flow === "finish" && (
          <div
            className="chore-action-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-label="Finish chore"
          >
            <div className="chore-action-card">
              <div className="chore-action-title">Upload result image</div>
              <input
                className="chore-action-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFinishImage(e.target.files?.[0] || null)}
              />
              <div className="chore-action-hint">(Optional)</div>
              <div className="chore-action-buttons">
                <button
                  type="button"
                  className="chore-action-small"
                  onClick={() => setFlow(null)}
                  disabled={isActing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="chore-action-small primary"
                  onClick={submitFinish}
                  disabled={!canAct || isActing}
                >
                  {isActing ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}