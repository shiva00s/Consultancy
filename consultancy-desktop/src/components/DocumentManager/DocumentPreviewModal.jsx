import React, { useState } from 'react';
import { FiX, FiDownload, FiTrash2, FiCheckCircle, FiXCircle, FiZoomIn, FiZoomOut, FiMaximize2 } from 'react-icons/fi';
import { Document, Page, pdfjs } from 'react-pdf';
import './DocumentPreviewModal.css';

// ✅ Set up PDF.js worker (CDN - Most Reliable)
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DocumentPreviewModal = ({ document, onClose, onDelete, onVerify }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const isImage = document.type?.startsWith('image/');
  const isPDF = document.type === 'application/pdf';

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // PDF handlers
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = document.fileUrl;
    link.download = document.name;
    link.click();
  };

  // Handle delete
  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      onDelete(document.id);
      onClose();
    }
  };

  // Handle verify
  const handleVerify = () => {
    onVerify(document.id, 'verified');
    onClose();
  };

  // Handle reject
  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onVerify(document.id, 'rejected', rejectReason);
    onClose();
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title-section">
            <h3>{document.name}</h3>
            <div className="preview-meta">
              <span>📊 {formatFileSize(document.size)}</span>
              <span>•</span>
              <span>📅 {formatDate(document.uploadedAt)}</span>
              <span>•</span>
              <span className={`status-indicator ${document.status}`}>
                {document.status === 'verified' && <><FiCheckCircle /> Verified</>}
                {document.status === 'pending' && <>⚠️ Pending</>}
                {document.status === 'rejected' && <><FiXCircle /> Rejected</>}
              </span>
            </div>
          </div>

          <div className="preview-actions-header">
            {/* Zoom controls for images */}
            {isImage && (
              <div className="zoom-controls">
                <button onClick={zoomOut} title="Zoom Out" disabled={scale <= 0.5}>
                  <FiZoomOut />
                </button>
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
                <button onClick={zoomIn} title="Zoom In" disabled={scale >= 2.5}>
                  <FiZoomIn />
                </button>
                <button onClick={resetZoom} title="Reset Zoom">
                  <FiMaximize2 />
                </button>
              </div>
            )}

            <button className="preview-btn download" onClick={handleDownload} title="Download">
              <FiDownload /> Download
            </button>
            <button className="preview-btn close" onClick={onClose} title="Close">
              <FiX />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="preview-content">
          {isImage && (
            <div className="image-preview-container">
              <img
                src={document.fileUrl}
                alt={document.name}
                style={{ transform: `scale(${scale})` }}
                onLoad={() => setLoading(false)}
              />
            </div>
          )}

          {isPDF && (
            <div className="pdf-preview-container">
              <Document
                file={document.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="loading-preview">
                    <div className="spinner"></div>
                    <p>Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="error-preview">
                    <p>Failed to load PDF</p>
                    <button onClick={handleDownload}>Download Instead</button>
                  </div>
                }
                options={{
                  cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                  cMapPacked: true,
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* PDF Controls */}
              {!loading && numPages && (
                <div className="pdf-controls">
                  <div className="pdf-pagination">
                    <button
                      onClick={previousPage}
                      disabled={pageNumber <= 1}
                      className="page-btn"
                    >
                      ‹ Previous
                    </button>
                    <span className="page-info">
                      Page {pageNumber} of {numPages}
                    </span>
                    <button
                      onClick={nextPage}
                      disabled={pageNumber >= numPages}
                      className="page-btn"
                    >
                      Next ›
                    </button>
                  </div>

                  <div className="pdf-zoom">
                    <button onClick={zoomOut} disabled={scale <= 0.5}>
                      <FiZoomOut />
                    </button>
                    <span>{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn} disabled={scale >= 2.5}>
                      <FiZoomIn />
                    </button>
                    <button onClick={resetZoom}>
                      <FiMaximize2 />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isImage && !isPDF && (
            <div className="unsupported-preview">
              <div className="unsupported-icon">📄</div>
              <h4>Preview not available</h4>
              <p>This file type cannot be previewed in the browser</p>
              <button className="download-fallback" onClick={handleDownload}>
                <FiDownload /> Download to view
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="preview-footer">
          {document.status === 'rejected' && document.rejectionReason && (
            <div className="rejection-info">
              <FiXCircle />
              <div>
                <strong>Rejection Reason:</strong>
                <p>{document.rejectionReason}</p>
              </div>
            </div>
          )}

          {document.status === 'pending' && (
            <div className="verification-actions">
              {!showRejectInput ? (
                <>
                  <button className="verify-btn approve" onClick={handleVerify}>
                    <FiCheckCircle /> Approve Document
                  </button>
                  <button className="verify-btn reject" onClick={() => setShowRejectInput(true)}>
                    <FiXCircle /> Reject Document
                  </button>
                </>
              ) : (
                <div className="reject-input-group">
                  <input
                    type="text"
                    placeholder="Enter rejection reason..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    autoFocus
                  />
                  <button className="verify-btn reject-confirm" onClick={handleReject}>
                    Confirm Reject
                  </button>
                  <button className="verify-btn cancel" onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason('');
                  }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="delete-btn" onClick={handleDelete}>
            <FiTrash2 /> Delete Document
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
