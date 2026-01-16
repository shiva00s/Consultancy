import React, { useState, useEffect } from 'react';
import { 
  FiPackage, FiMapPin, FiUser, FiCalendar, FiTruck, FiFileText, 
  FiImage, FiX, FiChevronDown, FiChevronUp, FiPhone, FiClock, 
  FiTrash2, FiDownload, FiZoomIn, FiMaximize2, FiMinimize2 ,FiUserCheck
} from 'react-icons/fi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import useNotificationStore from '../../store/useNotificationStore';
import '../../css/passport-tracking/PassportTimeline.css';
import toast from 'react-hot-toast';

function PassportHistoryTimeline({ movements = [], user, onMovementDeleted }) {
  const [expandedMovement, setExpandedMovement] = useState(null);
  const [photoGalleryMovement, setPhotoGalleryMovement] = useState(null);
  const [movementPreviews, setMovementPreviews] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, movementId: null });
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const createNotification = useNotificationStore((s) => s.createNotification);

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
            // Store all photos for this movement
            previews[movement.id] = {
              photos: res.data.map(photo => ({
                id: photo.id,
                dataUrl: `data:${photo.file_type};base64,${photo.file_data}`,
                fileName: photo.file_name,
                fileType: photo.file_type,
                uploadedAt: photo.uploaded_at
              })),
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

  const formatTime = (dateString) => {
    // Accept either created_at or date strings. If invalid, return empty string so UI can hide it.
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const toggleExpand = (movementId) => {
    setExpandedMovement(expandedMovement === movementId ? null : movementId);
  };

  const handleDeleteClick = (movementId) => {
    setDeleteDialog({ open: true, movementId });
  };

  const handleDeleteConfirm = async () => {
  const movementId = deleteDialog.movementId;
  setDeleteDialog({ open: false, movementId: null });
  setDeletingId(movementId);

  try {
    console.log('Deleting movement:', { movementId, user: user.username });
    
    const res = await window.electronAPI.deletePassportMovement({
      id: movementId,  // ✅ Pass as 'id'
       user: user            // ✅ Pass complete user object
    });

    if (res.success) {
      toast.success('Movement deleted successfully');
      if (onMovementDeleted) onMovementDeleted();
        try {
          const movement = movements.find((m) => m.id === movementId) || {};
          createNotification({
            title: '🗑️ Passport movement deleted',
            message: `Passport movement ${movement.type || ''} deleted${movement.candidate_id ? ` for candidate ${movement.candidate_id}` : ''}`,
            type: 'warning',
            priority: 'high',
            link: movement.candidate_id ? `/candidate/${movement.candidate_id}` : null,
            actor: { id: user?.id, name: user?.name || user?.username },
            target: { type: 'passport_movement', id: movementId },
            meta: { movementId, candidateId: movement.candidate_id },
          });
        } catch (e) {}
    } else {
      console.error('Delete failed:', res);
      toast.error(res.message || res.error || 'Failed to delete movement');
    }
  } catch (err) {
    console.error('Error deleting movement:', err);
    toast.error('An error occurred while deleting the movement');
  } finally {
    setDeletingId(null);
  }
};


  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, movementId: null });
  };

  // ✨ NEW: Open lightbox with all images
  const openLightbox = (movementId, imageIndex = 0) => {
    const preview = movementPreviews[movementId];
    if (preview && preview.photos) {
      setLightboxImages(preview.photos);
      setCurrentImageIndex(imageIndex);
      setLightboxImage(preview.photos[imageIndex].dataUrl);
    }
  };

  // ✨ NEW: Navigate lightbox
  const navigateLightbox = (direction) => {
    const newIndex = direction === 'next' 
      ? (currentImageIndex + 1) % lightboxImages.length
      : (currentImageIndex - 1 + lightboxImages.length) % lightboxImages.length;
    
    setCurrentImageIndex(newIndex);
    setLightboxImage(lightboxImages[newIndex].dataUrl);
  };

  // ✨ NEW: Download image
  const downloadImage = (dataUrl, fileName) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName || 'passport-image.jpg';
    link.click();
    toast.success('Image downloaded');
  };

  // ✨ NEW: Close lightbox
  const closeLightbox = () => {
    setLightboxImage(null);
    setLightboxImages([]);
    setCurrentImageIndex(0);
  };

  if (!movements || movements.length === 0) {
    return (
      <div className="passport-timeline-empty">
        <div className="empty-icon">📋</div>
        <h3>No passport movements recorded yet</h3>
        <p>Start by recording a passport receive or send entry</p>
      </div>
    );
  }

  return (
    <>
      <div className="passport-timeline">
        {movements.map((movement, index) => {
          const isExpanded = expandedMovement === movement.id;
          const preview = movementPreviews[movement.id];
          const isDeleting = deletingId === movement.id;

          return (
            <div 
              key={movement.id} 
              className={`timeline-item ${movement.type.toLowerCase()} ${isDeleting ? 'deleting' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Timeline connector */}
              <div className="timeline-connector">
                <div className="timeline-dot">
                  {movement.type === 'RECEIVE' ? '📥' : '📤'}
                </div>
                {index < movements.length - 1 && <div className="timeline-line" />}
              </div>

              {/* Movement card */}
              <div className="timeline-card glass-card">
                {/* Header */}
                <div className="timeline-header">
                  <div className="header-left">
                    <span className={`movement-badge ${movement.type.toLowerCase()}`}>
                      {movement.type === 'RECEIVE' ? '📥 Received' : '📤 Sent'}
                    </span>
                    <div className="header-info">
                      <FiCalendar className="icon" />
                      <span className="date">{formatDate(movement.date)}</span>
                      {(() => {
                        const t = formatTime(movement.created_at || movement.date);
                        if (!t) return null;
                        return (
                          <>
                            <FiClock className="icon" />
                            <span className="time">{t}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="header-actions">
                    {preview && preview.totalCount > 0 && (
                      <button 
                        className="btn-icon photo-indicator"
                        onClick={() => openLightbox(movement.id, 0)}
                        title={`${preview.totalCount} photo(s)`}
                      >
                        <FiImage />
                        <span className="photo-count">{preview.totalCount}</span>
                      </button>
                    )}
                    
                    <button
                      className="btn-icon btn-expand"
                      onClick={() => toggleExpand(movement.id)}
                      title={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                    
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDeleteClick(movement.id)}
                      title="Delete movement"
                      disabled={isDeleting}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                {/* Quick info */}
                <div className="timeline-quick-info">
                  {movement.type === 'RECEIVE' ? (
                    <>
                      <div className="info-item">
                        <FiUser className="icon" />
                        <span>From: <strong>{movement.received_from}</strong></span>
                      </div>
                      <div className="info-item">
                        <FiUserCheck className="icon" />
                        <span>By: <strong>{movement.received_by}</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="info-item">
                        <FiMapPin className="icon" />
                        <span>To: <strong>{movement.send_to}</strong></span>
                      </div>
                      {movement.send_to_name && (
                        <div className="info-item">
                          <FiUser className="icon" />
                          <span>Name: <strong>{movement.send_to_name}</strong></span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="info-item">
                    <FiTruck className="icon" />
                    <span>Method: <strong>{movement.method}</strong></span>
                  </div>

                  {movement.courier_number && (
                    <div className="info-item">
                      <FiPackage className="icon" />
                      <span>Tracking: <strong>{movement.courier_number}</strong></span>
                    </div>
                  )}
                </div>

                {/* ✨ NEW: Photo thumbnails grid */}
                {preview && preview.photos && preview.photos.length > 0 && (
                  <div className="timeline-photos-grid">
                    {preview.photos.slice(0, 4).map((photo, idx) => (
                      <div 
                        key={photo.id} 
                        className="photo-thumbnail"
                        onClick={() => openLightbox(movement.id, idx)}
                      >
                        <img src={photo.dataUrl} alt={photo.fileName} />
                        <div className="photo-overlay">
                          <FiZoomIn />
                        </div>
                      </div>
                    ))}
                    
                    {preview.photos.length > 4 && (
                      <div 
                        className="photo-thumbnail more-photos"
                        onClick={() => openLightbox(movement.id, 4)}
                      >
                        <span>+{preview.photos.length - 4}</span>
                        <div className="photo-overlay">
                          <FiImage />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="timeline-details">
                    <div className="details-grid">
                      {movement.type === 'RECEIVE' ? (
                        <>
                          <div className="detail-item">
                            <label>Received From</label>
                            <value>{movement.received_from || 'N/A'}</value>
                          </div>
                          <div className="detail-item">
                            <label>Received By</label>
                            <value>{movement.received_by || 'N/A'}</value>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="detail-item">
                            <label>Sent To</label>
                            <value>{movement.send_to || 'N/A'}</value>
                          </div>
                          <div className="detail-item">
                            <label>Contact Person</label>
                            <value>{movement.send_to_name || 'N/A'}</value>
                          </div>
                          <div className="detail-item">
                            <label>Contact Number</label>
                            <value>{movement.send_to_contact || 'N/A'}</value>
                          </div>
                          <div className="detail-item">
                            <label>Sent By</label>
                            <value>{movement.sent_by || 'N/A'}</value>
                          </div>
                        </>
                      )}
                      
                      <div className="detail-item">
                        <label>Delivery Method</label>
                        <value>{movement.method || 'N/A'}</value>
                      </div>
                      
                      {movement.courier_number && (
                        <div className="detail-item">
                          <label>Courier/Tracking Number</label>
                          <value>{movement.courier_number}</value>
                        </div>
                      )}
                      
                      <div className="detail-item">
                        <label>Date</label>
                        <value>{formatDate(movement.date)}</value>
                      </div>
                      
                      <div className="detail-item">
                        <label>Recorded By</label>
                        <value>{movement.created_by || 'Unknown'}</value>
                      </div>
                    </div>

                    {movement.notes && (
                      <div className="detail-notes">
                        <label><FiFileText /> Notes</label>
                        <p>{movement.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ✨ NEW: Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox-modal" onClick={closeLightbox}>
          <div className="lightbox-overlay" />
          
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="lightbox-close" onClick={closeLightbox}>
              <FiX />
            </button>

            {/* Image info */}
            <div className="lightbox-header">
              <div className="image-info">
                <span className="image-counter">
                  {currentImageIndex + 1} / {lightboxImages.length}
                </span>
                <span className="image-name">
                  {lightboxImages[currentImageIndex]?.fileName}
                </span>
              </div>
              
              <button 
                className="btn-download"
                onClick={() => downloadImage(
                  lightboxImages[currentImageIndex].dataUrl,
                  lightboxImages[currentImageIndex].fileName
                )}
              >
                <FiDownload /> Download
              </button>
            </div>

            {/* Main image */}
            <div className="lightbox-image-container">
              <img 
                src={lightboxImage} 
                alt="Preview" 
                className="lightbox-image"
              />
            </div>

            {/* Navigation */}
            {lightboxImages.length > 1 && (
              <>
                <button 
                  className="lightbox-nav lightbox-prev"
                  onClick={() => navigateLightbox('prev')}
                >
                  ‹
                </button>
                <button 
                  className="lightbox-nav lightbox-next"
                  onClick={() => navigateLightbox('next')}
                >
                  ›
                </button>
              </>
            )}

            {/* Thumbnails */}
            {lightboxImages.length > 1 && (
              <div className="lightbox-thumbnails">
                {lightboxImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`lightbox-thumb ${idx === currentImageIndex ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentImageIndex(idx);
                      setLightboxImage(img.dataUrl);
                    }}
                  >
                    <img src={img.dataUrl} alt={`Thumbnail ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
{deleteDialog.open && (
  <ConfirmDialog
    open={deleteDialog.open}
    title="Delete Movement?"
    message="This will move the passport movement to the recycle bin. You can restore it later if needed."
    onConfirm={handleDeleteConfirm}
    onCancel={handleDeleteCancel}
    confirmLabel="Delete"
    cancelLabel="Cancel"
  />
)}

    </>
  );
}

export default PassportHistoryTimeline;