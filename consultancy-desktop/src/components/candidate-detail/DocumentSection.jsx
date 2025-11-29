// src/components/candidate-detail/DocumentSection.jsx (NEW)
import React from 'react';
import DocumentUploader from '../DocumentUploader';

const DocumentSection = ({ candidateId, documents = [] }) => {
  const safeDocs = Array.isArray(documents) ? documents : [];
  // render using safeDocs
};


export default DocumentSection;
