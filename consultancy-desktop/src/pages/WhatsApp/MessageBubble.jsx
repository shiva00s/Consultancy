// src/pages/WhatsApp/MessageBubble.jsx

import { useState } from 'react';
import { Check, CheckCheck, Clock, X, Download, FileText, Image as ImageIcon, Paperclip, AlertCircle } from 'lucide-react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.direction === 'outbound' || message.sender_type === 'user';
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);

  // ✅ Safe time formatter with error handling
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

  // ✅ Status icon with fallback
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
          return <Clock size={16} className="status-icon status-pending" />;
        default:
          return <Check size={16} className="status-icon status-sent" />;
      }
    } catch (error) {
      console.error('⚠️ Error rendering status icon:', error);
      return null;
    }
  };

  // ✅ Safe media URL getter with multiple fallbacks
  const getMediaUrl = () => {
    try {
      // Try different field names for backward compatibility
      return (
        message?.media_url ||
        message?.mediaUrl ||
        message?.mediaurl ||
        message?.media_path ||
        message?.mediaPath ||
        message?.mediapath ||
        null
      );
    } catch (error) {
      console.error('⚠️ Error getting media URL:', error);
      return null;
    }
  };

  // ✅ Safe media type getter
  const getMediaType = () => {
    try {
      return (
        message?.media_type ||
        message?.mediaType ||
        message?.mediatype ||
        message?.content_type ||
        message?.contentType ||
        null
      );
    } catch (error) {
      console.error('⚠️ Error getting media type:', error);
      return null;
    }
  };

  // ✅ Safe file name getter
  const getFileName = () => {
    try {
      return (
        message?.file_name ||
        message?.fileName ||
        message?.filename ||
        message?.media_name ||
        message?.mediaName ||
        message?.medianame ||
        'Attachment'
      );
    } catch (error) {
      return 'Attachment';
    }
  };

  // ✅ Render media attachment with error boundaries
  const renderAttachment = () => {
    try {
      const mediaUrl = getMediaUrl();
      const mediaType = getMediaType();

      // If no media URL, skip rendering
      if (!mediaUrl) {
        return null;
      }

      // If media failed to load, show fallback
      if (mediaLoadError) {
        return (
          <div className="message-attachment-fallback">
            <AlertCircle size={16} />
            <span>Media unavailable</span>
          </div>
        );
      }

      // ✅ Render IMAGE
      if (mediaType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl)) {
        return (
          <div className="message-image-container">
            <img
              src={mediaUrl}
              alt="Attachment"
              className="message-image"
              onClick={() => setSelectedImage(mediaUrl)}
              onError={() => {
                console.warn('⚠️ Image failed to load:', mediaUrl);
                setMediaLoadError(true);
              }}
              loading="lazy"
            />
          </div>
        );
      }

      // ✅ Render DOCUMENT/FILE
      const fileName = getFileName();
      const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE';

      return (
        <div className="message-attachment">
          <div className="attachment-icon-wrapper">
            {mediaType?.startsWith('application/pdf') ? (
              <FileText size={20} className="attachment-icon" />
            ) : (
              <Paperclip size={20} className="attachment-icon" />
            )}
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
            className="attachment-download-btn"
            title="Download"
            onClick={(e) => {
              // If download fails, prevent default
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

  // ✅ Render database attachments (if available)
  const renderDatabaseAttachments = () => {
    try {
      const attachments = message?.attachments;
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        return null;
      }

      return attachments.map((att, index) => {
        const fileName = att?.fileName || att?.file_name || att?.originalName || 'File';
        const filePath = att?.filePath || att?.file_path || att?.path;
        const fileType = att?.fileType || att?.file_type || att?.mimeType || 'application/octet-stream';

        if (!filePath) {
          return null; // Skip broken attachments
        }

        const fileExt = fileName.split('.').pop()?.toUpperCase() || 'FILE';

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
              href={`file://${filePath}`}
              download={fileName}
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

  // ✅ Main render with error boundary
  try {
    return (
      <>
        <div className={`message-bubble ${isUser ? 'user-message' : 'contact-message'}`}>
          <div className="message-content">
            {/* Message text */}
            {message?.body && <p className="message-text">{message.body}</p>}

            {/* Media attachment from message fields */}
            {renderAttachment()}

            {/* Database attachments */}
            {renderDatabaseAttachments()}

            {/* Message metadata */}
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
              />
              <a
                href={selectedImage}
                download
                className="lightbox-download"
                title="Download"
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
