import React, { useRef, useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import '../css/Tabs.css';

const Tabs = ({ tabs, activeTab, onTabChange }) => {
  const tabsHeaderRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check if scroll arrows are needed
  const checkScrollButtons = () => {
    if (tabsHeaderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsHeaderRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    window.addEventListener('resize', checkScrollButtons);
    return () => window.removeEventListener('resize', checkScrollButtons);
  }, [tabs]);

  // Auto-scroll to active tab
  useEffect(() => {
    const activeTabElement = tabsHeaderRef.current?.querySelector('.tab-btn.active');
    if (activeTabElement && tabsHeaderRef.current) {
      const container = tabsHeaderRef.current;
      const tabLeft = activeTabElement.offsetLeft;
      const tabWidth = activeTabElement.offsetWidth;
      const containerWidth = container.offsetWidth;

      // Scroll to center the active tab
      const scrollTo = tabLeft - (containerWidth / 2) + (tabWidth / 2);
      
      container.scrollTo({
        left: scrollTo,
        behavior: 'smooth'
      });
      
      // Update arrow visibility after scroll
      setTimeout(checkScrollButtons, 300);
    }
  }, [activeTab]);

  const scroll = (direction) => {
    if (tabsHeaderRef.current) {
      const scrollAmount = 250;
      tabsHeaderRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      
      // Update arrow visibility after scroll
      setTimeout(checkScrollButtons, 300);
    }
  };

  return (
    <div className="custom-tabs-container">
      <div className="tabs-wrapper">
        {showLeftArrow && (
          <button 
            className="tab-scroll-btn left" 
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <FaChevronLeft />
          </button>
        )}
        
        <div 
          className="tabs-header" 
          ref={tabsHeaderRef}
          onScroll={checkScrollButtons}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => onTabChange(tab.key)}
              title={tab.label} // Tooltip shows full text
            >
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {showRightArrow && (
          <button 
            className="tab-scroll-btn right" 
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <FaChevronRight />
          </button>
        )}
      </div>
    </div>
  );
};

export default Tabs;
