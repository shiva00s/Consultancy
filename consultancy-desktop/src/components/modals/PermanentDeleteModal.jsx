import React, { useState } from "react";
import { FiX, FiAlertTriangle, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import "../../css/PermanentDeleteModal.css";
import useNotificationStore from '../../store/useNotificationStore';

function PermanentDeleteModal({ user, item, targetType, onClose, onPermanentDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const createNotification = useNotificationStore((s) => s.createNotification);

  const displayName =
    item.name ||
    item.companyName ||
    item.positionTitle ||
    item.candidateName ||
    item.passportNumber ||
    "Unknown";

  const displayType = targetType
    ? targetType.replace("_", " ").replace(/s$/, "")
    : "item";

  const handleDelete = async () => {
    setIsDeleting(true);

    const res = await window.electronAPI.deletePermanently({
      user,
      id: item.id,
      targetType,
    });

    if (res.success) {
      onPermanentDelete(item.id);
      toast.success(
        `${displayType} "${displayName}" permanently deleted.`,
        { duration: 3000 }
      );
      try {
        createNotification({
          title: '❌ Permanently deleted',
          message: `${displayType} "${displayName}" permanently deleted by ${user?.name || user?.username}`,
          type: 'critical',
          priority: 'high',
          actor: { id: user?.id, name: user?.name || user?.username },
          target: { type: targetType || 'item', id: item.id },
          meta: { displayName },
        });
      } catch (e) {}
      onClose();
    } else {
      toast.error(
        res.error || `Failed to permanently delete ${displayType}.`,
        { duration: 5000 }
      );
    }
    setIsDeleting(false);
  };

  return (
    <div className="perm-delete-backdrop" onClick={onClose}>
      <div
        className="perm-delete-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close */}
        <button className="perm-delete-close" onClick={onClose}>
          <FiX />
        </button>

        {/* icon */}
        <div className="perm-delete-icon-wrap">
          <div className="perm-delete-icon">
            <FiAlertTriangle />
          </div>
        </div>

        {/* text */}
        <h2 className="perm-delete-title">Permanently delete?</h2>
        <p className="perm-delete-subtitle">
          This action <strong>cannot be undone</strong>. The record below will
          be removed from the system forever.
        </p>

        {/* info card */}
        <div className="perm-delete-info-card">
          <div className="info-row">
            <span className="info-label">Type</span>
            <span className="info-value">{displayType}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Name</span>
            <span className="info-value">{displayName}</span>
          </div>
        </div>

        {/* actions */}
        <div className="perm-delete-actions">
          <button
            type="button"
            className="btn-perm-delete"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              "Deleting…"
            ) : (
              <>
                <FiTrash2 /> Yes, delete forever
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-perm-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermanentDeleteModal;
