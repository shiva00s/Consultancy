import React, { useState, useRef, useEffect, useCallback } from 'react';
import './UniversalTabs.css';

/**
 * Universal Premium Tabs Component with Glassmorphism Design
 * Works for Documents, Passport, and any other tab system
 * 
 * @param {string} defaultActiveTab - Initial active tab key
 * @param {Array} tabs - Array of tab objects with structure:
 *   [{ 
 *     key: string,
 *     label: string,
 *     content: ReactNode,
 *     icon: string (optional emoji/icon),
 *     badge: string (optional count/status),
 *     disabled: boolean (optional)
 *   }]
 * @param {Function} onTabChange - Optional callback when tab changes
 */
function UniversalTabs({ defaultActiveTab, tabs, onTabChange }) {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.key);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabsRef = useRef(null);
  const activeTabRef = useRef(null);

  // Find active tab content
  const activeContent = tabs.find(tab => tab.key === activeTab)?.content;

  // Update indicator position
  const updateIndicator = useCallback(() => {
    if (activeTabRef.current) {
      const { offsetLeft, offsetWidth } = activeTabRef.current;
      setIndicatorStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
      });
    }
  }, []);

  // Handle tab click
  const handleTabClick = (tabKey, disabled) => {
    if (disabled) return;
    setActiveTab(tabKey);
    if (onTabChange) {
      onTabChange(tabKey);
    }
  };

  // Scroll active tab into view (centered)
  const scrollToActiveTab = useCallback(() => {
    if (tabsRef.current && activeTabRef.current) {
      const container = tabsRef.current;
      const activeElement = activeTabRef.current;
      
      const containerWidth = container.offsetWidth;
      const elementLeft = activeElement.offsetLeft;
      const elementWidth = activeElement.offsetWidth;
      const scrollPosition = elementLeft - (containerWidth / 2) + (elementWidth / 2);
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, []);

const UniversalTabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="universal-tabs-container">
      <div className="universal-tabs-wrapper">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`universal-tab ${activeTab === tab.id ? "active" : ""}`}
            data-theme={tab.theme || "default"}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="universal-tab-icon">{tab.icon}</span>
            <span className="universal-tab-label">{tab.label}</span>
            {tab.count > 0 && (
              <span className="universal-tab-badge">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

  // Update indicator when active tab changes
  useEffect(() => {
    updateIndicator();
    scrollToActiveTab();
  }, [activeTab, updateIndicator, scrollToActiveTab]);

  // Update indicator on window resize
  useEffect(() => {
    const handleResize = () => {
      updateIndicator();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateIndicator]);

  return (
    <div className="universal-tabs">
      {/* Tabs Navigation */}
      <div className="tabs-nav-container">
        <div className="tabs-nav" ref={tabsRef}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              ref={activeTab === tab.key ? activeTabRef : null}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
              onClick={() => handleTabClick(tab.key, tab.disabled)}
              disabled={tab.disabled}
            >
              {/* Tab Icon */}
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              
              {/* Tab Label */}
              <span className="tab-label">{tab.label}</span>
              
              {/* Badge (optional count/status display) */}
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
              
              {/* Check mark for disabled completed tabs */}
              {tab.disabled && <span className="tab-check">✓</span>}
            </button>
          ))}
          
          {/* Animated Indicator */}
          <div className="tab-indicator" style={indicatorStyle} />
        </div>
      </div>

      {/* Tabs Content */}
      <div className="tabs-content">
        {activeContent || (
          <div className="tabs-empty">
            <div className="empty-icon">📂</div>
            <p>No content available for this tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UniversalTabs;
