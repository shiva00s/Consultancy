// src/pages/WhatsApp/MessageBubble.jsx

import { Check, CheckCheck, Clock, File } from 'lucide-react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.direction === 'outbound' || message.sender_type === 'user';

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Check size={14} />;
      case 'delivered':
        return <CheckCheck size={14} />;
      case 'read':
        return <CheckCheck size={14} className="read" />;
      default:
        return <Clock size={14} />;
    }
  };

  const renderAttachment = () => {
    // Prefer attachments array (multiple attachments)
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      return (
        <div className="message-attachments">
          {message.attachments.map((att) => {
            const url = att.url || att.path || att.file_path || '';
            const name = att.originalName || (url && url.split(/[\\\/]/).pop()) || 'attachment';

            // Only render if we have a usable URL (http/data/blob)
            if (!url || (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:'))) {
              return null;
            }

            if (/\.(png|jpe?g|gif|webp)$/i.test(url) || (att.mimeType && att.mimeType.startsWith('image'))) {
              return (
                <div key={att.id || name} className="message-attachment image">
                  <img src={url} alt={name} loading="lazy" className="img-loading" onLoad={(e) => { try { e.currentTarget.classList.remove('img-loading'); e.currentTarget.classList.add('img-loaded'); } catch (err) {} }} />
                </div>
              );
            }

            return (
              <div key={att.id || name} className="message-attachment file">
                <a href={url} target="_blank" rel="noreferrer">
                  <File size={18} /> {name}
                </a>
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback: single media_url on message
    if (!message.media_url) return null;
    const url = message.media_url;
    const name = message.media_name || url.split(/[\\\/]/).pop();
    if (/\.(png|jpe?g|gif|webp)$/i.test(url) || (message.media_type && message.media_type.startsWith('image'))) {
      // If it's a local path, renderer can display it directly, or it may already be a data URI
      return (
        <div className="message-attachment image">
          <img src={url} alt={name} loading="lazy" className="img-loading" onLoad={(e) => { try { e.currentTarget.classList.remove('img-loading'); e.currentTarget.classList.add('img-loaded'); } catch (err) {} }} />
        </div>
      );
    }

    // Fallback: file link
    return (
      <div className="message-attachment file">
        <a href={url} target="_blank" rel="noreferrer">
          <File size={18} /> {name}
        </a>
      </div>
    );
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'other'}`}>
      <div className="message-content">
        {message.body && <p className="message-text">{message.body}</p>}
        {renderAttachment()}
        <div className="message-meta">
          <span className="message-time">{formatTime(message.timestamp)}</span>
          {isUser && (
            <span className="message-status">
              {getStatusIcon()}
            </span>
          )}
          {message.edited && (
            <span className="edited-label">edited</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
