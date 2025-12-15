// FILE: src/components/PermissionPopup.jsx
// ✅ COMPLETE: 3-Column grid for BOTH section list AND sub-permissions

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PERMISSION_GROUPS } from "../config/permissionKeys";
import { FiInfo, FiCheckCircle, FiXCircle, FiChevronDown, FiChevronRight } from "react-icons/fi";
import toast from "react-hot-toast";
import "../css/PermissionPopup.css";

function PermissionPopup({ user, targetUser, onClose, onSave }) {
  const [permissions, setPermissions] = useState({});
  const [granterPermissions, setGranterPermissions] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    loadPermissions();
    // eslint-disable-next-line
  }, [targetUser]);

  useEffect(() => {
    const initialExpanded = {};
    Object.keys(PERMISSION_GROUPS).forEach((key) => {
      initialExpanded[key] = false;
    });
    setExpandedSections(initialExpanded);
  }, []);

  const loadPermissions = async () => {
    setLoading(true);

    try {
      const target = await window.electronAPI.getUserGranularPermissions({
        userId: targetUser.id,
      });
      if (target.success) {
        setPermissions(target.data || {});
      }

      const granter = await window.electronAPI.getGranterPermissions({
        granterId: user.id,
      });

      if (granter.success) {
        setIsSuperAdmin(granter.isSuperAdmin === true);
        setGranterPermissions(granter.data || {});
      }
    } catch (err) {
      console.error("Error loading permissions:", err);
      toast.error("Failed to load permissions");
    }

    setLoading(false);
  };

  const handleToggle = (permKey) => {
    setPermissions((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
    }));
  };

  // ✅ MASTER TOGGLE: Enable/disable all permissions in a group
  const handleMasterToggle = (groupKey, visiblePermissions) => {
    const allEnabled = visiblePermissions.every(
      (perm) => permissions[perm.key] === true
    );

    const updatedPermissions = { ...permissions };
    visiblePermissions.forEach((perm) => {
      if (canGrantPermission(perm.key)) {
        updatedPermissions[perm.key] = !allEnabled;
      }
    });

    setPermissions(updatedPermissions);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
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
    } catch (err) {
      console.error("Error saving permissions:", err);
      toast.error("Failed to save permissions");
    }

    setSaving(false);
  };

  const canGrantPermission = (permKey) => {
    if (isSuperAdmin) return true;
    return granterPermissions?.[permKey] === true;
  };

  const toggleSection = (groupKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    Object.keys(PERMISSION_GROUPS).forEach((key) => {
      allExpanded[key] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = {};
    Object.keys(PERMISSION_GROUPS).forEach((key) => {
      allCollapsed[key] = false;
    });
    setExpandedSections(allCollapsed);
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = Object.values(PERMISSION_GROUPS).reduce(
    (sum, group) => sum + group.permissions.length,
    0
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line
  }, [permissions]);

  const modalContent = (
    <div className="perm-modal-overlay" onClick={onClose}>
      <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="perm-modal-body">
            <div className="perm-loading">
              <div className="perm-spinner"></div>
              <p>Loading permissions...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="perm-modal-header">
              <div>
                <h2>🔒 Access Control</h2>
                <p className="perm-subtitle">
                  Managing permissions for: <strong>{targetUser.username}</strong>
                  <span className="perm-role-badge">{targetUser.role}</span>
                </p>
              </div>
              <button className="perm-close-btn" onClick={onClose} title="Close (Esc)">
                ✕
              </button>
            </div>

            {/* Info Bar */}
            <div className="perm-info-bar">
              <FiInfo className="perm-info-icon" />
              <span>
                <strong>Permission Rules:</strong>
                {isSuperAdmin
                  ? " You can grant any permission (Super Admin)"
                  : " You can only grant permissions that you possess (Admin)"}
              </span>
            </div>

            {/* Stats Bar */}
            <div className="perm-stats-bar">
              <div className="perm-stat">
                <FiCheckCircle className="perm-stat-icon enabled" />
                <span><strong>{enabledCount}</strong> enabled</span>
              </div>
              <div className="perm-stat">
                <FiXCircle className="perm-stat-icon disabled" />
                <span><strong>{totalCount - enabledCount}</strong> disabled</span>
              </div>

              <div className="perm-expand-controls">
                <button className="perm-expand-btn" onClick={expandAll}>
                  Expand All
                </button>
                <button className="perm-expand-btn" onClick={collapseAll}>
                  Collapse All
                </button>
              </div>
            </div>

            {/* ✅ PERMISSIONS GRID - 3 COLUMNS FOR SECTIONS */}
            <div className="perm-modal-body">
              <div className="perm-sections-grid">
                {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
                  const visiblePermissions = group.permissions.filter((perm) => {
                    if (isSuperAdmin) return true;
                    return granterPermissions[perm.key] === true;
                  });

                  if (visiblePermissions.length === 0) return null;

                  const isExpanded = expandedSections[groupKey];
                  const enabledInGroup = visiblePermissions.filter(
                    (perm) => permissions[perm.key] === true
                  ).length;
                  const allEnabled = enabledInGroup === visiblePermissions.length;

                  return (
                    <section key={groupKey} className="perm-section-card">
                      {/* Section Header with Master Toggle */}
                      <div className="perm-section-header-wrapper">
                        <div
                          className="perm-section-header clickable"
                          onClick={() => toggleSection(groupKey)}
                        >
                          <div className="perm-section-title">
                            {isExpanded ? (
                              <FiChevronDown className="perm-chevron" />
                            ) : (
                              <FiChevronRight className="perm-chevron" />
                            )}
                            <h3>{group.title}</h3>
                            <span className="perm-section-count">{visiblePermissions.length}</span>
                          </div>
                          <div className="perm-section-meta">
                            <span className="perm-section-enabled">
                              {enabledInGroup} / {visiblePermissions.length} enabled
                            </span>
                            {group.description && (
                              <p className="perm-section-desc">{group.description}</p>
                            )}
                          </div>
                        </div>

                        {/* ✅ MASTER TOGGLE BUTTON */}
                        <button
                          type="button"
                          className={`perm-master-toggle ${allEnabled ? "on" : "off"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMasterToggle(groupKey, visiblePermissions);
                          }}
                          title={allEnabled ? "Disable all" : "Enable all"}
                        >
                          <span className="perm-toggle-knob" />
                        </button>
                      </div>

                      {/* Collapsible Content - Sub-permissions in 3 columns */}
                      {isExpanded && (
                        <div className="perm-section-content perm-grid-3">
                          {visiblePermissions.map((perm) => {
                            const enabled = permissions[perm.key] === true;
                            const canGrant = canGrantPermission(perm.key);

                            return (
                              <div
                                key={perm.key}
                                className={`perm-grid-item ${!canGrant ? "perm-item-disabled" : ""}`}
                              >
                                <div className="perm-item-content">
                                  <span className="perm-icon">{perm.icon}</span>
                                  <span className="perm-label" title={perm.description}>
                                    {perm.label}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className={`perm-toggle-mini ${enabled ? "on" : "off"} ${
                                    !canGrant ? "toggle-disabled" : ""
                                  }`}
                                  onClick={() => canGrant && handleToggle(perm.key)}
                                  disabled={!canGrant}
                                  title={enabled ? "Disable" : "Enable"}
                                >
                                  <span className="perm-toggle-knob-mini" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="perm-modal-footer">
              <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <span className="perm-footer-hint">
                <kbd>Esc</kbd> to close • <kbd>Ctrl+Enter</kbd> to save
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default PermissionPopup;
