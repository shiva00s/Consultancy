import React from 'react';

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '200px 1fr',
  gap: '8px',
  marginBottom: '8px',
  fontSize: '14px',
};

const labelStyle = {
  color: 'var(--text-secondary)',
};

const valueStyle = {
  color: 'var(--text-primary)',
  fontWeight: 500,
};

const PersonalInfoTab = ({ data = {} }) => {
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={rowStyle}>
        <span style={labelStyle}>Full Name</span>
        <span style={valueStyle}>{data.fullName || '-'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Email</span>
        <span style={valueStyle}>{data.email || '-'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Phone</span>
        <span style={valueStyle}>{data.phone || '-'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Location</span>
        <span style={valueStyle}>{data.location || '-'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Gender</span>
        <span style={valueStyle}>{data.gender || '-'}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Date of Birth</span>
        <span style={valueStyle}>{data.dob || '-'}</span>
      </div>
    </div>
  );
};

export default PersonalInfoTab;
