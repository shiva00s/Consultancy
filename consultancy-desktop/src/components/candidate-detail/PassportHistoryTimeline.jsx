import React, { useState, useEffect } from 'react';
import { 
  FiPackage, FiMapPin, FiUser, FiCalendar, 
  FiTruck, FiFileText, FiImage, FiX, FiChevronDown,
  FiChevronUp, FiPhone, FiClock, FiTrash2 
} from 'react-icons/fi';
import PassportPhotoGallery from './PassportPhotoGallery';
import ConfirmDialog from '../../components/ConfirmDialog'; 
import '../../css/passport-tracking/PassportTimeline.css';
import toast from 'react-hot-toast';


function PassportHistoryTimeline({ movements = [], user, onMovementDeleted }) {
  const [expandedMovement, setExpandedMovement] = useState(null);
  const [photoGalleryMovement, setPhotoGalleryMovement] = useState(null);
  const [movementPreviews, setMovementPreviews] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    movementId: null
  });

  // Fetch photo previews for all movements
  useEffect(() => {
    const fetchPreviews = async () => {
      const previews = {};
      for (const movement of movements) {
        try {
          const res = await window.electronAPI.getPassportMovementPhotos({
            movementId: movement.id,
            user: user
          });
          
          if (res.success && res.data && res.data.length > 0) {
            const firstPhoto = res.data[0];
            // ✅ FIX: Add data URL prefix with MIME type
            previews[movement.id] = {
              dataUrl: `data:${firstPhoto.file_type};base64,${firstPhoto.file_data}`,
              totalCount: res.data.length
            };
          }
        } catch (err) {
          console.error('Error fetching movement photos:', err);
        }
      }
      setMovementPreviews(previews);
    };

    if (movements.length > 0) {
      fetchPreviews();
    }
  }, [movements, user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid Date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Time formatting
  const formatTime = (dateString) => {
    if (!dateString) return 'Invalid Time';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Time';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const toggleExpand = (movementId) => {
    setExpandedMovement(expandedMovement === movementId ? null : movementId);
  };

  // ✅ OPEN DELETE DIALOG
  const handleDeleteClick = (movementId) => {
    setDeleteDialog({
      open: true,
      movementId
    });
  };

  // ✅ CONFIRM DELETE
  const handleDeleteConfirm = async () => {
    const movementId = deleteDialog.movementId;
    setDeleteDialog({ open: false, movementId: null });
    setDeletingId(movementId);

    try {
      // ✅ FIX: Pass 'id' instead of 'movementId'
      const res = await window.electronAPI.deletePassportMovement({ 
        id: movementId,  // ⬅️ Changed from 'movementId' to 'id'
        user 
      });
      
      if (res.success) {
        toast.success('Movement deleted successfully');
        if (onMovementDeleted) onMovementDeleted();
      } else {
        toast.error(res.message || 'Failed to delete movement');
      }
    } catch (err) {
      console.error('Error deleting movement:', err);
      toast.error('An error occurred while deleting the movement');
    } finally {
      setDeletingId(null);
    }
  };

  // ✅ CANCEL DELETE
  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, movementId: null });
  };

  if (!movements || movements.length === 0) {
    return (
      <div className="no-movements">
        <FiPackage size={48} />
        <p>No passport movements recorded yet</p>
      </div>
    );
  }

  return (
    <div className="passport-timeline-container">
      {/* ✅ Custom Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete Passport Movement"
        message="Are you sure you want to delete this passport movement? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <div className="timeline-roadmap">
        {movements.map((movement, index) => {
          const isReceive = movement.type === 'RECEIVE';
          const isExpanded = expandedMovement === movement.id;
          const preview = movementPreviews[movement.id];

          return (
            <div key={movement.id} className="timeline-milestone">
              {/* Connection Line */}
              {index < movements.length - 1 && (
                <div className="timeline-connector"></div>
              )}

              {/* Milestone Marker */}
              <div className={`milestone-marker ${isReceive ? 'receive' : 'send'}`}>
                {isReceive ? (
                  <FiPackage className="marker-icon" />
                ) : (
                  <FiMapPin className="marker-icon" />
                )}
              </div>

              {/* Milestone Card */}
              <div className={`milestone-card ${isReceive ? 'receive' : 'send'}`}>
                {/* Card Header */}
                <div className="card-header">
                  <div className="header-left">
                    <span className={`action-badge ${isReceive ? 'receive' : 'send'}`}>
                      {isReceive ? '📥 RECEIVED' : '📤 SENT'}
                    </span>
                    <span className="date-badge">
                      <FiCalendar /> {formatDate(movement.date)}
                    </span>
                    <span className="time-badge">
                      <FiClock /> {formatTime(movement.created_at)}
                    </span>
                  </div>

                  {/* ✅ Action Buttons Group */}
                  <div className="header-actions">
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteClick(movement.id)}
                      className="delete-btn"
                      disabled={deletingId === movement.id}
                      title="Delete Movement"
                    >
                      {deletingId === movement.id ? (
                        <span style={{ fontSize: '0.8rem' }}>...</span>
                      ) : (
                        <FiTrash2 />
                      )}
                    </button>

                    {/* Expand Button */}
                    <button
                      onClick={() => toggleExpand(movement.id)}
                      className="expand-btn"
                      title={isExpanded ? 'Collapse' : 'Expand Details'}
                    >
                      {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </div>
                </div>

                {/* Photo Preview Section */}
                {preview ? (
                  <div 
                    className="movement-photo-preview"
                    onClick={() => setPhotoGalleryMovement(movement.id)}
                  >
                    <img 
                      src={preview.dataUrl}
                      alt="Passport preview"
                      className="preview-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `
                          <div class="movement-photo-empty">
                            <svg class="empty-photo-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>Failed to load image</span>
                          </div>
                        `;
                      }}
                    />
                    <div className="photo-preview-overlay">
                      <FiImage className="overlay-icon" />
                      <span className="photo-count">
                        {preview.totalCount} {preview.totalCount === 1 ? 'Photo' : 'Photos'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="movement-photo-empty">
                    <FiImage className="empty-photo-icon" />
                    <span>No photos attached</span>
                  </div>
                )}

                {/* Card Body - Quick Info */}
                <div className="card-quick-info">
                  <div className="info-grid">
                    {/* WHO */}
                    <div className="info-item">
                      <span className="info-label">
                        <FiUser /> {isReceive ? 'From' : 'To'}
                      </span>
                      <span className="info-value">
                        {isReceive 
                          ? movement.received_from 
                          : (movement.send_to_name || movement.send_to)}
                      </span>
                    </div>

                    {/* HOW */}
                    <div className="info-item">
                      <span className="info-label">
                        <FiTruck /> Method
                      </span>
                      <span className="info-value">
                        {movement.method === 'By Hand' ? '✋ By Hand' : '🚚 By Courier'}
                      </span>
                    </div>

                    {/* BY WHOM */}
                    <div className="info-item">
                      <span className="info-label">
                        <FiUser /> {isReceive ? 'Received By' : 'Sent By'}
                      </span>
                      <span className="info-value">
                        {isReceive ? movement.received_by : movement.sent_by}
                      </span>
                    </div>

                    {/* PHOTOS BUTTON */}
                    {preview && (
                      <div className="info-item">
                        <button
                          onClick={() => setPhotoGalleryMovement(movement.id)}
                          className="view-photos-btn"
                        >
                          <FiImage /> View All Photos
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="card-expanded-details">
                    <div className="details-grid">
                      {/* Courier Number */}
                      {movement.courier_number && (
                        <div className="detail-row">
                          <span className="detail-label">
                            <FiTruck /> Courier Number
                          </span>
                          <span className="detail-value">{movement.courier_number}</span>
                        </div>
                      )}

                      {/* Contact (for SEND only) */}
                      {!isReceive && movement.send_to_contact && (
                        <div className="detail-row">
                          <span className="detail-label">
                            <FiPhone /> Contact Number
                          </span>
                          <span className="detail-value">{movement.send_to_contact}</span>
                        </div>
                      )}

                      {/* Notes */}
                      {movement.notes && (
                        <div className="detail-row full-width">
                          <span className="detail-label">
                            <FiFileText /> Notes
                          </span>
                          <p className="detail-value notes">{movement.notes}</p>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="metadata-row">
                        <span className="metadata-item">
                          📅 Recorded: {formatDate(movement.created_at)} at {formatTime(movement.created_at)}
                        </span>
                        {movement.created_by && (
                          <span className="metadata-item">
                            👤 By: {movement.created_by}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo Gallery Modal */}
      {photoGalleryMovement && (
        <div className="photo-gallery-modal">
          <div className="modal-overlay" onClick={() => setPhotoGalleryMovement(null)}></div>
          <div className="modal-content">
            <button
              onClick={() => setPhotoGalleryMovement(null)}
              className="modal-close-btn"
            >
              <FiX />
            </button>
            <PassportPhotoGallery 
              movementId={photoGalleryMovement} 
              user={user}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default PassportHistoryTimeline;
