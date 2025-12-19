import React from 'react';
import DocumentCard from './DocumentCard';
import './DocumentGrid.css';

const DocumentGrid = ({
  documents,
  viewMode,
  categories,
  loading,
  onPreview,
  onDelete,
  onVerify,
  onUpload
}) => {
  if (loading) {
    return (
      <div className="document-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="document-grid-empty">
        <div className="empty-icon">📭</div>
        <h3>No Documents Found</h3>
        <p>Upload your first document to get started</p>
        <button className="empty-upload-btn" onClick={onUpload}>
          📤 Upload Document
        </button>
      </div>
    );
  }

  return (
    <div className={`document-grid ${viewMode}`}>
      {documents.map((document, index) => (
        <DocumentCard
          key={document.id}
          document={document}
          category={categories.find(cat => cat.id === document.category)}
          viewMode={viewMode}
          animationDelay={index * 0.05}
          onPreview={onPreview}
          onDelete={onDelete}
          onVerify={onVerify}
        />
      ))}

      {/* Upload Card */}
      <div className="document-card upload-card" onClick={onUpload}>
        <div className="upload-card-content">
          <div className="upload-icon">📤</div>
          <h4>Upload New Document</h4>
          <p>Click to add more files</p>
        </div>
      </div>
    </div>
  );
};

export default DocumentGrid;
