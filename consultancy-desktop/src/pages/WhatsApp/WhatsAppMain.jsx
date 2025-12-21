// src/pages/WhatsApp/WhatsAppMain.jsx
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';

const WhatsAppMain = () => {
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);
    
    // Load conversations
    loadConversations();
    
    return () => newSocket.close();
  }, []);
  
  const loadConversations = async () => {
    const response = await window.api.whatsapp.getConversations();
    setConversations(response);
  };
  
  return (
    <div className="whatsapp-container">
      <ConversationList 
        conversations={conversations}
        activeId={activeConversation?.id}
        onSelect={setActiveConversation}
      />
      <ChatWindow 
        conversation={activeConversation}
        socket={socket}
      />
    </div>
  );
};

export default WhatsAppMain;
