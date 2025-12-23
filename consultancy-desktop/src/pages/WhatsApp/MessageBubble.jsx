// src/pages/WhatsApp/MessageBubble.jsx

import { useState, useEffect } from 'react';
import { Check, CheckCheck, Clock, X, Download, FileText, Paperclip, AlertCircle } from 'lucide-react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.direction === 'outbound' || message.sender_type === 'user';
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [imageLoadAttempts, setImageLoadAttempts] = useState(0);

  // ✅ Reset error states when message changes
  useEffect(() => {
    setMediaLoadError(false);
    setImageError(false);
    setImageLoadAttempts(0);
  }, [message?.id]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.warn('⚠️ Invalid timestamp:', timestamp);
      return '';
    }
  };

  const getStatusIcon = () => {
    try {
      switch (message?.status) {
        case 'sent':
          return <Check size={16} className="status-icon status-sent" />;
        case 'delivered':
          return <CheckCheck size={16} className="status-icon status-delivered" />;
        case 'read':
          return <CheckCheck size={16} className="status-icon status-read" />;
        case 'failed':
          return <X size={16} className="status-icon status-failed" />;
        case 'pending':
        case 'queued':
        case 'sending':
          return <Clock size={16} className="status-icon status-pending" />;
        default:
          return <Check size={16} className="status-icon status-sent" />;
      }
    } catch (error) {
      console.error('⚠️ Error rendering status icon:', error);
      return null;
    }
  };

  const getMediaUrl = () => {
    try {
      const url = (
        message?.mediaurl ||
        message?.media_url ||
        message?.mediaUrl ||
        message?.media_path ||
        message?.mediaPath ||
        message?.mediapath ||
        null
      );
      
      // ✅ Add cache-busting for ngrok URLs to avoid stale cached errors
      if (url && url.includes('ngrok') && imageLoadAttempts > 0) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}_retry=${imageLoadAttempts}`;
      }
      
      return url;
    } catch (error) {
      console.error('⚠️ Error getting media URL:', error);
      return null;
    }
  };

  const getMediaType = () => {
    try {
      return (
        message?.mediatype ||
        message?.media_type ||
        message?.mediaType ||
        message?.content_type ||
        message?.contentType ||
        null
      );
    } catch (error) {
      console.error('⚠️ Error getting media type:', error);
      return null;
    }
  };

  const getFileName = () => {
    try {
      return (
        message?.medianame ||
        message?.media_name ||
        message?.file_name ||
        message?.fileName ||
        message?.filename ||
        message?.mediaName ||
        'Attachment'
      );
    } catch (error) {
      return 'Attachment';
    }
  };

  const isImageMedia = (url, type) => {
    if (type?.startsWith('image/')) return true;
    
    if (url) {
      const urlWithoutQuery = url.split('?')[0];
      return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(urlWithoutQuery);
    }
    
    return false;
  };

  // ✅ Handle image load errors with detailed logging
  const handleImageError = (e, mediaUrl) => {
    console.error('❌ Image failed to load:', {
      url: mediaUrl?.substring(0, 100),
      messageId: message?.id,
      attempts: imageLoadAttempts,
      errorType: e?.type,
      target: e?.target?.src?.substring(0, 100)
    });

    setImageLoadAttempts(prev => prev + 1);
    
    // After 2 failed attempts, show fallback
    if (imageLoadAttempts >= 1) {
      setMediaLoadError(true);
      if (e?.target) {
        e.target.style.display = 'none';
      }
    }
  };

  // ✅ Handle successful image load
  const handleImageLoad = (e) => {
    console.log('✅ Image loaded successfully:', {
      messageId: message?.id,
      url: e?.target?.src?.substring(0, 100),
      width: e?.target?.naturalWidth,
      height: e?.target?.naturalHeight
    });
    setMediaLoadError(false);
    setImageError(false);
  };

  const renderAttachment = () => {
    try {
      const mediaUrl = getMediaUrl();
      const mediaType = getMediaType();
      const fileName = getFileName();

      if (!mediaUrl) {
        return null;
      }

      console.log('📎 Rendering attachment:', {
        messageId: message?.id,
        url: mediaUrl.substring(0, 100),
        type: mediaType,
        name: fileName
      });

      // If media failed to load after multiple attempts
      if (mediaLoadError) {
        return (
          <div className="message-attachment-fallback">
            <AlertCircle size={16} />
            <span className="fallback-text">Media unavailable</span>
            <span 
              className="fallback-action"
              onClick={() => {
                console.log('🔄 Retrying media load...');
                setMediaLoadError(false);
                setImageError(false);
                setImageLoadAttempts(0);
              }}
            >
              Retry
            </span>
            {/* ✅ DEBUG: Show URL for troubleshooting */}
            <details style={{ fontSize: '10px', marginTop: '5px' }}>
              <summary style={{ cursor: 'pointer' }}>Debug Info</summary>
              <code style={{ 
                display: 'block', 
                wordBreak: 'break-all', 
                fontSize: '9px',
                padding: '5px',
                background: '#f5f5f5',
                marginTop: '5px'
              }}>
                {mediaUrl}
              </code>
            </details>
          </div>
        );
      }

      // ✅ Render IMAGE (removed crossOrigin for Electron compatibility)
      if (isImageMedia(mediaUrl, mediaType)) {
        return (
          <div className="message-image-container">
            <img
              src={mediaUrl}
              alt={fileName}
              className="message-image"
              onClick={() => setSelectedImage(mediaUrl)}
              onError={(e) => handleImageError(e, mediaUrl)}
              onLoad={handleImageLoad}
              loading="lazy"
            />
          </div>
        );
      }

      // ✅ Render DOCUMENT/FILE
      const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE';
      const isPdf = mediaType?.includes('pdf') || fileExt === 'PDF';
      const isDoc = mediaType?.includes('word') || ['DOC', 'DOCX'].includes(fileExt);
      const isExcel = mediaType?.includes('sheet') || mediaType?.includes('excel') || ['XLS', 'XLSX'].includes(fileExt);

      return (
        <div className="message-attachment">
          <div className="attachment-icon-wrapper">
            {isPdf && <FileText size={20} className="attachment-icon" />}
            {isDoc && <FileText size={20} className="attachment-icon" />}
            {isExcel && <FileText size={20} className="attachment-icon" />}
            {!isPdf && !isDoc && !isExcel && <Paperclip size={20} className="attachment-icon" />}
          </div>
          <div className="attachment-info">
            <span className="attachment-name" title={fileName}>
              {fileName}
            </span>
            <span className="attachment-type">{fileExt}</span>
          </div>
          <a
            href={mediaUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="attachment-download-btn"
            title="Download"
            onClick={(e) => {
              if (mediaLoadError) {
                e.preventDefault();
                alert('This file is no longer available');
              }
            }}
          >
            <Download size={16} />
          </a>
        </div>
      );
    } catch (error) {
      console.error('⚠️ Error rendering attachment:', error);
      return (
        <div className="message-attachment-fallback">
          <AlertCircle size={16} />
          <span>Unable to load media</span>
        </div>
      );
    }
  };

  const renderDatabaseAttachments = () => {
    try {
      const attachments = message?.attachments;
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return null;
      }

      return attachments.map((att, index) => {
        const fileName = att?.originalName || att?.original_name || att?.fileName || att?.file_name || 'File';
        const fileUrl = att?.url || att?.path || att?.filePath || att?.file_path;
        const fileType = att?.mimeType || att?.mime_type || att?.fileType || att?.file_type || '';

        if (!fileUrl) {
          return null;
        }

        const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE';
        const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);

        if (isImage) {
          return (
            <div key={`att-${index}`} className="message-image-container">
              <img
                src={fileUrl}
                alt={fileName}
                className="message-image"
                onClick={() => setSelectedImage(fileUrl)}
                onError={(e) => {
                  console.error('❌ Attachment image failed:', fileUrl);
                  e.target.style.display = 'none';
                }}
                onLoad={() => console.log('✅ Attachment image loaded')}
                loading="lazy"
              />
            </div>
          );
        }

        return (
          <div key={`att-${index}`} className="message-attachment">
            <div className="attachment-icon-wrapper">
              <Paperclip size={20} className="attachment-icon" />
            </div>
            <div className="attachment-info">
              <span className="attachment-name" title={fileName}>
                {fileName}
              </span>
              <span className="attachment-type">{fileExt}</span>
            </div>
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="attachment-download-btn"
              title="Download"
            >
              <Download size={16} />
            </a>
          </div>
        );
      });
    } catch (error) {
      console.error('⚠️ Error rendering database attachments:', error);
      return null;
    }
  };

  try {
    return (
      <>
        <div className={`message-bubble ${isUser ? 'user-message' : 'contact-message'}`}>
          <div className="message-content">
            {message?.body && <p className="message-text">{message.body}</p>}
            {renderAttachment()}
            {renderDatabaseAttachments()}
            <div className="message-meta">
              <span className="message-time">{formatTime(message?.timestamp)}</span>
              {isUser && getStatusIcon()}
            </div>
          </div>
        </div>

        {/* Image Lightbox */}
        {selectedImage && !imageError && (
          <div className="image-lightbox" onClick={() => setSelectedImage(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button
                className="lightbox-close"
                onClick={() => setSelectedImage(null)}
                title="Close"
              >
                <X size={24} />
              </button>
              <img
                src={selectedImage}
                alt="Full size"
                className="lightbox-image"
                onError={() => {
                  console.warn('⚠️ Lightbox image failed to load');
                  setImageError(true);
                  setSelectedImage(null);
                }}
                onLoad={() => console.log('✅ Lightbox image loaded')}
              />
              <a
                href={selectedImage}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="lightbox-download"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={20} />
              </a>
            </div>
          </div>
        )}
      </>
    );
  } catch (error) {
    console.error('❌ Critical error rendering message bubble:', error);
    return (
      <div className="message-bubble contact-message">
        <div className="message-content">
          <div className="message-attachment-fallback">
            <AlertCircle size={16} />
            <span>Message unavailable</span>
          </div>
        </div>
      </div>
    );
  }
};

export default MessageBubble;
