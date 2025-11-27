import React, { useState, useEffect } from 'react';
import { FiX, FiShield, FiAlertCircle } from 'react-icons/fi'; // Ensure this import is correct
import toast from 'react-hot-toast';
import useAuthStore from '../../store/useAuthStore'; 

// [MODIFIED] Added 'isVisaKanbanEnabled' to core keys
const permissionCategories = {
    core: { title: 'Core Modules', keys: ['isEmployersEnabled', 'isJobsEnabled', 'isVisaKanbanEnabled', 'isBulkImportEnabled'] },
    tracking: { title: 'Tracking Tabs', keys: ['isDocumentsEnabled', 'isVisaTrackingEnabled', 'isFinanceTrackingEnabled', 'isMedicalEnabled', 'isInterviewEnabled', 'isTravelEnabled', 'isHistoryEnabled'] },
    admin: { title: 'Delegation', keys: ['canViewReports', 'canAccessSettings', 'canAccessRecycleBin', 'canDeletePermanently'] }
};

const featureLabels = {
    isEmployersEnabled: 'Employers', isJobsEnabled: 'Job Orders', isDocumentsEnabled: 'Documents',
    isVisaKanbanEnabled: 'Visa Kanban Board',
    isVisaTrackingEnabled: 'Visa Tracking', isFinanceTrackingEnabled: 'Financials', isMedicalEnabled: 'Medical',
    isInterviewEnabled: 'Interviews', isTravelEnabled: 'Travel', isHistoryEnabled: 'History',
    isBulkImportEnabled: 'Bulk Import', canViewReports: 'View Reports', canAccessSettings: 'Settings Access',
    canAccessRecycleBin: 'Recycle Bin', canDeletePermanently: 'Permanent Delete'
};

function UserPermissionsModal({ user, targetUser, onClose }) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Safety check for user store
  const { featureFlags: currentUserFlags } = useAuthStore(state => ({
    featureFlags: state.featureFlags || {} 
  }));

  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      try {
        const res = await window.electronAPI.getUserPermissions({ userId: targetUser.id });
        if (res.success) {
          setPermissions(res.data || {}); 
        } else {
          toast.error(res.error || 'Failed to load permissions.');
        }
      } catch (error) {
        console.error("Permission fetch error:", error);
      }
      setLoading(false);
    };
    if (targetUser?.id) fetchPermissions();
  }, [targetUser]);

  const handleToggle = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await window.electronAPI.saveUserPermissions({ 
        user, 
        userId: targetUser.id, 
        flags: permissions 
    });
    
    if (res.success) {
      toast.success(`Permissions updated for ${targetUser.username}`);
      onClose();
    } else {
      toast.error(res.error || 'Failed to save permissions.');
    }
    setSaving(false);
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '700px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          {/* Ensure FiShield is used as a component */}
          <h3><FiShield /> Manage Permissions: {targetUser.username}</h3>
        </div>
        
        <div className="payment-modal-body" style={{padding: '1.5rem'}}>
            <p className="form-message neutral" style={{marginBottom: '1.5rem'}}>
                <FiAlertCircle /> Toggles below override Global Settings for this user.
            </p>

            {loading ? <p>Loading...</p> : (
                <div className="permissions-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                    {Object.values(permissionCategories).map(cat => (
                        <div key={cat.title} className="perm-category">
                            <h4 style={{fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px', marginBottom: '10px'}}>{cat.title}</h4>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                {cat.keys.map(key => {
                                    
                                    // 1. Admin Ceiling: If I (Admin) don't have it, I can't give it.
                                    if (user.role !== 'super_admin') {
                                        const adminHasPermission = currentUserFlags && currentUserFlags[key];
                                        if (!adminHasPermission) return null; 
                                    }

                                    // 2. Staff Restriction
                                    if (targetUser.role === 'staff' && (cat.title === 'Delegation' || key === 'isBulkImportEnabled')) {
                                        return null; 
                                    }
                                    
                                    return (
                                        <label key={key} style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer'}}>
                                            <input 
                                                type="checkbox" 
                                                checked={!!permissions[key]} 
                                                onChange={() => handleToggle(key)} 
                                            />
                                            {featureLabels[key]}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="btn" onClick={handleSave} disabled={saving || loading}>
                    {saving ? 'Saving...' : 'Save Permissions'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default UserPermissionsModal;