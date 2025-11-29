// src/components/candidate-detail/CandidateHeader.jsx (NEW)
import React from 'react';

const CandidateHeader = ({ candidate }) => (
  <div className="candidate-header" style={{ 
    display: 'flex', gap: '20px', marginBottom: '30px', padding: '20px', 
    borderBottom: '2px solid var(--border-color)', maxWidth: '1300px' 
  }}>
    <div className="avatar" style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#ddd' }}>
      {/* Avatar image */}
    </div>
    <div className="info" style={{ flex: 1 }}>
      <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--text-primary)' }}>{candidate.name}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
        {candidate.position} | {candidate.status} | ID: {candidate.id}
      </p>
    </div>
    <div className="actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <button style={{ padding: '10px 20px', borderRadius: '6px' }}>Edit</button>
      <button style={{ padding: '10px 20px', borderRadius: '6px', background: 'var(--danger)' }}>Archive</button>
    </div>
  </div>
);

export default CandidateHeader;
