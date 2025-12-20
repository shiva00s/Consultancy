import React, { useRef, useEffect } from "react";
import { FiX } from "react-icons/fi";
import "./ConfirmDialog.css";

/**
 * ✨ Universal Confirm Dialog Component
 * 
 * Features:
 * - Danger/Info modes with dynamic styling
 * - Emoji icons for better UX
 * - Backdrop overlay with click-outside-to-close
 * - Responsive design
 * - Accessibility support (role, aria-modal)
 * - Multiple prop name support for backward compatibility
 * 
 * Used across all tabs:
 * - Documents (delete confirmations)
 * - Visa (stage delete, application delete)
 * - Finance (payment delete, refund confirmations)
 * - Medical (record delete)
 * - Interview (schedule delete)
 * - Jobs (placement delete)
 * - Passport (movement delete)
 * - Travel (booking delete)
 */

function ConfirmDialog({
  // Primary visibility props
  isOpen,
  open, // backward compatibility
  
  // Content props
  title = "Please Confirm",
  message = "Are you sure you want to continue?",
  
  // Action handlers
  onConfirm,
  onCancel,
  
  // Button text (multiple names for compatibility)
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  
  // Styling mode
  isDanger = false,
  type, // alternative: "danger" | "warning" | "info"
  
  // Additional customization
  confirmIcon = "✅",
  cancelIcon = "❌",
  icon, // custom icon override
}) {
  // Determine visibility
  const visible = isOpen || open;

  // Ref for the dialog so we can focus/scroll it into view when opened
  const dialogRef = useRef(null);

  useEffect(() => {
    if (visible && dialogRef.current) {
      try {
        // Focus for accessibility and to bring into view
        dialogRef.current.focus({ preventScroll: true });
        // Ensure dialog is visible in the current scrolling context
        dialogRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
      } catch (e) {
        // ignore
      }
    }
  }, [visible]);

  // Determine danger mode
  const dangerMode = isDanger || type === "danger" || type === "warning";

  // Button labels
  const confirmBtnText = confirmText || confirmLabel || "Confirm";
  const cancelBtnText = cancelText || cancelLabel || "Cancel";

  // Icon selection
  const displayIcon = icon || (dangerMode ? "⚠️" : "ℹ️");

  if (!visible) return null;

  return (
    <div 
      className="confirm-overlay" 
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
      >
        {/* HEADER */}
        <div className="confirm-header">
          <div
            className={`confirm-icon ${dangerMode ? "danger" : "info"}`}
            aria-hidden="true"
          >
            {displayIcon}
          </div>

          <button
            className="close-btn"
            onClick={onCancel}
            type="button"
            title="Close dialog"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        {/* BODY */}
        <div className="confirm-body">
          <h3 id="confirm-dialog-title">
            {dangerMode ? "⚠️ " : "✨ "}
            {title}
          </h3>
          <p id="confirm-dialog-description">{message}</p>
        </div>

        {/* ACTIONS */}
        <div className="confirm-actions">
          <button
            className="btn btn-cancel"
            onClick={onCancel}
            type="button"
            aria-label="Cancel action"
          >
            <span className="btn-icon">{cancelIcon}</span>
            <span className="btn-text">{cancelBtnText}</span>
          </button>

          <button
            className={`btn ${dangerMode ? "btn-danger" : "btn-confirm"}`}
            onClick={onConfirm}
            type="button"
            aria-label={`${confirmBtnText} action`}
            autoFocus
          >
            <span className="btn-icon">{confirmIcon}</span>
            <span className="btn-text">{confirmBtnText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
