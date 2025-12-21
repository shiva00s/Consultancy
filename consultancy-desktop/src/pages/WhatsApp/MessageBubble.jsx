// src/pages/WhatsApp/MessageBubble.jsx

import { Check, CheckCheck, Clock } from 'lucide-react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.sender_type === 'user';
  
  const formatTime = (timestamp) => {
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

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'other'}`}>
      <div className="message-content">
        <p>{message.content}</p>
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
