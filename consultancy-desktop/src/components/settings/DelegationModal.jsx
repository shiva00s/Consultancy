import React, { useState, useEffect } from 'react';
import { FiX, FiShield, FiSave, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

// ========================================================================
// ENHANCED PERMISSION STRUCTURE
// ========================================================================
const permissionCategories = {
    core: { 
        title: 'Core Modules', 
        keys: ['isEmployersEnabled', 'isJobsEnabled', 'isBulkImportEnabled'] 
    },
    
    tracking: { 
        title: 'Tracking Tabs', 
        keys: [
            'isDocumentsEnabled', 
            'isVisaTrackingEnabled', 
            'isFinanceTrackingEnabled', 
            'isMedicalEnabled', 
            'isInterviewEnabled', 
            'isTravelEnabled', 
            'isHistoryEnabled'
        ] 
    },
    
    // === NEW: All CandidateDetailPage Tabs ===
    candidateTabs: {
        title: 'Candidate Detail Tabs',
        keys: [
            'canAccessPassportTab',      // Passport Tracking
            'canAccessDocumentsTab',      // Documents (linked to isDocumentsEnabled)
            'canAccessJobsTab',           // Job Placements (linked to isJobsEnabled)
            'canAccessVisaTab',           // Visa Tracking (linked to isVisaTrackingEnabled)
            'canAccessFinanceTab',        // Financial Tracking (linked to isFinanceTrackingEnabled)
            'canAccessMedicalTab',        // Medical (linked to isMedicalEnabled)
            'canAccessInterviewTab',      // Interview/Schedule (linked to isInterviewEnabled)
            'canAccessTravelTab',         // Travel/Tickets (linked to isTravelEnabled)
            'canAccessOfferLetterTab',    // Offer Letter
            'canAccessHistoryTab',        // History (linked to isHistoryEnabled)
            'canAccessCommsTab'           // Communications Log
        ]
    },
    
    // === NEW: All Settings Page Tabs ===
    settingsTabs: {
        title: 'Settings Tabs',
        keys: [
            'canAccessUsersSettings',     // User Management
            'canAccessDocReqSettings',    // Required Documents
            'canAccessEmailSettings',     // Email Settings
            'canAccessTemplatesSettings', // Offer Templates
            'canAccessMobileSettings',    // Mobile App Connection
            'canAccessBackupSettings'     // Backup Utility
        ]
    },
    
    delegation: { 
        title: 'Delegation', 
        keys: ['canViewReports', 'canAccessRecycleBin'] 
    }
};

// ========================================================================
// COMPREHENSIVE FEATURE LABELS
// ========================================================================
const featureLabels = {
    // Core Modules
    isEmployersEnabled: 'Employers',
    isJobsEnabled: 'Job Orders',
    isBulkImportEnabled: 'Bulk Import',
    
    // Tracking Tabs
    isDocumentsEnabled: 'Documents',
    isVisaTrackingEnabled: 'Visa Tracking',
    isFinanceTrackingEnabled: 'Financials',
    isMedicalEnabled: 'Medical',
    isInterviewEnabled: 'Interviews',
    isTravelEnabled: 'Travel',
    isHistoryEnabled: 'History',
    
    // Candidate Detail Tabs
    canAccessPassportTab: 'Passport Tracking',
    canAccessDocumentsTab: 'Documents Tab',
    canAccessJobsTab: 'Job Placements',
    canAccessVisaTab: 'Visa Tab',
    canAccessFinanceTab: 'Finance Tab',
    canAccessMedicalTab: 'Medical Tab',
    canAccessInterviewTab: 'Interview Tab',
    canAccessTravelTab: 'Travel Tab',
    canAccessOfferLetterTab: 'Offer Letter',
    canAccessHistoryTab: 'History Tab',
    canAccessCommsTab: 'Communications',
    
    // Settings Tabs
    canAccessUsersSettings: 'Users',
    canAccessDocReqSettings: 'Required Docs',
    canAccessEmailSettings: 'Email',
    canAccessTemplatesSettings: 'Templates',
    canAccessMobileSettings: 'Mobile App',
    canAccessBackupSettings: 'Backup',
    
    // Delegation
    canViewReports: 'View Reports',
    canAccessRecycleBin: 'Recycle Bin'
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
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
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
  
  // CRITICAL LOGIC: Filter toggles based on Manager's (Admin's) access
  const isToggleAllowed = (key) => {
      if (!managerFlags) return true; // Super Admin can delegate anything
      return managerFlags[key] === true;
  };

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div 
        className="viewer-modal-content payment-modal" 
        onClick={e => e.stopPropagation()} 
        style={{
          maxWidth: '900px', 
          height: '85vh', 
          display: 'flex', 
          flexDirection: 'column'
        }}
      >
        <button className="viewer-close-btn" onClick={onClose}><FiX /></button>
        
        <div className="viewer-header">
          <h3><FiShield /> Delegate Permissions to: {targetUser.username}</h3>
        </div>
        
        <div 
          className="payment-modal-body" 
          style={{
            padding: '1.5rem', 
            overflowY: 'auto', 
            flex: 1
          }}
        >
            <p className="form-message neutral" style={{marginBottom: '1.5rem'}}>
                <FiAlertCircle /> You can only grant access to features that *you* currently possess.
            </p>

            {loading ? (
                <p>Loading permissions...</p>
            ) : (
                <div 
                  className="permissions-grid" 
                  style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                    gap: '1.5rem'
                  }}
                >
                    {Object.entries(permissionCategories).map(([catKey, cat]) => (
                        <div 
                          key={catKey} 
                          className="perm-category" 
                          style={{
                            background: 'var(--bg-secondary)',
                            padding: '1rem',
                            borderRadius: 'var(--border-radius)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                            <h4 
                              style={{
                                fontSize: '0.9rem', 
                                fontWeight: '600',
                                borderBottom: '2px solid var(--primary-color)', 
                                paddingBottom: '8px', 
                                marginBottom: '12px',
                                color: 'var(--primary-color)'
                              }}
                            >
                              {cat.title}
                            </h4>
                            
                            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                {cat.keys.map(key => {
                                    const allowed = isToggleAllowed(key);
                                    const isChecked = !!permissions[key];
                                    
                                    return (
                                        <label 
                                            key={key} 
                                            style={{
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '10px', 
                                                fontSize: '0.85rem', 
                                                cursor: allowed ? 'pointer' : 'not-allowed', 
                                                opacity: allowed ? 1 : 0.4,
                                                padding: '6px',
                                                borderRadius: '4px',
                                                transition: 'background 0.2s',
                                                background: isChecked && allowed ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent'
                                            }}
                                            onMouseEnter={e => {
                                                if (allowed) e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = isChecked && allowed ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent';
                                            }}
                                        >
                                            <input 
                                                type="checkbox" 
                                                checked={isChecked} 
                                                onChange={() => handleToggle(key)} 
                                                disabled={!allowed}
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    cursor: allowed ? 'pointer' : 'not-allowed'
                                                }}
                                            />
                                            <span style={{flex: 1}}>
                                                {featureLabels[key] || key}
                                                {!allowed && <span style={{color: 'var(--danger-color)', fontSize: '0.75rem', marginLeft: '5px'}}>(Disabled)</span>}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div 
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-secondary)'
          }}
        >
            <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
              {Object.values(permissions).filter(Boolean).length} permissions granted
            </span>
            
            <div style={{display: 'flex', gap: '10px'}}>
                <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
                    Cancel
                </button>
                <button className="btn" onClick={handleSave} disabled={saving || loading}>
                    <FiSave style={{marginRight: '5px'}} />
                    {saving ? 'Saving...' : 'Save Permissions'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default DelegationModal;
