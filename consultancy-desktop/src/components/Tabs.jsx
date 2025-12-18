import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../css/Tabs.css';
// This is a simple generic Tabs component that handles the tab switching logic.
function Tabs({ defaultActiveTab, tabs }) {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0].key);
  const tabsRef = useRef(null); // Ref to hold the tabs-header DOM element

  const activeContent = tabs.find(tab => tab.key === activeTab)?.content;

  // Function to scroll the active tab into view (centered)
  const scrollToActiveTab = useCallback(() => {
    if (tabsRef.current) {
        // Find the button corresponding to the active tab
        const activeElement = tabsRef.current.querySelector(`.tab-btn.active`);

        if (activeElement) {
            // Use native scrollIntoView with 'center' alignment for dynamic centering
            activeElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest', // Vertical alignment (not strictly needed for horizontal)
                inline: 'center'  // <--- KEY PROPERTY: Horizontal centering
            });
        }
    }
  }, []); // Empty dependency array as tabsRef.current is stable

  // Trigger the scroll action whenever the active tab changes
  useEffect(() => {
    scrollToActiveTab();
  }, [activeTab, scrollToActiveTab]);


  return (
    <div className="custom-tabs-container">
      {/* Tab Navigation (Header) */}
      <div className="tabs-header" ref={tabsRef}> {/* <--- ADDED REF */}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.title}
          </button>
        ))}
      </div>

      {/* Tab Content (Body) */}
      <div className="tabs-content">
        {activeContent || <p>No content available for this tab.</p>}
      </div>
    </div>
  );
}

export default Tabs;