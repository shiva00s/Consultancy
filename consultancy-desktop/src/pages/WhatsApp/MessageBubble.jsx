// src/pages/WhatsApp/MessageBubble.jsx - ENHANCED WITH FILE PREVIEW

import { useState, useEffect } from 'react';
import { 
  Check, CheckCheck, Clock, X, Download, FileText, Paperclip, AlertCircle,
  File, Image as ImageIcon, Video, Music, Archive, FileSpreadsheet
} from 'lucide-react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.direction === 'outbound' || message.sender_type === 'user';
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [imageLoadAttempts, setImageLoadAttempts] = useState(0);
  const [previewDocument, setPreviewDocument] = useState(null); // NEW: For PDF/video preview

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

  // ✅ NEW: Enhanced file type detection
  const getFileTypeInfo = (url, mimeType, fileName) => {
    const urlLower = url?.toLowerCase() || '';
    const fileExt = fileName?.split('.').pop()?.toUpperCase() || 'FILE';
    
    // Image types
    if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(urlLower)) {
      return { type: 'image', icon: ImageIcon, ext: fileExt, canPreview: true };
    }
    
    // PDF types
    if (mimeType?.includes('pdf') || urlLower.endsWith('.pdf')) {
      return { type: 'pdf', icon: FileText, ext: 'PDF', canPreview: true };
    }
    
    // Video types
    if (mimeType?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(urlLower)) {
      return { type: 'video', icon: Video, ext: fileExt, canPreview: true };
    }
    
    // Audio types
    if (mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(urlLower)) {
      return { type: 'audio', icon: Music, ext: fileExt, canPreview: true };
    }
    
    // Document types
    if (mimeType?.includes('word') || /\.(doc|docx)$/i.test(urlLower)) {
      return { type: 'document', icon: FileText, ext: fileExt, canPreview: false };
    }
    
    // Spreadsheet types
    if (mimeType?.includes('sheet') || mimeType?.includes('excel') || /\.(xls|xlsx|csv)$/i.test(urlLower)) {
      return { type: 'spreadsheet', icon: FileSpreadsheet, ext: fileExt, canPreview: false };
    }
    
    // Archive types
    if (/\.(zip|rar|7z|tar|gz)$/i.test(urlLower)) {
      return { type: 'archive', icon: Archive, ext: fileExt, canPreview: false };
    }
    
    // Default
    return { type: 'file', icon: File, ext: fileExt, canPreview: false };
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

  // ✅ NEW: Handle file preview (PDF, Video, Audio)
  const handleFilePreview = (url, fileName, type) => {
    console.log('📂 Opening file preview:', { fileName, type });
    setPreviewDocument({ url, fileName, type });
  };

  // ✅ UNIFIED ATTACHMENT RENDERER - Enhanced with preview support
  const renderAllAttachments = () => {
    try {
      // Priority 1: Check for attachments array (database format)
      const attachments = message?.attachments;
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        console.log('📎 Rendering database attachments:', {
          messageId: message?.id,
          count: attachments.length
        });

        return attachments.map((att, index) => {
          const fileName = att?.originalName || att?.original_name || att?.fileName || att?.file_name || 'File';
          const fileUrl = att?.url || att?.path || att?.filePath || att?.file_path;
          const mimeType = att?.mimeType || att?.mime_type || att?.fileType || att?.file_type || '';

          if (!fileUrl) return null;

          const fileInfo = getFileTypeInfo(fileUrl, mimeType, fileName);
          const IconComponent = fileInfo.icon;

          // Render IMAGE from attachments array
          if (fileInfo.type === 'image') {
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
                  onLoad={() => console.log('✅ Attachment image loaded:', fileName)}
                  loading="lazy"
                />
              </div>
            );
          }

          // Render ALL OTHER FILE TYPES (PDF, Video, Audio, Documents, etc.)
          return (
            <div key={`att-${index}`} className="message-attachment">
              <div className="attachment-icon-wrapper">
                <IconComponent size={20} className="attachment-icon" />
              </div>
              <div className="attachment-info">
                <span className="attachment-name" title={fileName}>
                  {fileName}
                </span>
                <span className="attachment-type">{fileInfo.ext}</span>
              </div>
              
              {/* Preview button for supported types */}
              {fileInfo.canPreview && (fileInfo.type === 'pdf' || fileInfo.type === 'video' || fileInfo.type === 'audio') && (
                <button
                  className="attachment-preview-btn"
                  onClick={() => handleFilePreview(fileUrl, fileName, fileInfo.type)}
                  title="Preview"
                >
                  <ImageIcon size={16} />
                </button>
              )}
              
              {/* Download button (always available) */}
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
      }

      // Priority 2: Fall back to legacy media fields (webhook format)
      const mediaUrl = getMediaUrl();
      if (!mediaUrl) {
        return null;
      }

      console.log('📎 Rendering legacy attachment:', {
        messageId: message?.id,
        url: mediaUrl.substring(0, 100)
      });

      const mediaType = getMediaType();
      const fileName = getFileName();
      const fileInfo = getFileTypeInfo(mediaUrl, mediaType, fileName);
      const IconComponent = fileInfo.icon;

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

      // ✅ Render IMAGE from legacy fields
      if (fileInfo.type === 'image') {
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

      // ✅ Render ALL OTHER FILE TYPES from legacy fields
      return (
        <div className="message-attachment">
          <div className="attachment-icon-wrapper">
            <IconComponent size={20} className="attachment-icon" />
          </div>
          <div className="attachment-info">
            <span className="attachment-name" title={fileName}>
              {fileName}
            </span>
            <span className="attachment-type">{fileInfo.ext}</span>
          </div>
          
          {/* Preview button for supported types */}
          {fileInfo.canPreview && (fileInfo.type === 'pdf' || fileInfo.type === 'video' || fileInfo.type === 'audio') && (
            <button
              className="attachment-preview-btn"
              onClick={() => handleFilePreview(mediaUrl, fileName, fileInfo.type)}
              title="Preview"
            >
              <ImageIcon size={16} />
            </button>
          )}
          
          {/* Download button */}
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
      console.error('⚠️ Error rendering attachments:', error);
      return (
        <div className="message-attachment-fallback">
          <AlertCircle size={16} />
          <span>Unable to load media</span>
        </div>
      );
    }
  };

  try {
    return (
      <>
        <div className={`message-bubble ${isUser ? 'user-message' : 'contact-message'}`}>
          <div className="message-content">
            {message?.body && <p className="message-text">{message.body}</p>}
            {renderAllAttachments()}
            <div className="message-meta">
              <span className="message-time">{formatTime(message?.timestamp)}</span>
              {isUser && getStatusIcon()}
            </div>
          </div>
        </div>

        {/* ✅ ENHANCED: Image Lightbox with Close Button */}
{selectedImage && !imageError && (
  <div 
    className="image-lightbox" 
    onClick={() => setSelectedImage(null)}
    onKeyDown={(e) => {
      if (e.key === 'Escape') setSelectedImage(null);
    }}
    tabIndex={0}
  >
    <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
      {/* ✅ ESC Hint */}
      <div className="lightbox-hint">
        Press ESC or click outside to close
      </div>
      
      {/* ✅ FLOATING CLOSE BUTTON (Top-right) */}
      <button
        className="lightbox-close"
        onClick={() => setSelectedImage(null)}
        title="Close (ESC)"
      >
        <X size={24} />
      </button>
      
      {/* Image */}
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
      
      {/* ✅ DOWNLOAD BUTTON (Bottom-right) */}
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


        {/* NEW: Document/Video/Audio Preview Modal with Enhanced Close */}
{previewDocument && (
  <div 
    className="document-preview-lightbox" 
    onClick={() => setPreviewDocument(null)}
    onKeyDown={(e) => {
      if (e.key === 'Escape') setPreviewDocument(null);
    }}
    tabIndex={0}
  >
    <div className="preview-content" onClick={(e) => e.stopPropagation()}>
      {/* ✅ FLOATING CLOSE BUTTON (Top-right) */}
      <button
        className="preview-close"
        onClick={() => setPreviewDocument(null)}
        title="Close (ESC)"
      >
        <X size={24} />
      </button>

      <div className="preview-header">
        <span className="preview-title">{previewDocument.fileName}</span>
      </div>

      <div className="preview-body">
        {/* PDF Preview */}
        {previewDocument.type === 'pdf' && (
          <iframe
            src={previewDocument.url}
            className="pdf-viewer"
            title="PDF Preview"
          />
        )}

        {/* Video Preview */}
        {previewDocument.type === 'video' && (
          <video
            src={previewDocument.url}
            controls
            className="video-player"
            autoPlay
          >
            Your browser does not support video playback.
          </video>
        )}

        {/* Audio Preview */}
        {previewDocument.type === 'audio' && (
          <div className="audio-player-container">
            <audio
              src={previewDocument.url}
              controls
              className="audio-player"
              autoPlay
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
      </div>

      <div className="preview-footer">
        <a
          href={previewDocument.url}
          download={previewDocument.fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="preview-download-btn"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={18} />
          <span>Download</span>
        </a>
        
        {/* ✅ ALTERNATIVE: Close button in footer */}
        <button
          className="preview-close-btn"
          onClick={() => setPreviewDocument(null)}
        >
          <X size={18} />
          <span>Close</span>
        </button>
      </div>
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
