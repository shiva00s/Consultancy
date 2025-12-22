import React, { useState } from 'react';
import './ImagePreviewTooltip.css';
import LazyRemoteImage from './common/LazyRemoteImage.jsx';

const ImagePreviewTooltip = ({ fileName, filePath, children }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  const handleMouseEnter = async () => {
    // Defer loading to LazyRemoteImage which will fetch via preload when visible
    if (!imageUrl) setImageUrl(filePath);
    setShowPreview(true);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

  return (
    <div
      className="preview-wrapper"
      onMouseEnter={isImage ? handleMouseEnter : null}
      onMouseLeave={isImage ? handleMouseLeave : null}
    >
      {children}
      
      {showPreview && imageUrl && (
        <div className="image-preview-tooltip">
          <div style={{ width: 240, height: 160 }}>
            <LazyRemoteImage filePath={imageUrl} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePreviewTooltip;
