// src/pages/WhatsApp/WhatsAppMain.jsx

import { useState, useEffect } from 'react';
import LazyRemoteImage from '../../components/common/LazyRemoteImage';
import { MessageSquare, Plus, Settings, Wifi, WifiOff } from 'lucide-react';
import ChatWindow from './ChatWindow';
import NewChatModal from './NewChatModal';
import TwilioSettingsModal from './TwilioSettingsModal';
import './WhatsAppMain.css';

const WhatsAppMain = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    checkWhatsAppStatus();
    loadConversations();
    setupEventListeners();
  }, []);

  const checkWhatsAppStatus = async () => {
    try {
      const response = await window.electronAPI.whatsapp.getStatus();
      
      setHasCredentials(response.hasCredentials);
      
      if (response.isReady) {
        setIsConnected(true);
        setConnectionStatus('connected');
      } else if (!response.hasCredentials) {
        setConnectionStatus('not-configured');
        setShowSettingsModal(true);
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setConnectionStatus('disconnected');
    }
  };

  const setupEventListeners = () => {
    window.electronAPI.whatsapp.onReady(() => {
      console.log('✅ WhatsApp connected!');
      setIsConnected(true);
      setConnectionStatus('connected');
      loadConversations();
    });

    window.electronAPI.whatsapp.onDisconnected((reason) => {
      console.log('⚠️ WhatsApp disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    });

    window.electronAPI.whatsapp.onNewMessage((message) => {
      console.log('📨 New message received:', message);
      loadConversations();
      
      // If this conversation is selected, it will auto-refresh
      if (selectedConversation && message.conversation_id === selectedConversation.id) {
        // Messages will be updated by ChatWindow component
      }
    });
  };

  const loadConversations = async () => {
    try {
      const response = await window.electronAPI.whatsapp.getConversations();
      
      if (response?.success) {
        const conversationsData = Array.isArray(response.data) 
          ? response.data 
          : [];
        setConversations(conversationsData);
        // Prefetch small thumbnails during idle to avoid blocking UI
        try {
          const prefetch = () => {
            if (!Array.isArray(conversationsData)) return;
            for (let i = 0; i < Math.min(8, conversationsData.length); i++) {
              const c = conversationsData[i];
              if (c && c.photo_path) {
                window.electronAPI.getThumbnail({ filePath: c.photo_path, maxWidth: 64, maxHeight: 64 }).catch(() => {});
              }
            }
          };
          if (typeof window.requestIdleCallback === 'function') requestIdleCallback(prefetch, { timeout: 1000 });
          else setTimeout(prefetch, 500);
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // ✅ FIX: Handle new chat properly
  const handleNewChat = (newConversation) => {
    console.log('📝 New conversation created:', newConversation);
    
    // ✅ Ensure phone_number is set
    const conversationWithPhone = {
      ...newConversation,
      phone_number: newConversation.phone_number || newConversation.phoneNumber
    };
    
    // Add to conversations list if not already there
    setConversations(prev => {
      const exists = prev.find(c => c.id === conversationWithPhone.id);
      if (exists) {
        return prev.map(c => c.id === conversationWithPhone.id ? conversationWithPhone : c);
      }
      return [conversationWithPhone, ...prev];
    });
    
    // Select the new conversation
    setSelectedConversation(conversationWithPhone);
    setShowNewChatModal(false);
  };

  const handleSettingsSaved = () => {
    setShowSettingsModal(false);
    checkWhatsAppStatus();
    loadConversations();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.phone_number?.includes(searchTerm)
  );

  return (
    <div className="whatsapp-container">
      {/* Header */}
      <div className="whatsapp-header">
        <div className="header-left">
          <MessageSquare size={24} className="header-icon" />
          <h1>WhatsApp Messages</h1>
        </div>
        <div className="header-right">
          {/* Connection Status */}
          <div className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' ? (
              <>
                <Wifi size={16} />
                <span>Online</span>
              </>
            ) : connectionStatus === 'not-configured' ? (
              <>
                <Settings size={16} />
                <span>Setup Required</span>
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Settings Button */}
          <button 
            onClick={() => setShowSettingsModal(true)} 
            className="settings-btn" 
            title="Twilio Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="whatsapp-content">
        {/* Conversations Sidebar */}
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <input
              type="text"
              placeholder="🔍 Search conversations..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="conversations-list">
            {filteredConversations.length === 0 ? (
              <div className="no-conversations">
                <MessageSquare size={48} />
                <p>No conversations yet</p>
                <p className="subtitle">
                  {!hasCredentials 
                    ? 'Configure Twilio to start messaging' 
                    : 'Click + to start a new chat!'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="conversation-avatar">
                    {conv.photo_base64 ? (
                      <img src={conv.photo_base64} alt={conv.candidate_name || 'avatar'} loading="lazy" className="conversation-photo img-loaded" />
                    ) : conv.photo_path ? (
                      <LazyRemoteImage filePath={conv.photo_path} className="conversation-photo" />
                    ) : (
                      conv.candidate_name?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div className="conversation-details">
                    <div className="conversation-header">
                      <h4>{conv.candidate_name || 'Unknown'}</h4>
                      {conv.last_message_time && (
                        <span className="conversation-time">
                          {new Date(conv.last_message_time).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <p className="conversation-preview">{conv.phone_number || 'No phone number'}</p>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="unread-badge">{conv.unread_count}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <ChatWindow 
          conversation={selectedConversation} 
          isConnected={isConnected}
        />
      </div>

      {/* Floating Action Button - New Chat */}
      {isConnected && (
        <button
          className="fab-new-chat"
          onClick={() => setShowNewChatModal(true)}
          title="New Chat"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Modals */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onSelect={handleNewChat}
        />
      )}

      {showSettingsModal && (
        <TwilioSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSettingsSaved}
        />
      )}
    </div>
  );
};

export default WhatsAppMain;
