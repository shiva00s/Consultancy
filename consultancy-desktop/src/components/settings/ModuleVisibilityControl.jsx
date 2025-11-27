import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
    FiSave, FiAlertCircle, FiPackage, FiFileText, FiMail, FiEdit, FiSmartphone, 
    FiDatabase, FiGrid, FiUsers, FiShield, 
    FiBarChart2, FiTrash2, FiClock, FiServer, 
    FiRefreshCw, FiDollarSign, FiSend, FiCheck 
} from 'react-icons/fi';
import '../../css/ModuleControl.css';

// --- CONFIGURATION ---
const FACTORY_DEFAULT_FLAGS = {
    isEmployersEnabled: true, isJobsEnabled: true, isBulkImportEnabled: false,
    isVisaKanbanEnabled: false, // Ensure this new flag is included
    isDocumentsEnabled: true, isVisaTrackingEnabled: false, isFinanceTrackingEnabled: false,
    isMedicalEnabled: false, isInterviewEnabled: false, isTravelEnabled: false, isHistoryEnabled: true,
    canViewReports: false, canAccessRecycleBin: false, canDeletePermanently: false,
    isRequiredDocsEnabled: false, isEmailEnabled: false, isTemplatesEnabled: false, 
    isMobileAccessEnabled: false, isBackupEnabled: false
};

const toggleCategories = {
    core: {
        id: 'core', title: 'Core Modules', description: 'Essential CRM functions for recruitment.',
        icon: <FiGrid />, 
        keys: ['isEmployersEnabled', 'isJobsEnabled', 'isVisaKanbanEnabled', 'isBulkImportEnabled'] 
    },
    tracking: { 
        id: 'tracking', title: 'Candidate Tracking', description: 'Tabs visible in Candidate Details.',
        icon: <FiUsers />, 
        keys: ['isDocumentsEnabled', 'isVisaTrackingEnabled', 'isFinanceTrackingEnabled', 'isMedicalEnabled', 'isInterviewEnabled', 'isTravelEnabled', 'isHistoryEnabled'] 
    },
    admin: { 
        id: 'admin', title: 'Admin Delegation', description: 'Permissions granted to Admin role.',
        icon: <FiShield />,
        keys: ['canViewReports', 'canAccessRecycleBin', 'canDeletePermanently'] 
    },
    system: {
        id: 'system', title: 'System Features', description: 'Technical integrations and tools.',
        icon: <FiPackage />,
        keys: ['isRequiredDocsEnabled', 'isEmailEnabled', 'isTemplatesEnabled', 'isMobileAccessEnabled', 'isBackupEnabled']
    }
};

const featureMeta = {
    isEmployersEnabled: { label: 'Employers Module', icon: <FiServer /> },
    isJobsEnabled: { label: 'Job Orders Module', icon: <FiFileText /> },
    isVisaKanbanEnabled: { label: 'Visa Kanban Board', icon: <FiGrid /> },
    isBulkImportEnabled: { label: 'Candidate Bulk Import', icon: <FiDatabase /> },
    isDocumentsEnabled: { label: 'Documents Tab', icon: <FiFileText /> },
    isVisaTrackingEnabled: { label: 'Visa Tracking Tab', icon: <FiPackage /> },
    isFinanceTrackingEnabled: { label: 'Financial Tracking', icon: <FiDollarSign /> },
    isMedicalEnabled: { label: 'Medical Tab', icon: <FiUsers /> },
    isInterviewEnabled: { label: 'Interview Tab', icon: <FiClock /> },
    isTravelEnabled: { label: 'Travel Tab', icon: <FiSend /> },
    isHistoryEnabled: { label: 'History Tab', icon: <FiClock /> },
    canViewReports: { label: 'View Reports', icon: <FiBarChart2 /> },
    canAccessRecycleBin: { label: 'Access Recycle Bin', icon: <FiTrash2 /> },
    canDeletePermanently: { label: 'Permanent Delete', icon: <FiAlertCircle /> },
    isRequiredDocsEnabled: { label: 'Required Docs', icon: <FiCheck /> },
    isEmailEnabled: { label: 'Email Integration', icon: <FiMail /> },
    isTemplatesEnabled: { label: 'Templates Editor', icon: <FiEdit /> },
    isMobileAccessEnabled: { label: 'Mobile App Access', icon: <FiSmartphone /> },
    isBackupEnabled: { label: 'Database Backup', icon: <FiDatabase /> }
};

function ModuleVisibilityControl({ user }) { 
    const [flags, setFlags] = useState({});
    const [activeTab, setActiveTab] = useState('core');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const isSuperAdmin = user && user.role === 'super_admin'; 

    const fetchFlags = useCallback(async () => {
        setLoading(true);
        try {
            const res = await window.electronAPI.getFeatureFlags();
            if (res.success) setFlags(res.data || {});
            else toast.error(res.error || 'Failed to load flags.');
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    }, []);

    useEffect(() => { if (isSuperAdmin) fetchFlags(); }, [isSuperAdmin, fetchFlags]);

    const handleToggle = (key) => {
        setFlags(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        if (!isSuperAdmin) return;
        setSaving(true);
        const res = await window.electronAPI.saveFeatureFlags({ user: user, flags }); 
        if (res.success) toast.success('System configuration saved successfully.');
        else toast.error(res.error);
        setSaving(false);
    };

    const handleRestore = async () => {
        if (!isSuperAdmin || !window.confirm("Reset ALL modules to factory defaults?")) return;
        setFlags(FACTORY_DEFAULT_FLAGS);
        setSaving(true);
        await window.electronAPI.saveFeatureFlags({ user: user, flags: FACTORY_DEFAULT_FLAGS });
        toast.success('Restored defaults.');
        setSaving(false);
    };

    if (!isSuperAdmin) return <div className="form-message error">Access Denied.</div>;
    if (loading) return <p>Loading configuration...</p>;

    const currentCategory = toggleCategories[activeTab];

    return (
        <div className="settings-section-card no-padding-card">
            {/* Header */}
            <div className="module-header">
                <div>
                    <h2>System Modules Control</h2>
                    <p>Enable or disable features globally. Changes affect all users immediately.</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleRestore} disabled={saving}>
                        <FiRefreshCw /> Restore Defaults
                    </button>
                    <button className="btn" onClick={handleSave} disabled={saving}>
                        <FiSave /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="module-layout">
                {/* Sidebar Navigation */}
                <div className="module-sidebar">
                    {Object.values(toggleCategories).map((cat) => (
                        <button 
                            key={cat.id} 
                            className={`module-tab-btn ${activeTab === cat.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(cat.id)}
                        >
                            <span className="tab-icon">{cat.icon}</span>
                            <div className="tab-info">
                                <span className="tab-title">{cat.title}</span>
                                <span className="tab-desc">{cat.keys.filter(k => flags[k]).length} Active</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="module-content">
                    <div className="category-intro">
                        <h3>{currentCategory.title}</h3>
                        <p>{currentCategory.description}</p>
                    </div>

                    <div className="switches-grid">
                        {currentCategory.keys.map(key => {
                            const meta = featureMeta[key] || { label: key, icon: <FiPackage /> };
                            const isActive = !!flags[key];
                            
                            return (
                                <div key={key} className={`switch-card ${isActive ? 'enabled' : ''}`} onClick={() => handleToggle(key)}>
                                    <div className="switch-icon-wrapper">
                                        {meta.icon}
                                    </div>
                                    <div className="switch-info">
                                        <span className="switch-label">{meta.label}</span>
                                        <span className="switch-status">{isActive ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                    
                                    {/* iOS Style Switch */}
                                    <div className={`ios-switch ${isActive ? 'on' : ''}`}>
                                        <div className="switch-handle"></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ModuleVisibilityControl;