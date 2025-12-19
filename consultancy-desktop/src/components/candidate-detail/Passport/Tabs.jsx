import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Tabs.css';

/**
 * Premium Tabs Component with Glassmorphism Design
 * @param {string} defaultActiveTab - Initial active tab key
 * @param {Array} tabs - Array of tab objects: [{ key, label, content, icon, disabled }]
 * @param {Function} onTabChange - Callback when tab changes
 */
function Tabs({ defaultActiveTab, tabs, onTabChange }) {
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
    <div className="premium-tabs">
      {/* Tab Navigation */}
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
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              <span className="tab-label">{tab.label}</span>
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
              {tab.disabled && <span className="tab-check">✓</span>}
            </button>
          ))}
          
          {/* Animated indicator */}
          <div 
            className="tab-indicator" 
            style={indicatorStyle}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="tabs-content">
        {activeContent || (
          <div className="tabs-empty">
            <div className="empty-icon">📭</div>
            <p>No content available for this tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tabs;
