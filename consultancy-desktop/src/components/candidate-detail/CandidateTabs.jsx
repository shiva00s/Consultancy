// src/components/candidate-detail/CandidateTabs.jsx (NEW)
import React, { useState } from 'react';
import PersonalInfoTab from './PersonalInfoTab';
import SkillsTab from './SkillsTab';
import ExperienceTab from './ExperienceTab';

const CandidateTabs = ({ candidate }) => {
  const [activeTab, setActiveTab] = useState('personal');

  const tabs = [
    { id: 'personal', label: 'Personal Info', component: <PersonalInfoTab data={candidate.personal} /> },
    { id: 'skills', label: 'Skills', component: <SkillsTab data={candidate.skills} /> },
    { id: 'experience', label: 'Experience', component: <ExperienceTab data={candidate.experience} /> }
  ];

  return (
    <div style={{ marginBottom: '30px', maxWidth: '1300px' }}>
      <div className="tab-headers" style={{ 
        display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' 
      }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px', border: 'none', background: 'none', 
              borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : 'none',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
};

export default CandidateTabs;
