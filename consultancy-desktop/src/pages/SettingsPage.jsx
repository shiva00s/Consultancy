import React, { useState, useEffect, useMemo } from 'react';
import {
  FiSettings,
  FiLock,
  FiUsers,
  FiMail,
  FiFileText,
  FiSmartphone,
  FiDatabase,
  FiCheckSquare,
} from 'react-icons/fi';
import '../css/SettingsPage.css';

// Components
import UserManagement from '../components/settings/UserManagement';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import EmailSettings from '../components/settings/EmailSettings';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import MobileConnection from '../components/settings/MobileConnection';
import BackupUtility from '../components/settings/BackupUtility';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('users');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    loadPermissions();
  }, [user]);

  const availableTabs = useMemo(() => {
    const tabs = [];

    if (userPermissions.settings_users) {
      tabs.push({
        id: 'users',
        label: 'Users',
        icon: <FiUsers />,
        component: <UserManagement currentUser={user} />,
      });
    }

    if (userPermissions.settings_required_docs) {
      tabs.push({
        id: 'doc_req',
        label: 'Required Docs',
        icon: <FiCheckSquare />,
        component: <DocumentRequirementManager user={user} />,
      });
    }

    if (userPermissions.settings_email) {
      tabs.push({
        id: 'email',
        label: 'Email',
        icon: <FiMail />,
        component: <EmailSettings user={user} />,
      });
    }

    if (userPermissions.settings_templates) {
      tabs.push({
        id: 'templates',
        label: 'Templates',
        icon: <FiFileText />,
        component: <OfferTemplateManager user={user} />,
      });
    }

    if (userPermissions.settings_mobile_app) {
      tabs.push({
        id: 'mobile',
        label: 'Mobile App',
        icon: <FiSmartphone />,
        component: <MobileConnection user={user} />,
      });
    }

    if (userPermissions.settings_backup) {
      tabs.push({
        id: 'backup',
        label: 'Backup',
        icon: <FiDatabase />,
        component: <BackupUtility user={user} />,
      });
    }

    return tabs;
  }, [userPermissions, user]);

  // Ensure activeTab is always a valid tab, without setting state during render
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.find((t) => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  if (loading) {
    return (
      <div className="settings-page-wrapper">
        <p>Loading settings...</p>
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return (
      <div className="settings-page-wrapper">
        <div className="settings-top-bar">
          <div className="settings-title-area">
            <h1>
              <FiSettings /> Application Settings
            </h1>
          </div>
        </div>
        <div
          className="no-access-message"
          style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <h2>No Settings Access</h2>
          <p>
            You do not have permission to access any settings tabs. Contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  const activeTabConfig = availableTabs.find((t) => t.id === activeTab);

  return (
    <div className="settings-page-wrapper">
      {/* HEADER ROW */}
      <div className="settings-top-bar">
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

      {/* HORIZONTAL TABS */}
      <div className="settings-tabs-row">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab-item ${
              activeTab === tab.id ? 'active' : ''
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div className="settings-content-area">
        {activeTabConfig ? activeTabConfig.component : null}
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
