import React, { useState, useEffect } from 'react';
import { FiUpload, FiFile, FiTrash2, FiDownload, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/DocumentUploader.css';

const DocumentUploader = ({ candidateId }) => {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] = useState('general');

  useEffect(() => {
    loadDocuments();
  }, [candidateId]);

  const loadDocuments = async () => {
    try {
      const result = await window.api.getCandidateDocuments(candidateId);
      if (result.success) {
        setDocuments(result.documents);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.api.openFileDialog({
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
        ]
      });

      if (result.success) {
        await uploadDocument(result.fileBuffer, result.fileName);
      }
    } catch (error) {
      console.error('File selection failed:', error);
      toast.error('Failed to select file');
    }
  };

  const uploadDocument = async (fileBuffer, fileName) => {
    setUploading(true);
    try {
      const result = await window.api.uploadDocument({
        candidateId,
        documentType,
        fileBuffer,
        fileName
      });

      if (result.success) {
        toast.success('Document uploaded successfully!');
        loadDocuments();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId, fileName) => {
    try {
      const result = await window.api.downloadDocument(documentId);
      
      if (result.success) {
        // Create blob and download
        const blob = new Blob([new Uint8Array(result.buffer)]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Document downloaded!');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const result = await window.api.deleteDocument(documentId);
      if (result.success) {
        toast.success('Document deleted');
        loadDocuments();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete document');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: '📄',
      doc: '📝',
      docx: '📝',
      txt: '📃',
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      zip: '📦',
      default: '📎'
    };
    return iconMap[ext] || iconMap.default;
  };

  return (
    <div className="document-uploader">
      <div className="uploader-header">
        <h3>📁 Documents</h3>
        <div className="upload-controls">
          <select 
            value={documentType} 
            onChange={(e) => setDocumentType(e.target.value)}
            className="document-type-select"
          >
            <option value="general">General</option>
            <option value="resume">Resume</option>
            <option value="certificate">Certificate</option>
            <option value="id_proof">ID Proof</option>
            <option value="education">Education</option>
            <option value="experience">Experience Letter</option>
          </select>
          <button 
            onClick={handleFileSelect} 
            disabled={uploading}
            className="btn-upload"
          >
            <FiUpload /> {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      <div className="documents-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <FiFile size={48} />
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="document-item">
              <div className="doc-icon">
                {getFileIcon(doc.document_name)}
              </div>
              <div className="doc-info">
                <div className="doc-name">{doc.document_name}</div>
                <div className="doc-meta">
                  <span className="doc-type">{doc.document_type}</span>
                  <span className="doc-date">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="doc-actions">
                <button 
                  onClick={() => handleDownload(doc.id, doc.document_name)}
                  className="btn-icon"
                  title="Download"
                >
                  <FiDownload />
                </button>
                <button 
                  onClick={() => handleDelete(doc.id)}
                  className="btn-icon btn-danger"
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentUploader;
