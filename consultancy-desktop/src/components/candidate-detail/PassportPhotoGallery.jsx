import React from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import '../../css/passport-tracking/PassportPhotoGallery.css';

function PassportPhotoGallery({ viewingPhotos, currentPhotoIndex, setCurrentPhotoIndex, onClose }) {
  if (!viewingPhotos || viewingPhotos.length === 0) return null;

  const currentPhoto = viewingPhotos[currentPhotoIndex];

  const handlePrevious = () => {
    setCurrentPhotoIndex((currentPhotoIndex - 1 + viewingPhotos.length) % viewingPhotos.length);
  };

  const handleNext = () => {
    setCurrentPhotoIndex((currentPhotoIndex + 1) % viewingPhotos.length);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPhotoIndex]);

  return (
    <div className="photo-gallery-overlay" onClick={onClose}>
      <div className="photo-gallery-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="photo-gallery-header">
          <div>
            <h3>{currentPhoto.file_name}</h3>
            <p>Photo {currentPhotoIndex + 1} of {viewingPhotos.length}</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* Image Display */}
        <div className="photo-gallery-content">
          {/* ✅ FIX: Use dataUrl property that includes data URI prefix */}
          <img 
            src={currentPhoto.dataUrl} 
            alt={currentPhoto.file_name}
            className="gallery-image"
          />

          {/* Navigation Arrows */}
          {viewingPhotos.length > 1 && (
            <>
              <button className="nav-btn prev" onClick={handlePrevious}>
                <FiChevronLeft />
              </button>
              <button className="nav-btn next" onClick={handleNext}>
                <FiChevronRight />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {viewingPhotos.length > 1 && (
          <div className="photo-gallery-thumbnails">
            {viewingPhotos.map((photo, index) => (
              <div
                key={index}
                className={`thumbnail ${index === currentPhotoIndex ? 'active' : ''}`}
                onClick={() => setCurrentPhotoIndex(index)}
              >
                <img src={photo.dataUrl} alt={`Thumbnail ${index + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PassportPhotoGallery;
