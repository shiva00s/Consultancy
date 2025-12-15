// src/components/modals/RestoreConfirmModal.jsx
import React from "react";
import { FiRotateCcw, FiX } from "react-icons/fi";
import "../../css/RestoreConfirmModal.css";

function RestoreConfirmModal({ open, title, description, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="restore-backdrop" onClick={onCancel}>
      <div
        className="restore-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="restore-close" onClick={onCancel}>
          <FiX />
        </button>

        <div className="restore-icon-wrap">
          <div className="restore-icon">
            <FiRotateCcw />
          </div>
        </div>

        <h2 className="restore-title">{title}</h2>
        <p className="restore-subtitle">{description}</p>

        <div className="restore-actions">
          <button className="btn-restore-primary" onClick={onConfirm}>
            <FiRotateCcw />
            Restore
          </button>
          <button className="btn-restore-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default RestoreConfirmModal;
