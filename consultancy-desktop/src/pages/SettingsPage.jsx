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
import UniversalTabs from '../components/common/UniversalTabs';
import UserManagement from '../components/settings/UserManagement';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import EmailSettings from '../components/settings/EmailSettings';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import BackupUtility from '../components/settings/BackupUtility';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';
import KeysManager from '../components/settings/KeysManager';
import CompanySetup from '../components/settings/CompanySetup';

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

    const roleStr = String(user.role || '').toLowerCase();
    const isSuperAdmin = roleStr.includes('super') || user.is_super_admin || user.isSuperAdmin;
    if (isSuperAdmin) {
      // Super admin gets full settings access
      setUserPermissions({
        settings_users: true,
        settings_required_docs: true,
        settings_email: true,
        settings_templates: true,
        settings_company_setup: true,
        settings_mobile_app: true,
        settings_backup: true,
        settings_keys: true,
      });
      setLoading(false);
    } else {
      // Admins and staff must fetch their delegated granular permissions
      const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
      if (res && res.success) {
        setUserPermissions(res.data || {});
      } else {
        setUserPermissions({});
      }
      setLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="settings-page-wrapper">
        <div className="loading-container">
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  // Build tabs array based on permissions
  const tabs = [];

  if (userPermissions.settings_users) {
    tabs.push({
      key: 'users',
      label: 'Users',
      icon: '👥',
      content: <UserManagement currentUser={user} />,
    });
  }

  if (userPermissions.settings_required_docs) {
    tabs.push({
      key: 'documents',
      label: 'Required Docs',
      icon: '📋',
      content: <DocumentRequirementManager />,
    });
  }

  if (userPermissions.settings_email) {
    tabs.push({
      key: 'email',
      label: 'Email',
      icon: '📧',
      content: <EmailSettings />,
    });
  }

  if (userPermissions.settings_templates) {
    tabs.push({
      key: 'templates',
      label: 'Templates',
      icon: '📄',
      content: <OfferTemplateManager />,
    });
  }

  if (userPermissions.settings_company_setup) {
    tabs.push({
      key: 'company_setup',
      label: 'Company Setup',
      icon: '🏢',
      content: <CompanySetup currentUser={user} />,
    });
  }

  if (userPermissions.settings_backup) {
    tabs.push({
      key: 'backup',
      label: 'Backup',
      icon: '💾',
      content: <BackupUtility />,
    });
  }

  // Keys management tab (last)
  if (userPermissions.settings_keys) {
    tabs.push({
      key: 'keys',
      label: 'Keys',
      icon: '🔐',
      content: <KeysManager />,
    });
  }

  if (tabs.length === 0) {
    return (
      <div className="settings-page-wrapper">
        <div className="no-access-message">
          <h2>⚠️ No Access</h2>
          <p>You don't have permission to access any settings tabs. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      {/* Top Bar */}
      <div className="settings-top-bar">
        <div className="settings-title-area">
          <FiSettings size={28} />
          <h1>Settings</h1>
        </div>
        <button
          className="btn btn-primary btn-compact"
          onClick={() => setIsPasswordModalOpen(true)}
        >
          <FiLock size={16} />
          Change Password
        </button>
      </div>

      {/* Universal Tabs - Integrated */}
      <div className="settings-tabs-container">
        <UniversalTabs
          defaultActiveTab={activeTab}
          tabs={tabs}
          onTabChange={(key) => setActiveTab(key)}
        />
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <ChangePasswordModal
          user={user}
          onClose={() => setIsPasswordModalOpen(false)}
          onPasswordChange={() => {
            console.log('Password changed');
          }}
        />
      )}
    </div>
  );
}

export default SettingsPage;
