import React from 'react';
import '../css/ConfirmDialog.css';

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('confirm-backdrop')) {
      onCancel && onCancel();
    }
  };

  return (
    <div className="confirm-backdrop" onClick={handleBackdropClick}>
      <div className="confirm-card" role="dialog" aria-modal="true">
        <h3 className="confirm-title">
          <span className="emoji-inline" aria-hidden="true">
            ⚠️
          </span>
          {title}
        </h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="btn-outline"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
