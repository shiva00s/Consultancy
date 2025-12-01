import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

// Default granular permissions for Admin users
const ADMIN_DEFAULT_PERMISSIONS = {
  // Core Modules
  core_search: true,
  core_add_candidate: true,
  core_bulk_import: false,
  core_employers: false,
  core_jobs: false,
  core_visa_board: true,

  // Tracking Tabs
  tab_profile: true,
  tab_passport: true,
  tab_documents: true,
  tab_job_placements: false,
  tab_visa_tracking: true,
  tab_financial: false,
  tab_medical: false,
  tab_interview: false,
  tab_travel: false,
  tab_offer_letter: false,
  tab_history: true,
  tab_comms_log: false,

  // Settings Tabs
  tab_users: true,
  tab_required_docs: false,
  tab_email: false,
  tab_templates: false,
  tab_mobile_app: false,
  tab_backup: false,

  // System Access
  access_view_reports: true,
  access_audit_log: false,
  access_modules: false,
  access_recycle_bin: false,
};

function PermissionPopup({ user, targetUser, onClose, onSave }) {
  const [localPerms, setLocalPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    const loadPerms = async () => {
      setLoading(true);
      const res = await window.electronAPI.getUserGranularPermissions({
        userId: targetUser.id,
      });

      if (res.success) {
        const fetched = res.data || {};
        // Apply Admin defaults when editing an Admin
        if (targetUser.role === 'admin') {
          setLocalPerms({
            ...ADMIN_DEFAULT_PERMISSIONS,
            ...fetched,
          });
        } else {
          setLocalPerms(fetched);
        }
      } else {
        toast.error(res.error || 'Failed to load permissions');
      }
      setLoading(false);
    };

    loadPerms();
  }, [targetUser]);

  const togglePerm = (key) => {
    setLocalPerms((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await window.electronAPI.setUserGranularPermissions({
      granterId: user.id,
      targetUserId: targetUser.id,
      permissions: localPerms,
    });

    setSaving(false);

    if (res.success) {
      toast.success('Permissions updated');
      onSave && onSave();
    } else {
      toast.error(res.error || 'Failed to update permissions');
    }
  };

  const handleResetToAdminDefaults = () => {
    setLocalPerms(ADMIN_DEFAULT_PERMISSIONS);
    toast.success('Reset to Admin default permissions');
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card large">
        <div className="modal-header">
          <h3>Managing permissions for: {targetUser.username}</h3>
          <button className="icon-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <p className="modal-subtext">
          You can only grant access to features that you currently possess.
        </p>

        {/* Example toggle groups – use your existing layout here */}
        <div className="permission-section">
          <h4>Core Modules</h4>
          <div className="toggle-row">
            <label>Candidate Search</label>
            <input
              type="checkbox"
              checked={!!localPerms.core_search}
              onChange={() => togglePerm('core_search')}
            />
          </div>
          <div className="toggle-row">
            <label>Add New Candidate</label>
            <input
              type="checkbox"
              checked={!!localPerms.core_add_candidate}
              onChange={() => togglePerm('core_add_candidate')}
            />
          </div>
          <div className="toggle-row">
            <label>Bulk Import</label>
            <input
              type="checkbox"
              checked={!!localPerms.core_bulk_import}
              onChange={() => togglePerm('core_bulk_import')}
            />
          </div>
          {/* ...keep all your other toggle rows, wired to localPerms[...] ... */}
        </div>

        <div className="modal-footer">
          {isSuperAdmin && targetUser.role === 'admin' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetToAdminDefaults}
              style={{ marginRight: 'auto' }}
            >
              Reset to Admin Defaults
            </button>
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionPopup;
