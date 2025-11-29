// src/components/candidate-detail/DocumentSection.jsx (NEW)
import React from 'react';
import DocumentUploader from '../DocumentUploader';

const DocumentSection = ({ candidateId }) => (
  <div className="documents-section" style={{ 
    padding: '20px', background: 'var(--card-bg)', borderRadius: '8px', 
    maxWidth: '1300px', marginBottom: '30px' 
  }}>
    <h2 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Documents</h2>
    <DocumentUploader candidateId={candidateId} />
  </div>
);

export default DocumentSection;
