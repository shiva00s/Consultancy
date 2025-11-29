import React from 'react';

const chipStyle = {
  display: 'inline-block',
  padding: '4px 10px',
  margin: '4px',
  borderRadius: '12px',
  background: 'var(--chip-bg, rgba(0,0,0,0.05))',
  color: 'var(--text-primary)',
  fontSize: '13px',
};

const SkillsTab = ({ data = [] }) => {
  const skills = Array.isArray(data) ? data : [];

  if (!skills.length) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No skills added.</div>;
  }

  return (
    <div style={{ padding: '10px 0' }}>
      {skills.map((skill, idx) => (
        <span key={idx} style={chipStyle}>
          {typeof skill === 'string' ? skill : skill.name}
        </span>
      ))}
    </div>
  );
};

export default SkillsTab;
