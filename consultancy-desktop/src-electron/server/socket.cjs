// consultancy-desktop/src-electron/server/socket.cjs

const { Server } = require('socket.io');
const { getDatabase } = require('../db/queries.cjs');

let io = null;

/**
 * Initialize Socket.io server for WhatsApp real-time communication
 * @param {http.Server} httpServer - HTTP server instance from api.cjs
 * @param {number} port - Port number (ignored, uses existing server port)
 */
function initializeSocketServer(httpServer, port = 3001) {
    // ✅ FIXED: Use the existing HTTP server instead of creating a new one
    io = new Server(httpServer, {
        cors: { 
            origin: '*',
            methods: ['GET', 'POST']
        },
        path: '/socket.io', // Explicitly set Socket.io path
        transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
        console.log('✅ WhatsApp client connected:', socket.id);
        
        // Join specific conversation room
        socket.on('join-conversation', (conversationId) => {
            socket.join(`conversation-${conversationId}`);
            console.log(`📱 Socket ${socket.id} joined conversation-${conversationId}`);
        });
        
        // Leave conversation room
        socket.on('leave-conversation', (conversationId) => {
            socket.leave(`conversation-${conversationId}`);
            console.log(`👋 Socket ${socket.id} left conversation-${conversationId}`);
        });
        
        // Mark messages as read
        socket.on('mark-read', async (data) => {
            const { conversationId, messageIds } = data;
            await markMessagesAsRead(messageIds);
            
            // Broadcast read status to other clients
            socket.to(`conversation-${conversationId}`).emit('messages-read', {
                messageIds,
                readAt: new Date().toISOString()
            });
        });
        
        // Typing indicator
        socket.on('typing', (data) => {
            const { conversationId, isTyping } = data;
            socket.to(`conversation-${conversationId}`).emit('user-typing', {
                isTyping,
                userId: socket.id
            });
        });
        
        socket.on('disconnect', () => {
            console.log('❌ WhatsApp client disconnected:', socket.id);
        });
        
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    // ✅ REMOVED: Don't create a new server or listen on a different port
    // The HTTP server is already listening from api.cjs
    
    console.log(`============================================`);
    console.log(`🔌 SOCKET.IO ATTACHED TO API SERVER`);
    console.log(`📡 Real-time WhatsApp enabled`);
    console.log(`🔗 Path: /socket.io`);
    console.log(`============================================`);

    return io;
}

/**
 * Broadcast new message to all clients in conversation
 * @param {number} conversationId - Conversation ID
 * @param {object} message - Message object
 */
function broadcastMessage(conversationId, message) {
    if (!io) {
        console.error('Socket.io not initialized');
        return;
    }
    
    io.to(`conversation-${conversationId}`).emit('new-message', {
        ...message,
        timestamp: new Date().toISOString()
    });
    
    console.log(`📨 Message broadcast to conversation-${conversationId}`);
}

/**
 * Broadcast message status update (sent, delivered, read)
 * @param {number} conversationId - Conversation ID
 * @param {string} messageId - WhatsApp message ID
 * @param {string} status - New status
 */
function broadcastStatusUpdate(conversationId, messageId, status) {
    if (!io) return;
    
    io.to(`conversation-${conversationId}`).emit('message-status', {
        messageId,
        status,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Broadcast new document received
 * @param {number} conversationId - Conversation ID
 * @param {object} document - Document details
 */
function broadcastDocument(conversationId, document) {
    if (!io) return;
    
    io.to(`conversation-${conversationId}`).emit('new-document', document);
    console.log(`📎 Document broadcast to conversation-${conversationId}`);
}

/**
 * Notify all clients about new conversation
 * @param {object} conversation - Conversation details
 */
function broadcastNewConversation(conversation) {
    if (!io) return;
    
    io.emit('new-conversation', conversation);
}

/**
 * Update unread count for conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} count - Unread count
 */
function updateUnreadCount(conversationId, count) {
    if (!io) return;
    
    io.emit('unread-update', {
        conversationId,
        count
    });
}

/**
 * Mark messages as read in database
 * @param {Array<number>} messageIds - Array of message IDs
 */
async function markMessagesAsRead(messageIds) {
    if (!messageIds || messageIds.length === 0) {
        return { success: true };
    }

    const db = getDatabase();
    const placeholders = messageIds.map(() => '?').join(',');
    const stmt = db.prepare(`
        UPDATE whatsapp_messages 
        SET status = 'read' 
        WHERE id IN (${placeholders})
    `);
    
    try {
        stmt.run(...messageIds);
        return { success: true };
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Socket.io instance
 * @returns {Server|null} Socket.io server instance
 */
function getSocketIO() {
    return io;
}

/**
 * Close Socket.io server
 */
function closeSocketServer() {
    if (io) {
        io.close(() => {
            console.log('🔌 Socket.io server closed');
        });
        io = null;
    }
}

module.exports = {
    initializeSocketServer,
    broadcastMessage,
    broadcastStatusUpdate,
    broadcastDocument,
    broadcastNewConversation,
    updateUnreadCount,
    getSocketIO,
    closeSocketServer
};
