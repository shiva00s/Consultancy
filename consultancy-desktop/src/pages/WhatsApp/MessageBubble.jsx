// src/pages/WhatsApp/MessageBubble.jsx
import { Check, CheckCheck } from 'lucide-react';

const MessageBubble = ({ message }) => {
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent': return <Check size={16} />;
      case 'delivered': return <CheckCheck size={16} />;
      case 'read': return <CheckCheck size={16} className="text-blue-500" />;
      default: return null;
    }
  };
  
  return (
    <div className={`message-bubble ${message.sender_type}`}>
      <div className="message-content">
        {message.message_type === 'text' && <p>{message.content}</p>}
        {message.message_type === 'document' && (
          <a href={message.media_url} download>
            {message.media_filename}
          </a>
        )}
      </div>
      <div className="message-footer">
        <span className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
        {message.sender_type === 'user' && getStatusIcon()}
      </div>
    </div>
  );
};

export default MessageBubble;
