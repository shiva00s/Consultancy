import React, { useState, useEffect } from 'react';
import { 
  FiSettings, FiLock, FiUsers, FiMail, FiFileText, 
  FiSmartphone, FiDatabase, FiCheckSquare 
} from 'react-icons/fi';
import '../css/SettingsPage.css';

// Components
import UserManagement from '../components/settings/UserManagement';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import EmailSettings from '../components/settings/EmailSettings';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import MobileConnection from '../components/settings/MobileConnection';
import BackupUtility from '../components/settings/BackupUtility';
import ChangePasswordModal from "../components/modals/ChangePasswordModal";

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('users'); 
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPermissions();
  }, [user]);

  const loadPermissions = async () => {
    if (user.role === 'super_admin') {
      // Super Admin has all permissions
      setUserPermissions({
        settings_users: true,
        settings_required_docs: true,
        settings_email: true,
        settings_templates: true,
        settings_mobile_app: true,
        settings_backup: true,
      });
      setLoading(false);
    } else if (user.role === 'admin' || user.role === 'staff') {
      const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
      if (res.success) {
        setUserPermissions(res.data || {});
      }
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="settings-page-wrapper"><p>Loading settings...</p></div>;
  }

  // Build tabs based on permissions
  const availableTabs = [];

  if (userPermissions.settings_users) {
    availableTabs.push({
      id: 'users',
      label: 'Users',
      icon: <FiUsers />,
      component: <UserManagement currentUser={user} />
    });
  }

  if (userPermissions.settings_required_docs) {
    availableTabs.push({
      id: 'doc_req',
      label: 'Required Docs',
      icon: <FiCheckSquare />,
      component: <DocumentRequirementManager user={user} />
    });
  }

  if (userPermissions.settings_email) {
    availableTabs.push({
      id: 'email',
      label: 'Email',
      icon: <FiMail />,
      component: <EmailSettings user={user} />
    });
  }

  if (userPermissions.settings_templates) {
    availableTabs.push({
      id: 'templates',
      label: 'Templates',
      icon: <FiFileText />,
      component: <OfferTemplateManager user={user} />
    });
  }

  if (userPermissions.settings_mobile_app) {
    availableTabs.push({
      id: 'mobile',
      label: 'Mobile App',
      icon: <FiSmartphone />,
      component: <MobileConnection user={user} />
    });
  }

  if (userPermissions.settings_backup) {
    availableTabs.push({
      id: 'backup',
      label: 'Backup',
      icon: <FiDatabase />,
      component: <BackupUtility user={user} />
    });
  }

  // If no tabs available, show no access message
  if (availableTabs.length === 0) {
    return (
      <div className="settings-page-wrapper">
        <div className="settings-top-bar">
          <div className="settings-title-area">
            <h1><FiSettings /> Application Settings</h1>
          </div>
        </div>
        <div className="no-access-message" style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <h2>No Settings Access</h2>
          <p>You don't have permission to access any settings tabs. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Set default active tab to first available tab
  if (!availableTabs.find(t => t.id === activeTab)) {
    setActiveTab(availableTabs[0].id);
  }

  return (
    <div className="settings-page-wrapper">
      
      {/* --- HEADER ROW --- */}
      <div className="settings-top-bar">
        <div className="settings-title-area">
          <h1><FiSettings /> Application Settings</h1>
        </div>
        <button className="btn btn-secondary btn-compact" onClick={() => setIsPasswordModalOpen(true)}>
          <FiLock /> Change Password
        </button>
      </div>

      {/* --- HORIZONTAL TABS --- */}
      <div className="settings-tabs-row">
        {availableTabs.map(tab => (
          <button 
            key={tab.id} 
            className={`settings-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --- CONTENT AREA (Scrollable only if needed) --- */}
      <div className="settings-content-area">
        {availableTabs.find(t => t.id === activeTab)?.component}
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <ChangePasswordModal 
          user={user}
          onClose={() => setIsPasswordModalOpen(false)}
          onPasswordChange={() => window.location.reload()} 
        />
      )}
    </div>
  );
}

export default SettingsPage;
