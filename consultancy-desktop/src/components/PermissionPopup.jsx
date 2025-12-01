import React, { useState, useEffect } from "react";
import { PERMISSION_GROUPS } from "../config/permissionKeys";
import { FiInfo, FiLock } from "react-icons/fi";
import toast from "react-hot-toast";
import "../css/PermissionPopup.css";

function PermissionPopup({ user, targetUser, onClose, onSave }) {
  const [permissions, setPermissions] = useState({});
  const [granterPermissions, setGranterPermissions] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
    // eslint-disable-next-line
  }, [targetUser]);

  const loadPermissions = async () => {
    setLoading(true);

    // Get target user's existing permissions
    const target = await window.electronAPI.getUserGranularPermissions({
      userId: targetUser.id,
    });
    if (target.success) setPermissions(target.data || {});

    // Get granter (logged-in user) own permission capabilities
    const granter = await window.electronAPI.getGranterPermissions({
      granterId: user.id,
    });

    if (granter.success) {
      setIsSuperAdmin(granter.isSuperAdmin === true);
      setGranterPermissions(granter.data || {});
    }

    setLoading(false);
  };

  const handleToggle = (permKey) => {
    setPermissions((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  };

  const handleSave = async () => {
    const result = await window.electronAPI.setUserGranularPermissions({
      granterId: user.id,
      targetUserId: targetUser.id,
      permissions,
    });

    if (result.success) {
      toast.success("Permissions saved successfully");
      onSave?.();
      onClose();
    } else {
      toast.error(result.error || "Failed to save permissions");
    }
  };

  // SUPERADMIN RULE:
  // - SuperAdmin can grant ALL permissions
  // ADMIN RULE:
  // - Admin can grant ONLY permissions they already have
  const canGrantPermission = (permKey) => {
    if (isSuperAdmin) return true;
    return granterPermissions?.[permKey] === true;
  };

  if (loading) {
    return (
      <div className="perm-modal-overlay">
        <div className="perm-modal">
          <div className="perm-modal-body">
            <p>Loading permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="perm-modal-overlay" onClick={onClose}>
      <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="perm-modal-header">
          <div>
            <h2>Access Control</h2>
            <p className="perm-subtitle">
              Managing permissions for: <strong>{targetUser.username}</strong>
            </p>
          </div>
          <button className="perm-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Info */}
        <div className="perm-info-bar">
          <FiInfo className="perm-info-icon" />
          <span>
            You can only grant access to permissions that you currently possess.
          </span>
        </div>

        {/* Permissions */}
        <div className="perm-modal-body">
          {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
            <section key={groupKey} className="perm-section-card">
              <div className="perm-section-header">
                <h3>{group.title}</h3>
              </div>

              <div className="perm-section-content">
                {group.permissions.map((perm) => {
    const enabled = permissions[perm.key] === true;
    const canGrant = canGrantPermission(perm.key);

    // NEW RULE:
    // If NOT SuperAdmin AND granter does NOT have this permission → HIDE
    if (!isSuperAdmin && !granterPermissions[perm.key]) {
        return null; // completely hide this permission row
    }

    return (
        <div
            key={perm.key}
            className={`perm-row ${!canGrant ? "perm-row-disabled" : ""}`}
        >
            <div className="perm-row-text">
                <span className="perm-label">{perm.label}</span>
            </div>

            <div className="perm-row-controls">
                {!canGrant && (
                    <span className="perm-lock-hint">
                        <FiLock />
                    </span>
                )}

                <button
                    type="button"
                    className={`perm-toggle ${
                        enabled ? "on" : "off"
                    } ${!canGrant ? "toggle-disabled" : ""}`}
                    onClick={() => canGrant && handleToggle(perm.key)}
                    disabled={!canGrant}
                >
                    <span className="perm-toggle-knob" />
                </button>
            </div>
        </div>
    );
})}

              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="perm-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionPopup;
