import React, { useRef, useState } from "react";
import "./AddMachine.css";

export default function AddMachine({ open, onClose, onSave }) {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  if (!open) return null;

  const reset = () => {
    setName("");
    setImageFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, imageFile });
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

        {/* Upload from gallery */}
        <div className="am-upload" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
          <div className="am-upload-text">📁 Upload image from gallery</div>
          <div className="am-upload-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Machine preview" />
            ) : (
              <div className="am-upload-icon" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Take a photo */}
        <div
          className="am-upload"
          style={{ marginTop: 8 }}
          onClick={() => cameraRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <div className="am-upload-text">📷 Take a photo</div>
          <div className="am-upload-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Machine preview" />
            ) : (
              <div className="am-upload-icon" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
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