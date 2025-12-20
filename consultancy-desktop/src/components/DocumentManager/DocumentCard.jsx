import React, { useState } from 'react';
import { FiEye, FiDownload, FiTrash2, FiCheckCircle, FiAlertCircle, FiXCircle, FiFile } from 'react-icons/fi';
import './DocumentCard.css';
import ConfirmDialog from '../common/ConfirmDialog';

const DocumentCard = ({
  document,
  category,
  viewMode,
  animationDelay,
  onPreview,
  onDelete,
  onVerify
}) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get status info
  const getStatusInfo = (status) => {
    switch (status) {
      case 'verified':
        return { icon: FiCheckCircle, label: 'Verified', class: 'verified', color: '#10b981' };
      case 'pending':
        return { icon: FiAlertCircle, label: 'Pending', class: 'pending', color: '#f59e0b' };
      case 'rejected':
        return { icon: FiXCircle, label: 'Rejected', class: 'rejected', color: '#ef4444' };
      default:
        return { icon: FiAlertCircle, label: 'Unknown', class: 'unknown', color: '#64748b' };
    }
  };

  // Check if image
  const isImage = document.type?.startsWith('image/');
  const isPDF = document.type === 'application/pdf';
  const statusInfo = getStatusInfo(document.status);

  // Handle download
  const handleDownload = (e) => {
    e.stopPropagation();
    window.open(document.fileUrl, '_blank');
  };

  // Handle delete
  const handleDelete = (e) => {
    e.stopPropagation();
    // open confirm dialog instead of native confirm
    setConfirmAction({ type: 'delete' });
    setConfirmOpen(true);
  };

  // Handle verification actions
  const handleVerifyAction = (e, status) => {
    e.stopPropagation();
    if (status === 'rejected') {
      // start confirm -> then collect reason
      setPendingVerifyStatus('rejected');
      setConfirmAction({ type: 'reject' });
      setConfirmOpen(true);
      return;
    }
    onVerify(document.id, status, null);
  };

  // local confirm state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // reject reason flow
  const [pendingVerifyStatus, setPendingVerifyStatus] = useState(null);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (viewMode === 'list') {
    return (
      <>
      <div
        className={`document-card list-view ${statusInfo.class}`}
        style={{
          '--category-color': category?.color,
          '--animation-delay': `${animationDelay}s`
        }}
        onClick={() => onPreview(document)}
      >
        <div className="list-preview">
          {isImage && !imageError ? (
            <img
              src={document.thumbnailUrl || document.fileUrl}
              alt={document.name}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="file-icon" style={{ background: category?.color }}>
              {category?.icon || <FiFile />}
            </div>
          )}
        </div>

        <div className="list-details">
          <h4>{document.name}</h4>
          <div className="list-meta">
            <span className="meta-item">
              📁 {category?.name || 'Unknown'}
            </span>
            <span className="meta-item">
              📊 {formatFileSize(document.size)}
            </span>
            <span className="meta-item">
              📅 {formatDate(document.uploadedAt)}
            </span>
          </div>
        </div>

        <div className="list-status">
          <span className={`status-badge ${statusInfo.class}`}>
            <statusInfo.icon />
            {statusInfo.label}
          </span>
        </div>

        <div className="list-actions">
          <button className="action-btn preview" onClick={() => onPreview(document)} title="Preview">
            <FiEye />
          </button>
          <button className="action-btn download" onClick={handleDownload} title="Download">
            <FiDownload />
          </button>
          {document.status === 'pending' && (
            <>
              <button
                className="action-btn verify"
                onClick={(e) => handleVerifyAction(e, 'verified')}
                title="Verify"
              >
                <FiCheckCircle />
              </button>
              <button
                className="action-btn reject"
                onClick={(e) => handleVerifyAction(e, 'rejected')}
                title="Reject"
              >
                <FiXCircle />
              </button>
            </>
          )}
          <button className="action-btn delete" onClick={handleDelete} title="Delete">
            <FiTrash2 />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmAction?.type === 'delete' ? 'Delete Document' : 'Confirm Action'}
        message={
          confirmAction?.type === 'delete'
            ? `Delete "${document.name}"? This cannot be undone.`
            : `Confirm action for "${document.name}"?`
        }
        isDanger={confirmAction?.type === 'delete' || confirmAction?.type === 'reject'}
        onConfirm={() => {
          if (confirmAction?.type === 'delete') {
            onDelete(document.id);
            setConfirmOpen(false);
            setConfirmAction(null);
          } else if (confirmAction?.type === 'reject') {
            setConfirmOpen(false);
            setRejectReasonOpen(true);
          } else {
            setConfirmOpen(false);
            setConfirmAction(null);
          }
        }}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        confirmText={confirmAction?.type === 'delete' ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
      />

      {rejectReasonOpen && (
        <div className="confirm-overlay" onClick={() => setRejectReasonOpen(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-header">
              <div className="confirm-icon danger">⚠️</div>
              <button className="close-btn" onClick={() => setRejectReasonOpen(false)} type="button" title="Close">
                <FiXCircle />
              </button>
            </div>
            <div className="confirm-body">
              <h3>Provide rejection reason</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                style={{ width: '100%' }}
              />
            </div>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={() => setRejectReasonOpen(false)} type="button">Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  onVerify(document.id, 'rejected', rejectReason.trim());
                  setRejectReasonOpen(false);
                  setRejectReason('');
                  setPendingVerifyStatus(null);
                  setConfirmAction(null);
                }}
                type="button"
                disabled={!rejectReason.trim()}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      </>
    );
  }

  // Grid View
  return (
    <>
    <div
      className={`document-card grid-view ${statusInfo.class}`}
      style={{
        '--category-color': category?.color,
        '--animation-delay': `${animationDelay}s`
      }}
      onClick={() => onPreview(document)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status Badge */}
      <div className={`card-status-badge ${statusInfo.class}`}>
        <statusInfo.icon />
        <span>{statusInfo.label}</span>
      </div>

      {/* Category Badge */}
      <div className="card-category-badge" style={{ background: category?.color }}>
        <span>{category?.icon}</span>
      </div>

      {/* Preview Section */}
      <div className="card-preview">
        {isImage && !imageError ? (
          <img
            src={document.thumbnailUrl || document.fileUrl}
            alt={document.name}
            className={isHovered ? 'zoomed' : ''}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="file-preview-placeholder" style={{ background: category?.color + '20' }}>
            <div className="file-icon-large" style={{ color: category?.color }}>
              {isPDF ? '📄' : category?.icon || <FiFile size={48} />}
            </div>
            <span className="file-type">{document.type?.split('/')[1]?.toUpperCase()}</span>
          </div>

          <ConfirmDialog
            isOpen={confirmOpen}
            title={confirmAction?.type === 'delete' ? 'Delete Document' : 'Confirm Action'}
            message={
              confirmAction?.type === 'delete'
                ? `Delete "${document.name}"? This cannot be undone.`
                : `Confirm action for "${document.name}"?`
            }
            isDanger={confirmAction?.type === 'delete' || confirmAction?.type === 'reject'}
            onConfirm={() => {
              if (confirmAction?.type === 'delete') {
                onDelete(document.id);
                setConfirmOpen(false);
                setConfirmAction(null);
              } else if (confirmAction?.type === 'reject') {
                setConfirmOpen(false);
                setRejectReasonOpen(true);
              } else {
                setConfirmOpen(false);
                setConfirmAction(null);
              }
            }}
            onCancel={() => {
              setConfirmOpen(false);
              setConfirmAction(null);
            }}
            confirmText={confirmAction?.type === 'delete' ? 'Delete' : 'Confirm'}
            cancelText="Cancel"
          />

          {rejectReasonOpen && (
            <div className="confirm-overlay" onClick={() => setRejectReasonOpen(false)}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="confirm-header">
                  <div className="confirm-icon danger">⚠️</div>
                  <button className="close-btn" onClick={() => setRejectReasonOpen(false)} type="button" title="Close">
                    <FiXCircle />
                  </button>
                </div>
                <div className="confirm-body">
                  <h3>Provide rejection reason</h3>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="confirm-actions">
                  <button className="btn btn-cancel" onClick={() => setRejectReasonOpen(false)} type="button">Cancel</button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (!rejectReason.trim()) return;
                      onVerify(document.id, 'rejected', rejectReason.trim());
                      setRejectReasonOpen(false);
                      setRejectReason('');
                      setPendingVerifyStatus(null);
                      setConfirmAction(null);
                    }}
                    type="button"
                    disabled={!rejectReason.trim()}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          </>
        );

        {/* Hover Overlay */}
        <div className={`card-overlay ${isHovered ? 'visible' : ''}`}>
          <button className="overlay-btn" onClick={() => onPreview(document)}>
            <FiEye /> View
          </button>
        </div>
      </div>

      {/* Details Section */}
      <div className="card-details">
        <h4 className="card-title" title={document.name}>
          {document.name}
        </h4>

        <div className="card-meta">
          <span className="meta-size">📊 {formatFileSize(document.size)}</span>
          <span className="meta-date">📅 {formatDate(document.uploadedAt)}</span>
        </div>

        {document.rejectionReason && (
          <div className="rejection-reason">
            <FiAlertCircle />
            <span>{document.rejectionReason}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card-actions">
        <button
          className="action-btn download"
          onClick={handleDownload}
          title="Download"
        >
          <FiDownload />
        </button>

        {document.status === 'pending' && (
          <>
            <button
              className="action-btn verify"
              onClick={(e) => handleVerifyAction(e, 'verified')}
              title="Verify"
            >
              <FiCheckCircle />
            </button>
            <button
              className="action-btn reject"
              onClick={(e) => handleVerifyAction(e, 'rejected')}
              title="Reject"
            >
              <FiXCircle />
            </button>
          </>
        )}

        <button
          className="action-btn delete"
          onClick={handleDelete}
          title="Delete"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
};

export default DocumentCard;

