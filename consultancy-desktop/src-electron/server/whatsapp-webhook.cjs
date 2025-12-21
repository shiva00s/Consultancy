// consultancy-desktop/src-electron/server/whatsapp-webhook.cjs

const { broadcastMessage, broadcastStatusUpdate } = require('./socket.cjs');
const { getDatabase } = require('../db/queries.cjs');

function handleIncomingMessage(webhookData) {
    const db = getDatabase();
    const message = webhookData.messages[0];
    
    // Find conversation by phone number
    const conversation = db.prepare(`
        SELECT id, candidate_id 
        FROM whatsapp_conversations 
        WHERE phone_number = ?
    `).get(message.from);
    
    if (!conversation) {
        console.log('No conversation found for:', message.from);
        return;
    }
    
    // Save message to database
    const messageData = {
        conversation_id: conversation.id,
        message_id: message.id,
        sender_type: 'candidate',
        content: message.text?.body || '',
        message_type: message.type,
        status: 'delivered',
        timestamp: new Date(message.timestamp * 1000).toISOString()
    };
    
    const stmt = db.prepare(`
        INSERT INTO whatsapp_messages 
        (conversation_id, message_id, sender_type, content, message_type, status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
        messageData.conversation_id,
        messageData.message_id,
        messageData.sender_type,
        messageData.content,
        messageData.message_type,
        messageData.status,
        messageData.timestamp
    );
    
    // Broadcast to connected clients
    broadcastMessage(conversation.id, {
        id: result.lastInsertRowid,
        ...messageData
    });
}

function handleStatusUpdate(webhookData) {
    const status = webhookData.statuses[0];
    const db = getDatabase();
    
    // Update message status
    db.prepare(`
        UPDATE whatsapp_messages 
        SET status = ? 
        WHERE message_id = ?
    `).run(status.status, status.id);
    
    // Get conversation ID
    const message = db.prepare(`
        SELECT conversation_id FROM whatsapp_messages WHERE message_id = ?
    `).get(status.id);
    
    if (message) {
        broadcastStatusUpdate(message.conversation_id, status.id, status.status);
    }
}

module.exports = {
    handleIncomingMessage,
    handleStatusUpdate
};
