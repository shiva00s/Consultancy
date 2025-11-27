import React, { useState, useEffect } from 'react';
import { FiX, FiShield, FiSave, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

// Reusing the structure definitions
const permissionCategories = {
    core: { title: 'Core Modules', keys: ['isEmployersEnabled', 'isJobsEnabled', 'isBulkImportEnabled'] },
    tracking: { title: 'Tracking Tabs', keys: ['isDocumentsEnabled', 'isVisaTrackingEnabled', 'isFinanceTrackingEnabled', 'isMedicalEnabled', 'isInterviewEnabled', 'isTravelEnabled', 'isHistoryEnabled'] },
    // Only includes delegation rights that an Admin might pass down to Staff
    delegation: { title: 'Delegation', keys: ['canViewReports', 'canAccessRecycleBin'] } 
};

const featureLabels = {
    isEmployersEnabled: 'Employers', isJobsEnabled: 'Job Orders', isDocumentsEnabled: 'Documents',
    isVisaTrackingEnabled: 'Visa Tracking', isFinanceTrackingEnabled: 'Financials', isMedicalEnabled: 'Medical',
    isInterviewEnabled: 'Interviews', isTravelEnabled: 'Travel', isHistoryEnabled: 'History',
    isBulkImportEnabled: 'Bulk Import', canViewReports: 'View Reports', canAccessRecycleBin: 'Recycle Bin'
};


function DelegationModal({ managerFlags, targetUser, onClose }) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      // Fetch custom permissions saved for this specific Staff user
      const res = await window.electronAPI.getUserPermissions({ userId: targetUser.id });
      if (res.success) {
        setPermissions(res.data || {}); 
      } else {
        toast.error(res.error || 'Failed to load user permissions.');
      }
      setLoading(false);
    };
    fetchPermissions();
  }, [targetUser]);

  const handleToggle = (key) => {
    // Standard toggle logic
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Save the Staff user's overridden permissions
    const res = await window.electronAPI.saveUserPermissions({ 
        userId: targetUser.id, 
        flags: permissions 
    });
    
    if (res.success) {
      toast.success(`Permissions delegated for ${targetUser.username}`);
      onClose();
    } else {
      toast.error(res.error || 'Failed to save delegation.');
    }
    setSaving(false);
  };
  
  // CRITICAL LOGIC: Filter toggles based on Manager's (Admin's) access (the CEILING)
  const isToggleAllowed = (key) => {
      // SA can delegate anything (if managerFlags doesn't exist, assume SA)
      if (!managerFlags) return true; 
      
      // If the Manager (Admin) doesn't have the feature enabled, they cannot delegate it.
      return managerFlags[key] === true;
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content payment-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '700px', height: 'fit-content'}}>
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        <div className="viewer-header">
          <h3><FiShield /> Delegate Permissions to: {targetUser.username}</h3>
        </div>
        
        <div className="payment-modal-body" style={{padding: '1.5rem'}}>
            <p className="form-message neutral" style={{marginBottom: '1.5rem'}}>
                <FiAlertCircle /> You can only grant access to features that *you* currently possess.
            </p>

            {loading ? <p>Loading...</p> : (
                <div className="permissions-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                    {Object.values(permissionCategories).map(cat => (
                        <div key={cat.title} className="perm-category">
                            <h4 style={{fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px', marginBottom: '10px'}}>{cat.title}</h4>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                {cat.keys.map(key => {
                                    const allowed = isToggleAllowed(key);
                                    
                                    return (
                                        <label 
                                            key={key} 
                                            style={{display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: allowed ? 'pointer' : 'not-allowed', opacity: allowed ? 1 : 0.5}}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={!!permissions[key]} 
                                                onChange={() => handleToggle(key)} 
                                                disabled={!allowed} // Disable if Admin doesn't have permission
                                            />
                                            {featureLabels[key]} {allowed ? '' : ' (Disabled by Policy)'}
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

export default DelegationModal;