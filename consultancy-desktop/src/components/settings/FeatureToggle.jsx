import React, { useState, useEffect, useCallback } from 'react';
import { FiSave, FiSettings, FiLayout, FiShield, FiActivity, FiSmartphone } from 'react-icons/fi';
import toast from 'react-hot-toast';
import "../../css/FeatureToggle.css";

// Helper to categorize flags
const toggleCategories = {
    core: {
        title: 'Core Modules',
        icon: <FiLayout />,
        // [MODIFIED] Added 'isVisaKanbanEnabled' here
        keys: ['isEmployersEnabled', 'isJobsEnabled', 'isVisaKanbanEnabled', 'isBulkImportEnabled']
    },
    tracking: {
        title: 'Candidate Tracking',
        icon: <FiActivity />,
        keys: [
            'isDocumentsEnabled', 'isVisaTrackingEnabled', 'isFinanceTrackingEnabled', 
            'isMedicalEnabled', 'isInterviewEnabled', 'isTravelEnabled', 'isHistoryEnabled'
        ]
    },
    integrations: {
        title: 'Integrations',
        icon: <FiSmartphone />,
        keys: ['isMobileAccessEnabled']
    },
    admin: {
        title: 'Admin Delegation',
        icon: <FiShield />,
        keys: ['canAccessRecycleBin', 'canDeletePermanently']
    }
};

const featureLabels = {
    isEmployersEnabled: 'Employers Module',
    isJobsEnabled: 'Job Orders Module',
    isVisaKanbanEnabled: 'Visa Kanban Board', // [NEW LABEL]
    isDocumentsEnabled: 'Documents Tab',
    isVisaTrackingEnabled: 'Visa Tracking Tab',
    isFinanceTrackingEnabled: 'Financial Tracking Tab',
    isMedicalEnabled: 'Medical Tab',
    isInterviewEnabled: 'Interview Tab',
    isTravelEnabled: 'Travel Tab',
    isHistoryEnabled: 'History Tab',
    isBulkImportEnabled: 'Bulk Import Module',
    isMobileAccessEnabled: 'Mobile App Access (Local LAN)',
    canViewReports: 'View Reports',
    canAccessSettings: 'Access Settings',
    canAccessRecycleBin: 'Access Recycle Bin',
    canDeletePermanently: 'Permanent Deletion'
};

function FeatureToggle({ user }) { 
  const [flags, setFlags] = useState(null);
  const [activeTab, setActiveTab] = useState('core'); 
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getFeatureFlags();
    if (res.success) {
      setFlags(res.data);
    } else {
      toast.error(res.error); 
      setFlags({}); 
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = (key) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await window.electronAPI.saveFeatureFlags({ user, flags });
    if (res.success) {
      toast.success('Feature flags saved successfully!');
    } else {
      toast.error(res.error || 'Failed to save feature flags.'); 
    }
    setIsSaving(false);
  };

  if (loading) return <p>Loading settings...</p>;
  if (!flags) return <p style={{color: 'var(--danger-color)'}}>Error loading feature flags.</p>;
  
  return (
    <div className="settings-section-card">
        <div className="settings-header-row">
            <h2><FiSettings /> Module Visibility Control</h2>
            <button className="btn btn-primary save-btn-header" onClick={handleSave} disabled={isSaving}>
                <FiSave /> {isSaving ? 'Saving...' : 'Save All Changes'}
            </button>
        </div>
        
        <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem'}}>
            Control module visibility and system features. 
        </p>

        {/* --- TABS HEADER --- */}
        <div className="settings-tabs">
            {Object.entries(toggleCategories).map(([key, category]) => (
                <button 
                    key={key} 
                    className={`settings-tab-btn ${activeTab === key ? 'active' : ''}`}
                    onClick={() => setActiveTab(key)}
                >
                    {category.icon} {category.title}
                </button>
            ))}
        </div>

        {/* --- TAB CONTENT (GRID) --- */}
        <div className="settings-grid-content">
            {toggleCategories[activeTab].keys.map((key) => (
                <div key={key} className={`toggle-card ${flags[key] ? 'active' : ''}`} onClick={() => handleToggle(key)}>
                    <span className="toggle-label">{featureLabels[key]}</span>
                    <div className={`toggle-switch ${flags[key] ? 'on' : 'off'}`}>
                        {flags[key] ? 'ON' : 'OFF'}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}

export default FeatureToggle;