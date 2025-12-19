import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Tabs.css';

/**
 * Generic Tabs Component
 * @param {string} defaultActiveTab - Initial active tab key
 * @param {Array} tabs - Array of tab objects: [{ key, label, content }]
 */
function Tabs({ defaultActiveTab, tabs }) {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.key);
  const tabsRef = useRef(null);

  // Find active tab content
  const activeContent = tabs.find(tab => tab.key === activeTab)?.content;

  // Scroll active tab into view (centered)
  const scrollToActiveTab = useCallback(() => {
    if (tabsRef.current) {
      const activeElement = tabsRef.current.querySelector('.tab-btn.active');
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, []);

  // Trigger scroll when active tab changes
  useEffect(() => {
    scrollToActiveTab();
  }, [activeTab, scrollToActiveTab]);

  return (
    <div className="tabs-wrapper">
      {/* Tab Headers */}
      <div className="tabs-header" ref={tabsRef}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content-wrapper">
        {activeContent || (
          <div className="tab-empty">
            <p>No content available for this tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tabs;
