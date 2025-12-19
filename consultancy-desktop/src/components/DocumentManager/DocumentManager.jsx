import React, { useState, useEffect } from 'react';
import DocumentTabs from './DocumentTabs';
import DocumentGrid from './DocumentGrid';
import DocumentUploadZone from './DocumentUploadZone';
import DocumentPreviewModal from './DocumentPreviewModal';
import { FiGrid, FiList, FiSearch, FiFilter } from 'react-icons/fi';
import './DocumentManager.css';

const DOCUMENT_CATEGORIES = [
  { id: 'all', name: 'All Documents', icon: '📄', color: '#6366f1' },
  { id: 'resume', name: 'Resume', icon: '📄', color: '#3b82f6', required: true },
  { id: 'photograph', name: 'Photograph', icon: '📸', color: '#ec4899', required: true },
  { id: 'aadhar', name: 'Aadhar Card', icon: '🆔', color: '#8b5cf6', required: true },
  { id: 'pan', name: 'Pan Card', icon: '💳', color: '#06b6d4', required: false },
  { id: 'driving', name: 'Driving License', icon: '🚗', color: '#f59e0b', required: false },
  { id: 'education', name: 'Education Certificate', icon: '🎓', color: '#10b981', required: true },
  { id: 'experience', name: 'Experience Letter', icon: '💼', color: '#8b5cf6', required: false },
  { id: 'offer', name: 'Offer Letter', icon: '📋', color: '#3b82f6', required: true },
  { id: 'visa', name: 'Visa', icon: '🛂', color: '#ef4444', required: false },
  { id: 'medical', name: 'Medical Certificate', icon: '🏥', color: '#14b8a6', required: false },
  { id: 'uncategorized', name: 'Uncategorized', icon: '📁', color: '#64748b', required: false }
];

const DocumentManager = ({ candidateId }) => {
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all | verified | pending | rejected
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, [candidateId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Replace with your API call
      const response = await fetch(`/api/candidates/${candidateId}/documents`);
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      // Mock data for development
      setDocuments(getMockDocuments());
    } finally {
      setLoading(false);
    }
  };

  // Filter documents based on active tab and filters
  const getFilteredDocuments = () => {
    let filtered = documents;

    // Filter by category
    if (activeTab !== 'all') {
      filtered = filtered.filter(doc => doc.category === activeTab);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === filterStatus);
    }

    return filtered;
  };

  // Get document counts per category
  const getCategoryCounts = () => {
    const counts = {};
    DOCUMENT_CATEGORIES.forEach(cat => {
      if (cat.id === 'all') {
        counts[cat.id] = documents.length;
      } else {
        counts[cat.id] = documents.filter(doc => doc.category === cat.id).length;
      }
    });
    return counts;
  };

  // Get unverified counts per category
  const getUnverifiedCounts = () => {
    const counts = {};
    DOCUMENT_CATEGORIES.forEach(cat => {
      if (cat.id === 'all') {
        counts[cat.id] = documents.filter(doc => doc.status === 'pending').length;
      } else {
        counts[cat.id] = documents.filter(
          doc => doc.category === cat.id && doc.status === 'pending'
        ).length;
      }
    });
    return counts;
  };

  // Handle document upload
  const handleUpload = async (files, category) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('category', category);
    formData.append('candidateId', candidateId);

    try {
      const response = await fetch(`/api/candidates/${candidateId}/documents/upload`, {
        method: 'POST',
        body: formData
      });
      const newDocs = await response.json();
      setDocuments([...documents, ...newDocs]);
      setShowUploadZone(false);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  // Handle document delete
  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      setDocuments(documents.filter(doc => doc.id !== documentId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Handle document verification
  const handleVerify = async (documentId, status, reason = null) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });
      const updated = await response.json();
      setDocuments(documents.map(doc => doc.id === documentId ? updated : doc));
    } catch (error) {
      console.error('Verify error:', error);
    }
  };

  const filteredDocuments = getFilteredDocuments();
  const categoryCounts = getCategoryCounts();
  const unverifiedCounts = getUnverifiedCounts();

  return (
    <div className="document-manager">
      {/* Header */}
      <div className="dm-header">
        <div className="dm-header-left">
          <div className="dm-title-section">
            <h2>📄 Documents Manager</h2>
            <p>Manage all candidate documents in one place</p>
          </div>
        </div>
        <div className="dm-header-right">
          {/* Search */}
          <div className="dm-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter */}
          <select
            className="dm-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="verified">✅ Verified</option>
            <option value="pending">⚠️ Pending</option>
            <option value="rejected">❌ Rejected</option>
          </select>

          {/* View Toggle */}
          <div className="dm-view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <FiGrid />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <FiList />
            </button>
          </div>

          {/* Upload Button */}
          <button
            className="dm-upload-btn"
            onClick={() => setShowUploadZone(true)}
          >
            📤 Upload Document
          </button>
        </div>
      </div>

      {/* Tabs */}
      <DocumentTabs
        categories={DOCUMENT_CATEGORIES}
        activeTab={activeTab}
        counts={categoryCounts}
        unverifiedCounts={unverifiedCounts}
        onTabChange={setActiveTab}
      />

      {/* Upload Zone */}
      {showUploadZone && (
        <DocumentUploadZone
          categories={DOCUMENT_CATEGORIES.filter(cat => cat.id !== 'all')}
          onUpload={handleUpload}
          onClose={() => setShowUploadZone(false)}
        />
      )}

      {/* Document Grid/List */}
      <DocumentGrid
        documents={filteredDocuments}
        viewMode={viewMode}
        categories={DOCUMENT_CATEGORIES}
        loading={loading}
        onPreview={setSelectedDocument}
        onDelete={handleDelete}
        onVerify={handleVerify}
        onUpload={() => setShowUploadZone(true)}
      />

      {/* Preview Modal */}
      {selectedDocument && (
        <DocumentPreviewModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDelete={handleDelete}
          onVerify={handleVerify}
        />
      )}
    </div>
  );
};

// Mock data for development
const getMockDocuments = () => [
  {
    id: 'doc1',
    name: 'John_Resume_2025.pdf',
    category: 'resume',
    type: 'application/pdf',
    size: 245000,
    uploadedAt: '2025-12-19T10:30:00Z',
    status: 'verified',
    thumbnailUrl: '/api/thumbnails/doc1.jpg',
    fileUrl: '/uploads/doc1.pdf'
  },
  {
    id: 'doc2',
    name: 'passport_photo.jpg',
    category: 'photograph',
    type: 'image/jpeg',
    size: 180000,
    uploadedAt: '2025-12-19T09:15:00Z',
    status: 'verified',
    thumbnailUrl: '/api/thumbnails/doc2.jpg',
    fileUrl: '/uploads/doc2.jpg'
  },
  {
    id: 'doc3',
    name: 'aadhar_front.pdf',
    category: 'aadhar',
    type: 'application/pdf',
    size: 320000,
    uploadedAt: '2025-12-18T14:20:00Z',
    status: 'pending',
    thumbnailUrl: '/api/thumbnails/doc3.jpg',
    fileUrl: '/uploads/doc3.pdf'
  }
];

export default DocumentManager;
