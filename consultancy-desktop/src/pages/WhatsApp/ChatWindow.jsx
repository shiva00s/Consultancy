// src/pages/WhatsApp/ChatWindow.jsx
import { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatWindow = ({ conversation, socket }) => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    if (!conversation || !socket) return;
    
    loadMessages();
    socket.emit('join-conversation', conversation.id);
    
    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });
    
    return () => {
      socket.off('new-message');
    };
  }, [conversation, socket]);
  
  const loadMessages = async () => {
    const msgs = await window.api.whatsapp.getMessages(conversation.id);
    setMessages(msgs);
    scrollToBottom();
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSendMessage = async (content, type = 'text') => {
    await window.api.whatsapp.sendMessage({
      conversationId: conversation.id,
      to: conversation.phone_number,
      content,
      type
    });
  };
  
  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>{conversation?.candidate_name}</h3>
        <span>{conversation?.phone_number}</span>
      </div>
      
      <div className="messages-container">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <MessageInput onSend={handleSendMessage} />
    </div>
  );
};

export default ChatWindow;
