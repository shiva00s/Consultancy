import React, { useState, useEffect } from 'react';
import { FiInfo, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/PermissionPopup.css';

const ADMIN_DEFAULT_PERMISSIONS = {
  // Core Modules
  'core.candidate.search': true,
  'core.candidate.add': true,
  'core.bulk_import': false,
  'core.employers': false,
  'core.job_orders': false,
  'core.visa_board': true,

  // Tracking Tabs
  'tab.profile': true,
  'tab.passport': true,
  'tab.documents': true,
  'tab.job_placements': false,
  'tab.visa_tracking': true,
  'tab.financial': false,
  'tab.medical': false,
  'tab.interview': false,
  'tab.travel': false,
  'tab.offer_letter': false,
  'tab.history': true,
  'tab.comms_log': false,

  // Settings Tabs
  'settings.users': true,
  'settings.required_docs': false,
  'settings.email': false,
  'settings.templates': false,
  'settings.mobile_app': false,
  'settings.backup': false,

  // System Access
  'access.view_reports': true,
  'access.audit_log': false,
  'access.modules': false,
  'access.recycle_bin': false,
};

function PermissionPopup({ user, targetUser, onClose, onSave }) {
  const [modules, setModules] = useState([]);
  const [localPerms, setLocalPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // 1) Which modules can the granter see?
      const modsRes = await window.electronAPI.getEffectivePermissions({
        userId: user.id,
        userRole: user.role,
      });

      // 2) Existing granular perms for target user
      const permRes = await window.electronAPI.getUserGranularPermissions({
        userId: targetUser.id,
      });

      if (!modsRes.success) {
        toast.error(modsRes.error || 'Failed to load modules');
        setLoading(false);
        return;
      }
      if (!permRes.success) {
        toast.error(permRes.error || 'Failed to load permissions');
        setLoading(false);
        return;
      }

      setModules(modsRes.data || []);

      const fetched = permRes.data || {};
      if (targetUser.role === 'admin') {
        setLocalPerms({ ...ADMIN_DEFAULT_PERMISSIONS, ...fetched });
      } else {
        setLocalPerms(fetched);
      }

      setLoading(false);
    };

    loadData();
  }, [user.id, user.role, targetUser.id, targetUser.role]);

  const canGrantPermission = (moduleKey) => {
    // Granter can only give what they themselves effectively have
    return modules.some(m => m.module_key === moduleKey);
  };

  const handleToggle = (moduleKey) => {
    setLocalPerms(prev => ({
      ...prev,
      [moduleKey]: !prev[moduleKey],
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
      onClose();
    } else {
      toast.error(res.error || 'Failed to update permissions');
    }
  };

  if (loading) {
    return (
      <div className="perm-modal-overlay" onClick={onClose}>
        <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="perm-modal-header">
            <h2>Access Control</h2>
          </div>
          <div className="perm-modal-body">
            <p>Loading permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  const coreModules = modules.filter(m => m.module_type === 'core');
  const trackingTabs = modules.filter(m => m.module_type === 'tracking');
  const settingsTabs = modules.filter(m => m.module_type === 'settings');
  const systemAccess = modules.filter(m => m.module_type === 'system');

  const renderGroup = (title, items) => (
    <section className="perm-section-card">
      <div className="perm-section-header">
        <h3>{title}</h3>
      </div>
      <div className="perm-section-content">
        {items.map(m => {
          const enabled = localPerms[m.module_key] === true;
          const canGrant = canGrantPermission(m.module_key);
          return (
            <div
              key={m.module_key}
              className={`perm-row ${!canGrant ? 'perm-row-disabled' : ''}`}
            >
              <div className="perm-row-text">
                <span className="perm-label">{m.module_name}</span>
              </div>
              <div className="perm-row-controls">
                {!canGrant && (
                  <span
                    className="perm-lock-hint"
                    title="You don't have this permission"
                  >
                    <FiLock />
                  </span>
                )}
                <button
                  type="button"
                  className={`perm-toggle ${enabled ? 'on' : 'off'} ${!canGrant ? 'toggle-disabled' : ''}`}
                  onClick={() => canGrant && handleToggle(m.module_key)}
                  disabled={!canGrant}
                >
                  <span className="perm-toggle-knob" />
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="perm-empty-text">No items in this group.</p>
        )}
      </div>
    </section>
  );

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

        {/* Info bar */}
        <div className="perm-info-bar">
          <FiInfo className="perm-info-icon" />
          <span>
            You can only grant access to features that you currently possess.
          </span>
        </div>

        {/* Body */}
        <div className="perm-modal-body">
          {renderGroup('Core Modules', coreModules)}
          {renderGroup('Tracking Tabs', trackingTabs)}
          {renderGroup('Settings Tabs', settingsTabs)}
          {renderGroup('System Access', systemAccess)}
        </div>

        {/* Footer */}
        <div className="perm-modal-footer">
          {isSuperAdmin && targetUser.role === 'admin' && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setLocalPerms(ADMIN_DEFAULT_PERMISSIONS);
                toast.success('Reset to Admin default permissions');
              }}
              style={{ marginRight: 'auto' }}
            >
              Reset to Admin Defaults
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionPopup;
