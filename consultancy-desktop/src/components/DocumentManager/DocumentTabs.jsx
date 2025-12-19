import React, { useRef, useEffect, useState } from 'react';
import './DocumentTabs.css';

const DocumentTabs = ({
  categories,
  activeTab,
  counts,
  unverifiedCounts,
  onTabChange
}) => {
  const tabsRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  const scroll = (direction) => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkScroll, 300);
    }
  };

  return (
    <div className="document-tabs-wrapper">
      {showLeftScroll && (
        <button className="scroll-btn left" onClick={() => scroll('left')}>
          ‹
        </button>
      )}

      <div
        className="document-tabs"
        ref={tabsRef}
        onScroll={checkScroll}
      >
        {categories.map(category => {
          const count = counts[category.id] || 0;
          const unverified = unverifiedCounts[category.id] || 0;
          const isActive = activeTab === category.id;

          return (
            <button
              key={category.id}
              className={`doc-tab ${isActive ? 'active' : ''} ${category.required ? 'required' : ''}`}
              onClick={() => onTabChange(category.id)}
              style={{
                '--tab-color': category.color
              }}
            >
              <span className="tab-icon">{category.icon}</span>
              <span className="tab-name">{category.name}</span>
              <span className="tab-count">({count})</span>
              {unverified > 0 && (
                <span className="tab-badge unverified" title={`${unverified} pending verification`}>
                  ⚠️ {unverified}
                </span>
              )}
              {category.required && count === 0 && (
                <span className="tab-badge required-badge" title="Required">
                  *
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showRightScroll && (
        <button className="scroll-btn right" onClick={() => scroll('right')}>
          ›
        </button>
      )}
    </div>
  );
};

export default DocumentTabs;
