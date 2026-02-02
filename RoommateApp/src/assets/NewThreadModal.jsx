import React, { useEffect, useState } from "react";
import "./NewThreadModal.css";

export default function NewThreadModal({ open, onClose, onCreate, prefillBody = "" }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(prefillBody);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody(prefillBody || "");
  }, [open, prefillBody]);

  if (!open) return null;

  const create = () => {
    const b = body.trim();
    if (!b) return;
    onCreate({ title, body: b });
  };

  return (
    <div className="nt-overlay" role="dialog" aria-modal="true" aria-label="Create new discussion thread">
      <div className="nt-card">
        <button type="button" className="nt-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="nt-title">New Discussion</div>

        <input
          className="nt-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />

        <textarea
          className="nt-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue..."
          rows={5}
        />

        <div className="nt-actions">
          <button type="button" className="nt-btn" onClick={create} disabled={!body.trim()}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
