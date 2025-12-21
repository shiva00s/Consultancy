// src/pages/WhatsApp/ChatWindow.jsx

import { useState, useEffect, useRef } from 'react';
import { Send, Smile, Paperclip, MoreVertical, Phone, Video, User, Trash2, Copy, MessageSquare, WifiOff } from 'lucide-react';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

const ChatWindow = ({ conversation, isConnected }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (conversation?.id) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for new messages in real-time
    const handleNewMessage = (message) => {
      if (conversation && message.conversation_id === conversation.id) {
        setMessages(prev => [...prev, message]);
      }
    };

    if (window.electronAPI?.whatsapp?.onNewMessage) {
      window.electronAPI.whatsapp.onNewMessage(handleNewMessage);
    }

    return () => {
      // Cleanup if needed
    };
  }, [conversation]);

  const loadMessages = async () => {
    if (!conversation?.id) return;

    setLoading(true);
    try {
      const response = await window.electronAPI.whatsapp.getMessages(conversation.id);
      
      if (response?.success) {
        setMessages(response.data || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    // ✅ FIX: Comprehensive validation
    if (!inputMessage.trim()) {
      console.warn('Empty message');
      return;
    }
    
    if (!conversation) {
      console.error('No conversation selected');
      alert('Please select a conversation first');
      return;
    }

    if (!conversation.phone_number) {
      console.error('No phone number in conversation');
      alert('Invalid conversation - missing phone number');
      return;
    }

    if (!isConnected) {
      console.error('WhatsApp not connected');
      alert('WhatsApp is not connected. Please configure your settings.');
      return;
    }

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const response = await window.electronAPI.whatsapp.sendMessage({
        conversationId: conversation.id,
        phoneNumber: conversation.phone_number, // ✅ Use phoneNumber key
        message: messageContent // ✅ Use message key
      });

      if (response?.success) {
        // Add message to UI immediately
        const newMessage = {
          id: response.data?.id || Date.now(),
          conversation_id: conversation.id,
          direction: 'outbound',
          body: messageContent,
          status: response.data?.status || 'sent',
          timestamp: new Date().toISOString(),
          from_number: 'You',
          to_number: conversation.phone_number
        };
        
        setMessages(prev => [...prev, newMessage]);
        scrollToBottom();
      } else {
        console.error('Failed to send message:', response?.error);
        alert(`Failed to send message: ${response?.error || 'Unknown error'}`);
        // Restore message to input if failed
        setInputMessage(messageContent);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Error: ${error.message}`);
      // Restore message to input if error
      setInputMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    setSelectedMessage(message);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCopyMessage = () => {
    if (selectedMessage?.body) {
      navigator.clipboard.writeText(selectedMessage.body);
      setShowContextMenu(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      const response = await window.electronAPI.whatsapp.deleteMessage(selectedMessage.id);
      
      if (response?.success) {
        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setShowContextMenu(false);
      setSelectedMessage(null);
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  if (!conversation) {
    return (
      <div className="chat-window-empty">
        <div className="empty-state">
          <MessageSquare size={64} className="empty-icon" />
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-avatar">
            {conversation.candidate_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="chat-info">
            <h3>{conversation.candidate_name || 'Unknown'}</h3>
            <p className="chat-phone">{conversation.phone_number}</p>
            <p className="chat-status">
              {isConnected ? (
                <><span className="status-dot online"></span> Online</>
              ) : (
                <><span className="status-dot offline"></span> Offline</>
              )}
            </p>
          </div>
        </div>
        <div className="chat-header-right">
          <button className="icon-btn" title="Voice Call" disabled>
            <Phone size={20} />
          </button>
          <button className="icon-btn" title="Video Call" disabled>
            <Video size={20} />
          </button>
          <button className="icon-btn" title="More Options">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {loading ? (
          <div className="loading-messages">
            <div className="spinner"></div>
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            <User size={48} className="no-messages-icon" />
            <p>No messages yet</p>
            <p className="subtitle">Start the conversation!</p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((message) => (
              <div key={message.id} onContextMenu={(e) => handleContextMenu(e, message)}>
                <MessageBubble message={message} />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="chat-input-container">
        {!isConnected && (
          <div className="connection-warning">
            <WifiOff size={16} />
            <span>WhatsApp is not connected. Configure settings to send messages.</span>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <button 
            type="button" 
            className="input-icon-btn" 
            title="Emoji"
            disabled={!isConnected}
          >
            <Smile size={22} />
          </button>
          
          <button 
            type="button" 
            className="input-icon-btn" 
            title="Attach File"
            disabled={!isConnected}
          >
            <Paperclip size={22} />
          </button>
          
          <input
            type="text"
            placeholder={isConnected ? "Type a message..." : "Connect WhatsApp to send messages"}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="message-input"
            disabled={!isConnected || sending}
            autoComplete="off"
          />
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={!inputMessage.trim() || !isConnected || sending}
            title="Send message"
          >
            {sending ? (
              <div className="spinner-small"></div>
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </div>

      {/* Context Menu */}
      {showContextMenu && selectedMessage && (
        <div 
          className="context-menu" 
          style={{ 
            top: contextMenuPosition.y, 
            left: contextMenuPosition.x 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleCopyMessage} className="context-menu-item">
            <Copy size={16} />
            <span>Copy</span>
          </button>
          {selectedMessage.direction === 'outbound' && (
            <button onClick={handleDeleteMessage} className="context-menu-item danger">
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
