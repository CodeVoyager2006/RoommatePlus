import React, { useMemo, useState } from "react";
import "./ChoresComponent.css";

/**
 * ChoresPopup
 * Delete flows:
 *  - Abandon Chore: prompt reason -> submit -> delete
 *  - Mark as finish: prompt image -> submit -> delete
 *
 * For now: we only delete the chore. Reason/image are collected for UI only.
 */
export default function ChoresPopup({ chore, onClose, onDelete }) {
  if (!chore) return null;

  const [flow, setFlow] = useState(null); // null | "abandon" | "finish"
  const [abandonReason, setAbandonReason] = useState("");
  const [finishImage, setFinishImage] = useState(null);

  const formatDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(
      2,
      "0"
    )}-${dt.getFullYear()}`;
  };

  const canDelete = useMemo(() => typeof onDelete === "function", [onDelete]);

  const submitAbandon = () => {
    if (!canDelete) return;
    onDelete(chore, { mode: "abandon", reason: abandonReason });
    setFlow(null);
  };

  const submitFinish = () => {
    if (!canDelete) return;
    onDelete(chore, { mode: "finish", imageFile: finishImage });
    setFlow(null);
  };

  return (
    <div className="chore-popup-overlay" role="dialog" aria-modal="true" aria-label="Chore details">
      <div className="chore-popup">
        <button type="button" className="chore-popup-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h3 className="chore-popup-title">{chore.title}</h3>

        {chore.roommateName && <div className="chore-popup-row">List owner: {chore.roommateName}</div>}

        <div className="chore-popup-row">Due: {formatDate(chore.dueDate)}</div>

        <div className="chore-popup-row">
          Description:
          <div className="chore-popup-description">{chore.description || ""}</div>
        </div>

        <div className="chore-popup-row">Assigned to: {chore.peopleAssigned?.join(", ")}</div>

        {/* Delete actions */}
        <div className="chore-popup-actions" aria-label="Chore actions">
          <button
            type="button"
            className="chore-action-btn danger"
            onClick={() => setFlow("abandon")}
            disabled={!canDelete}
          >
            Abandon Chore
          </button>
          <button
            type="button"
            className="chore-action-btn primary"
            onClick={() => setFlow("finish")}
            disabled={!canDelete}
          >
            Mark as finish
          </button>
        </div>

        {/* Abandon prompt */}
        {flow === "abandon" && (
          <div className="chore-action-overlay" role="alertdialog" aria-modal="true" aria-label="Abandon chore">
            <div className="chore-action-card">
              <div className="chore-action-title">Reason to abandon</div>
              <textarea
                className="chore-action-textarea"
                rows={4}
                placeholder="(Optional for now)"
                value={abandonReason}
                onChange={(e) => setAbandonReason(e.target.value)}
              />
              <div className="chore-action-buttons">
                <button type="button" className="chore-action-small" onClick={() => setFlow(null)}>
                  Cancel
                </button>
                <button type="button" className="chore-action-small danger" onClick={submitAbandon}>
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Finish prompt */}
        {flow === "finish" && (
          <div className="chore-action-overlay" role="alertdialog" aria-modal="true" aria-label="Finish chore">
            <div className="chore-action-card">
              <div className="chore-action-title">Upload result image</div>
              <input
                className="chore-action-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFinishImage(e.target.files?.[0] || null)}
              />
              <div className="chore-action-hint">(Optional for now)</div>
              <div className="chore-action-buttons">
                <button type="button" className="chore-action-small" onClick={() => setFlow(null)}>
                  Cancel
                </button>
                <button type="button" className="chore-action-small primary" onClick={submitFinish}>
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
