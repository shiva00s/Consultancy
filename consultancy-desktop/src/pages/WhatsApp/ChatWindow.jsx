// src/pages/WhatsApp/ChatWindow.jsx

import { useState, useEffect, useRef } from 'react';
import { Send, Smile, Paperclip, MoreVertical, Phone, Video, User, Trash2, Copy, MessageSquare, WifiOff } from 'lucide-react';
import io from 'socket.io-client';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

const ChatWindow = ({ conversation, isConnected }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const messagesEndRef = useRef(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // ✅ Store socket in a ref that persists across renders
  const socketRef = useRef(null);
  // ✅ Store current conversation ID in ref for socket handler
  const currentConversationIdRef = useRef(null);

  const emojiList = ['😀','😁','😂','😊','😍','😎','😢','😡','👍','🙏','🎉','🔥'];

  // ✅ Update conversation ref whenever it changes
  useEffect(() => {
    currentConversationIdRef.current = conversation?.id;
  }, [conversation?.id]);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation?.id) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversation?.id]);

  // Auto-scroll when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ✅ FIXED: Socket.IO - Connect ONCE and persist across conversation changes
  useEffect(() => {
    console.log('[Socket.IO] 🔌 Initializing persistent connection');
    
    // Create socket connection ONCE
    const socket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] ✅ Connected to webhook server');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] ⚠️ Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.IO] ❌ Connection error:', error);
    });

    // ✅ Message handler uses REF to get current conversation
    const handleNewMessage = (data) => {
      console.log('[Socket.IO] 📨 Message received:', data);
      
      const msgConvId = data.conversation_id || data.conversationid;
      const currentConvId = currentConversationIdRef.current;
      
      // Only add if message belongs to CURRENTLY OPEN conversation
      if (currentConvId && msgConvId === currentConvId) {
        setMessages(prev => {
          // Prevent duplicates
          const exists = prev.some(m => 
            m.id === data.id || 
            (m.message_sid && m.message_sid === data.message_sid)
          );
          
          if (exists) {
            console.log('[Socket.IO] ⏩ Duplicate detected, skipping');
            return prev;
          }
          
          console.log('[Socket.IO] ✅ Adding message to chat');
          return [...prev, data];
        });
        
        // Auto-scroll to new message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        console.log('[Socket.IO] ⏭️ Message for different conversation, ignoring');
      }
    };

    socket.on('whatsapp:new-message', handleNewMessage);

    // ✅ Cleanup ONLY on component unmount (not on conversation change!)
    return () => {
      console.log('[Socket.IO] 🔌 Disconnecting');
      socket.off('whatsapp:new-message', handleNewMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // ✅ Empty deps - connect ONCE on mount, disconnect on unmount only

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

  // ✅ Send message - DON'T add to UI, let Socket.IO handle it
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() && selectedFiles.length === 0) return;

    try {
      setSending(true);
      setSendError(null);

      const result = await window.electronAPI.whatsapp.sendMessage({
        conversationId: conversation.id,
        phoneNumber: conversation?.phone_number,
        message: inputMessage.trim() || ' ',
        attachments: selectedFiles.length > 0 ? selectedFiles : undefined
      });

      if (result.success) {
        // ✅ Clear inputs only - Socket.IO will add the message
        setInputMessage('');
        setSelectedFiles([]);
        setSendError(null);
      } else {
        setSendError(result.error || 'Failed to send message');
      }
    } catch (error) {
      setSendError(error.message || 'An unexpected error occurred');
    } finally {
      setSending(false);
    }
  };

  const handleEmojiClick = (emoji) => {
    setInputMessage(prev => prev + emoji);
    setShowEmoji(false);
  };

  const handleAttachClick = async () => {
    try {
      const pick = await window.electronAPI.openFileDialog({ filters: [] });
      if (!pick || !pick.success) return;

      const uploadRes = await window.electronAPI.uploadDocument({ 
        candidateId: conversation.candidate_id || conversation.candidateid || null, 
        filePath: pick.filePath, 
        originalName: pick.fileName, 
        meta: { category: 'WhatsApp_Attachment' } 
      });
      
      if (uploadRes && uploadRes.success) {
        setSelectedFiles([{ 
          id: uploadRes.data.id, 
          path: uploadRes.data.path || uploadRes.data.filePath, 
          filePath: uploadRes.data.path || uploadRes.data.filePath, 
          originalName: uploadRes.data.fileName,
          fileName: uploadRes.data.fileName,
          mimeType: uploadRes.data.mimeType || uploadRes.data.fileType,
          fileType: uploadRes.data.mimeType || uploadRes.data.fileType
        }]);
      } else {
        console.error('Attachment upload failed', uploadRes);
      }
    } catch (err) {
      console.error('Attach error', err);
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
            {conversation.photo_base64 || conversation.photobase64 ? (
              <img 
                src={conversation.photo_base64 || conversation.photobase64} 
                alt={conversation.candidate_name || conversation.candidatename || 'avatar'} 
                loading="lazy" 
                className="chat-avatar-photo img-loaded" 
              />
            ) : conversation.photo_path || conversation.photopath ? (
              <img 
                src={`file://${conversation.photo_path || conversation.photopath}`} 
                alt={conversation.candidate_name || conversation.candidatename || 'avatar'} 
                loading="lazy" 
                className="chat-avatar-photo" 
              />
            ) : (
              (conversation.candidate_name || conversation.candidatename || '?').charAt(0)?.toUpperCase()
            )}
          </div>
          <div className="chat-info">
            <h3>{conversation.candidate_name || conversation.candidatename || 'Unknown'}</h3>
            <p className="chat-phone">{conversation.phone_number || conversation.phonenumber}</p>
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
              <div 
                key={`msg-${message.id}-${message.message_sid || message.timestamp}`}
                onContextMenu={(e) => handleContextMenu(e, message)}
              >
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

        {selectedFiles && selectedFiles.length > 0 && (
          <div className="pending-attachments">
            {selectedFiles.map((att, i) => (
              <div key={i} className="pending-attachment-item">
                <Paperclip size={14} />
                <span>{att.originalName || att.fileName || 'File'}</span>
                <button type="button" onClick={() => setSelectedFiles([])} className="remove-attachment">✖</button>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <button 
            type="button" 
            className="input-icon-btn" 
            title="Emoji"
            disabled={!isConnected}
            onClick={() => setShowEmoji(!showEmoji)}
          >
            <Smile size={22} />
          </button>
          
          <button 
            type="button" 
            className="input-icon-btn" 
            title="Attach File"
            disabled={!isConnected}
            onClick={handleAttachClick}
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
            disabled={(!inputMessage.trim() && selectedFiles.length === 0) || !isConnected || sending}
            title="Send message"
          >
            {sending ? (
              <div className="spinner-small"></div>
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>

        {showEmoji && (
          <div className="emoji-picker">
            {emojiList.map((em, i) => (
              <button key={i} type="button" className="emoji-btn" onClick={() => handleEmojiClick(em)}>{em}</button>
            ))}
          </div>
        )}
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
