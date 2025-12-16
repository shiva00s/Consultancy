import React from 'react';
import { FiX } from 'react-icons/fi';
import '../../css/passport-tracking/PassportPhotoGallery.css';

function PassportPhotoGallery({ 
  viewingPhotos, 
  currentPhotoIndex, 
  setCurrentPhotoIndex, 
  onClose 
}) {
  if (!viewingPhotos) return null;

  const handlePrevious = () => {
    setCurrentPhotoIndex((currentPhotoIndex - 1 + viewingPhotos.length) % viewingPhotos.length);
  };

  const handleNext = () => {
    setCurrentPhotoIndex((currentPhotoIndex + 1) % viewingPhotos.length);
  };

  return (
    <div className="photo-viewer-overlay" onClick={onClose}>
      <div className="photo-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>
          <FiX />
        </button>
        
        <img 
          src={`data:${viewingPhotos[currentPhotoIndex].file_type};base64,${viewingPhotos[currentPhotoIndex].file_data}`} 
          alt={`Photo ${currentPhotoIndex + 1}`}
        />
        
        <p>{viewingPhotos[currentPhotoIndex].file_name}</p>
        
        {viewingPhotos.length > 1 && (
          <div className="photo-navigation">
            <button 
              onClick={handlePrevious}
              className="nav-btn"
            >
              ← Previous
            </button>
            <span>{currentPhotoIndex + 1} / {viewingPhotos.length}</span>
            <button 
              onClick={handleNext}
              className="nav-btn"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PassportPhotoGallery;
