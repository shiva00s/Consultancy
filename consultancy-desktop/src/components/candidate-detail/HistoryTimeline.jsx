// src/components/candidate-detail/HistoryTimeline.jsx (NEW)
import React, { useState, useEffect } from 'react';

const HistoryTimeline = ({ candidateId }) => {
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    // Fetch timeline data
    fetchTimeline();
  }, [candidateId]);

  const fetchTimeline = async () => {
    // API call
  };

  return (
    <div className="timeline" style={{ maxWidth: '1300px' }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Activity Timeline</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {timeline.map((event, index) => (
          <div key={index} style={{ 
            padding: '15px', borderLeft: '3px solid var(--primary)', 
            background: 'var(--card-bg)', borderRadius: '6px' 
          }}>
            <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{event.action}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {event.timestamp} by {event.user}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryTimeline;
