import React, { useState, useEffect } from 'react';
import {
  FiUser,
  FiPackage,
  FiFileText,
  FiClipboard,
  FiGlobe,
  FiDollarSign,
  FiActivity,
  FiCalendar,
  FiSend,
  FiClock,
} from 'react-icons/fi';
import usePermissionStore from '../store/usePermissionStore';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../css/DynamicTabs.css';

// Icon mapping for tabs
const TAB_ICON_MAP = {
  FiUser,
  FiPackage,
  FiFileText,
  FiClipboard,
  FiGlobe,
  FiDollarSign,
  FiActivity,
  FiCalendar,
  FiSend,
  FiClock,
};

function DynamicTabs({ activeTab, onTabChange }) {
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const { getCandidateTabs } = usePermissionStore();
  
  const [tabs, setTabs] = useState([]);

  useEffect(() => {
    loadTabs();
  }, [user]);

  const loadTabs = () => {
    const availableTabs = getCandidateTabs();
    setTabs(availableTabs);

    // If active tab is not available, switch to first available tab
    if (availableTabs.length > 0) {
      const activeTabExists = availableTabs.some(
        tab => tab.route === activeTab
      );
      
      if (!activeTabExists) {
        onTabChange(availableTabs[0].route);
      }
    }
  };

  const getIcon = (iconName) => {
    const IconComponent = TAB_ICON_MAP[iconName] || FiFileText;
    return <IconComponent />;
  };

  if (tabs.length === 0) {
    return (
      <div className="tabs-container">
        <div className="no-tabs-message">
          <p>No tabs available. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tabs-container">
      <div className="tabs-wrapper">
        {tabs.map((tab) => (
          <button
            key={tab.module_key}
            className={`tab-item ${activeTab === tab.route ? 'active' : ''}`}
            onClick={() => onTabChange(tab.route)}
            title={tab.module_name}
          >
            <span className="tab-icon">{getIcon(tab.icon)}</span>
            <span className="tab-label">{tab.module_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default DynamicTabs;
