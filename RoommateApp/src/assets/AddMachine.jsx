import React, { useRef, useState } from "react";
import "./AddMachine.css";

export default function AddMachine({ open, onClose, onSave }) {
  const [name, setName] = useState("");
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setName("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePick = () => {
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ""));
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, image });
    reset();
  };

  return (
    <div className="am-overlay" role="dialog" aria-modal="true">
      <div className="am-card">
        <button type="button" className="am-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        <div className="am-title">Adding Machine</div>

        <input
          className="am-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Washer"
        />

        <div className="am-upload" onClick={handlePick} role="button" tabIndex={0}>
          <div className="am-upload-text">Upload image of the machine</div>
          <div className="am-upload-preview">
            {image ? (
              <img src={image} alt="Machine preview" />
            ) : (
              <div className="am-upload-icon" aria-hidden="true" />
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />

        <div className="am-actions">
          <button type="button" className="am-save" onClick={handleSave} disabled={!name.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
