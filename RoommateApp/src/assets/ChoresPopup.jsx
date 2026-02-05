import React, { useMemo, useState } from "react";
import "./ChoresComponent.css";

/**
 * ChoresPopup
 *
 * Props:
 * - chore: {
 *     id, title, dueDate, description, peopleAssigned, roommateName?, ...
 *   }
 * - onClose: () => void
 * - onDelete: (chore, meta) => Promise<void> | void
 *     meta:
 *      - { mode: "abandon", reason: string }
 *      - { mode: "finish", imageFile: File | null }
 *
 * Notes:
 * - "onDelete" is legacy naming from UI; it acts as an action handler.
 * - This component collects a reason/image and forwards them to the handler.
 */
export default function ChoresPopup({ chore, onClose, onDelete }) {
  if (!chore) return null;

  const [flow, setFlow] = useState(null); // null | "abandon" | "finish"
  const [abandonReason, setAbandonReason] = useState("");
  const [finishImage, setFinishImage] = useState(null);
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const canAct = useMemo(() => typeof onDelete === "function", [onDelete]);

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(
      2,
      "0"
    )}-${dt.getFullYear()}`;
  };

  const submitAbandon = async () => {
    if (!canAct) return;
    await Promise.resolve(onDelete(chore, { mode: "abandon", reason: abandonReason }));
    setFlow(null);
    setAbandonReason("");
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
    if (!canAct) return;
    await Promise.resolve(onDelete(chore, { mode: "finish", imageFile: finishImage }));
    setFlow(null);
    setFinishImage(null);
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

        <div className="chore-popup-row">Due: {formatDate(chore.dueDate) || "No due date"}</div>

        <div className="chore-popup-row">
          Description:
          <div className="chore-popup-description">{chore.description || "No description"}</div>
        </div>

        <div className="chore-popup-row">Assigned to: {assignedText}</div>

        {/* Actions */}
        <div className="chore-popup-actions" aria-label="Chore actions">
          <button
            type="button"
            className="chore-action-btn danger"
            onClick={() => setFlow("abandon")}
            disabled={!canAct}
          >
            Abandon Chore
          </button>
          <button
            type="button"
            className="chore-action-btn primary"
            onClick={() => setFlow("finish")}
            disabled={!canAct}
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
                <button type="button" className="chore-action-small" onClick={() => setFlow(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="chore-action-small danger"
                  onClick={submitAbandon}
                  disabled={!canAct}
                >
                  Submit
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
                <button type="button" className="chore-action-small" onClick={() => setFlow(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="chore-action-small primary"
                  onClick={submitFinish}
                  disabled={!canAct}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
