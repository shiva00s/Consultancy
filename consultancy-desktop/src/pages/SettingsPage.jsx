import React, { useState } from 'react';
import { 
  FiSettings, FiLock, FiUsers, FiMail, FiFileText, 
  FiSmartphone, FiDatabase, FiLayout, FiCheckSquare 
} from 'react-icons/fi';
import '../css/SettingsPage.css';

// Components
import FeatureToggle from '../components/settings/FeatureToggle';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import EmailSettings from '../components/settings/EmailSettings';
import MobileConnection from '../components/settings/MobileConnection';
import UserManagement from '../components/settings/UserManagement';
import BackupUtility from '../components/settings/BackupUtility';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import ChangePasswordModal from "../components/modals/ChangePasswordModal";
import LicensePricingManager from '../components/settings/LicensePricingManager';


function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('users'); 
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Locate const tabs = [ ... ]

  const tabs = [
    { id: 'users', label: 'Users', icon: <FiUsers />, component: <UserManagement currentUser={user} /> },

   

    { id: 'doc_req', label: 'Required Docs', icon: <FiCheckSquare />, component: <DocumentRequirementManager user={user} /> },
    { id: 'email', label: 'Email', icon: <FiMail />, component: <EmailSettings user={user} /> },
    { id: 'templates', label: 'Templates', icon: <FiFileText />, component: <OfferTemplateManager user={user} /> },
    
    // === CRITICAL FIX: Add user prop to Mobile App and Backup Utility ===
    { id: 'mobile', label: 'Mobile App', icon: <FiSmartphone />, component: <MobileConnection user={user} /> }, 
    { id: 'backup', label: 'Backup', icon: <FiDatabase />, component: <BackupUtility user={user} /> }, 
    // ====================================================================
  ];

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
          {tabs.map(tab => (
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
           {tabs.find(t => t.id === activeTab)?.component}
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