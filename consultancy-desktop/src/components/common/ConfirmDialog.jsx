import React from 'react';
import { FiX, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import './ConfirmDialog.css';

function ConfirmDialog({ 
  isOpen,
  open, // Support both isOpen and open props
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText,
  confirmLabel, // Support both confirmText and confirmLabel
  cancelText,
  cancelLabel, // Support both cancelText and cancelLabel
  isDanger = false
}) {
  // Support both prop naming conventions
  const isDialogOpen = isOpen || open;
  const confirmButtonText = confirmText || confirmLabel || 'Confirm';
  const cancelButtonText = cancelText || cancelLabel || 'Cancel';

  if (!isDialogOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <div className={`confirm-icon ${isDanger ? 'danger' : 'info'}`}>
            <FiAlertTriangle />
          </div>
          <button className="close-btn" onClick={onCancel} type="button">
            <FiX />
          </button>
        </div>
        
        <div className="confirm-body">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
        
        <div className="confirm-actions">
          <button 
            className="btn btn-cancel"
            onClick={onCancel}
            type="button"
          >
            <FiX />
            <span>{cancelButtonText}</span>
          </button>
          <button 
            className={`btn ${isDanger ? 'btn-danger' : 'btn-confirm'}`}
            onClick={onConfirm}
            type="button"
          >
            <FiCheck />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
