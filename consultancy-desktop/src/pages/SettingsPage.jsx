import React, { useState, useEffect } from 'react';
import {
  FiSettings,
  FiLock,
  FiUsers,
  FiMail,
  FiFileText,
  FiDatabase,
  FiCheckSquare,
} from 'react-icons/fi';
import '../css/SettingsPage.css';

import UserManagement from '../components/settings/UserManagement';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import EmailSettings from '../components/settings/EmailSettings';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import BackupUtility from '../components/settings/BackupUtility';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('users');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(true);
      return;
    }
    loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPermissions = async () => {
    if (!user) return;

    if (user.role === 'super_admin') {
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
      const res = await window.electronAPI.getUserGranularPermissions({
        userId: user.id,
      });
      if (res.success) {
        setUserPermissions(res.data || {});
      }
      setLoading(false);
    } else {
      setUserPermissions({});
      setLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="settings-page-wrapper">
        <div className="settings-page-loading-card">
          <div className="settings-loading-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  const availableTabs = [];

  if (userPermissions.settings_users) {
    availableTabs.push({
      id: 'users',
      label: 'Users',
      icon: <FiUsers />,
      component: <UserManagement currentUser={user} />,
    });
  }

  if (userPermissions.settings_required_docs) {
    availableTabs.push({
      id: 'doc_req',
      label: 'Required Docs',
      icon: <FiCheckSquare />,
      component: <DocumentRequirementManager user={user} />,
    });
  }

  if (userPermissions.settings_email) {
    availableTabs.push({
      id: 'email',
      label: 'Email',
      icon: <FiMail />,
      component: <EmailSettings user={user} />,
    });
  }

  if (userPermissions.settings_templates) {
    availableTabs.push({
      id: 'templates',
      label: 'Templates',
      icon: <FiFileText />,
      component: <OfferTemplateManager user={user} />,
    });
  }

  if (userPermissions.settings_backup) {
    availableTabs.push({
      id: 'backup',
      label: 'Backup',
      icon: <FiDatabase />,
      component: <BackupUtility user={user} />,
    });
  }

  if (availableTabs.length === 0) {
    return (
      <div className="settings-page-wrapper">
        <div className="settings-top-bar elevated">
          <div className="settings-title-area">
            <h1>
              <FiSettings /> Application Settings
            </h1>
            <span className="settings-subtitle">
              Central place for managing users, documents, email and more.
            </span>
          </div>
        </div>
        <div className="settings-no-access-card">
          <h2>No Settings Access</h2>
          <p>
            You don&apos;t have permission to access any settings tabs. Contact
            your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!availableTabs.find(t => t.id === activeTab)) {
    setActiveTab(availableTabs[0].id);
  }

  return (
    <div className="settings-page-wrapper">
      {/* HEADER */}
      <div className="settings-top-bar elevated">
        <div className="settings-title-area">
          <h1>
            <FiSettings /> Application Settings
          </h1>
          
        </div>
        <button
          className="btn btn-secondary btn-compact"
          onClick={() => setIsPasswordModalOpen(true)}
        >
          <FiLock /> Change Password
        </button>
      </div>

      {/* TABS */}
      <div className="settings-tabs-row pill-bar">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab-item ${
              activeTab === tab.id ? 'active' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="settings-tab-icon">{tab.icon}</span>
            <span className="settings-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="settings-content-area card-surface">
        {availableTabs.find(t => t.id === activeTab)?.component}
      </div>

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
