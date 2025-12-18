import React, { useState } from 'react';
import './ImagePreviewTooltip.css';

const ImagePreviewTooltip = ({ fileName, filePath, children }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  const handleMouseEnter = async () => {
    if (!imageUrl) {
      // Fetch image base64
      const res = await window.electronAPI.getImageBase64({ filePath });
      if (res.success) {
        setImageUrl(res.data);
      }
    }
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
          <img src={imageUrl} alt={fileName} />
        </div>
      )}
    </div>
  );
};

export default ImagePreviewTooltip;
