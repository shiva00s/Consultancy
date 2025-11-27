import React, { useState } from 'react';
import { FiCheckSquare,FiSettings, FiUsers, FiMail, FiFileText, FiDatabase, FiSmartphone } from 'react-icons/fi';
// [FIX] Correct Import
import ModuleVisibilityControl from '../components/settings/ModuleVisibilityControl'; 
import UserManagement from '../components/settings/UserManagement';
import EmailSettings from '../components/settings/EmailSettings';
import OfferTemplateManager from '../components/settings/OfferTemplateManager';
import DocumentRequirementManager from '../components/settings/DocumentRequirementManager';
import MobileConnection from '../components/settings/MobileConnection';
import BackupUtility from '../components/settings/BackupUtility';
import '../css/SettingsPage.css';

function SettingsPage({ user }) {
  const [activeTab, setActiveTab] = useState('modules');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);



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
      
<div className="settings-sidebar">
          <button className={activeTab === 'modules' ? 'active' : ''} onClick={() => setActiveTab('modules')}><FiSettings /> Modules & Features</button>
          <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}><FiUsers /> User Management</button>
          <button className={activeTab === 'email' ? 'active' : ''} onClick={() => setActiveTab('email')}><FiMail /> Email Configuration</button>
          <button className={activeTab === 'templates' ? 'active' : ''} onClick={() => setActiveTab('templates')}><FiFileText /> Offer Templates</button>
          <button className={activeTab === 'documents' ? 'active' : ''} onClick={() => setActiveTab('documents')}><FiFileText /> Required Documents</button>
          <button className={activeTab === 'mobile' ? 'active' : ''} onClick={() => setActiveTab('mobile')}><FiSmartphone /> Mobile Access</button>
          <button className={activeTab === 'backup' ? 'active' : ''} onClick={() => setActiveTab('backup')}><FiDatabase /> Backup & Restore</button>
      </div>
      
      <div className="settings-content">
        {/* [FIX] Use the component */}
        {activeTab === 'modules' && <ModuleVisibilityControl user={user} />}
        {activeTab === 'users' && <UserManagement currentUser={user} />}
        {activeTab === 'email' && <EmailSettings user={user} />}
        {activeTab === 'templates' && <OfferTemplateManager user={user} />}
        {activeTab === 'documents' && <DocumentRequirementManager user={user} />}
        {activeTab === 'mobile' && <MobileConnection user={user} />}
        {activeTab === 'backup' && <BackupUtility user={user} />}
      </div>

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