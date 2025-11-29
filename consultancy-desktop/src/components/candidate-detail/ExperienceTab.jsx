import React from 'react';

const cardStyle = {
  padding: '12px 14px',
  borderRadius: '8px',
  background: 'var(--card-bg)',
  marginBottom: '10px',
  border: '1px solid var(--border-color)',
};

const titleStyle = {
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const subtitleStyle = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
};

const ExperienceTab = ({ data = [] }) => {
  const items = Array.isArray(data) ? data : [];

  if (!items.length) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No experience records.</div>;
  }

  return (
    <div style={{ padding: '10px 0' }}>
      {items.map((exp, idx) => (
        <div key={idx} style={cardStyle}>
          <div style={titleStyle}>{exp.role || exp.title || '-'}</div>
          <div style={subtitleStyle}>
            {exp.company || '-'} • {exp.from || ''} {exp.to ? ` - ${exp.to}` : ''}
          </div>
          {exp.description && (
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
              {exp.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ExperienceTab;
