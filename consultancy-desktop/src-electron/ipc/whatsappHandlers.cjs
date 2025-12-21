// src-electron/ipc/whatsappHandlers.cjs

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { getCandidatesForWhatsApp } = require('../db/whatsappQueries.cjs');

// You'll need your database instance
// Adjust based on your setup
let db;

function initializeWhatsAppHandlers(database) {
  db = database;

  // ✅ Get all conversations
  ipcMain.handle('whatsapp:getConversations', async () => {
    try {
      const conversations = await db.all(`
        SELECT 
          c.*,
          ca.name as candidate_name,
          ca.contact as phone_number,
          COUNT(CASE WHEN m.is_read = 0 AND m.sender_type = 'candidate' THEN 1 END) as unread_count,
          (
            SELECT timestamp 
            FROM whatsapp_messages 
            WHERE conversation_id = c.id 
            ORDER BY timestamp DESC 
            LIMIT 1
          ) as last_message_time
        FROM whatsapp_conversations c
        LEFT JOIN candidates ca ON c.candidate_id = ca.id
        LEFT JOIN whatsapp_messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY last_message_time DESC
      `);

      return { success: true, data: conversations };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Get messages for a conversation
  ipcMain.handle('whatsapp:getMessages', async (event, conversationId) => {
    try {
      const messages = await db.all(`
        SELECT * FROM whatsapp_messages 
        WHERE conversation_id = ? 
        ORDER BY timestamp ASC
      `, [conversationId]);

      return { success: true, data: messages };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Send a message
  ipcMain.handle('whatsapp:sendMessage', async (event, { conversationId, to, content, type }) => {
    try {
      const timestamp = Date.now();
      
      const result = await db.run(`
        INSERT INTO whatsapp_messages (
          conversation_id, 
          sender_type, 
          content, 
          message_type,
          status,
          timestamp
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [conversationId, 'user', content, type || 'text', 'sent', timestamp]);

      // TODO: Integrate with actual WhatsApp API here
      // For now, we're just storing in database

      return { 
        success: true, 
        data: { 
          id: result.lastID,
          message_id: `msg_${timestamp}`,
          status: 'sent'
        }
      };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Delete a message
  ipcMain.handle('whatsapp:deleteMessage', async (event, messageId) => {
    try {
      await db.run(`DELETE FROM whatsapp_messages WHERE id = ?`, [messageId]);
      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Edit a message
  ipcMain.handle('whatsapp:editMessage', async (event, messageId, newContent) => {
    try {
      await db.run(`
        UPDATE whatsapp_messages 
        SET content = ?, edited = 1 
        WHERE id = ?
      `, [newContent, messageId]);

      return { success: true };
    } catch (error) {
      console.error('Error editing message:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Upload media
  ipcMain.handle('whatsapp:uploadMedia', async (event, formData) => {
    try {
      // Handle file upload logic here
      // For now, return a mock response
      const mediaId = `media_${Date.now()}`;
      
      return { 
        success: true, 
        mediaId,
        mediaUrl: `/uploads/${mediaId}`
      };
    } catch (error) {
      console.error('Error uploading media:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Delete conversation
  ipcMain.handle('whatsapp:deleteConversation', async (event, conversationId) => {
    try {
      await db.run(`DELETE FROM whatsapp_messages WHERE conversation_id = ?`, [conversationId]);
      await db.run(`DELETE FROM whatsapp_conversations WHERE id = ?`, [conversationId]);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Archive conversation
  ipcMain.handle('whatsapp:archiveConversation', async (event, conversationId) => {
    try {
      await db.run(`
        UPDATE whatsapp_conversations 
        SET archived = 1 
        WHERE id = ?
      `, [conversationId]);
      
      return { success: true };
    } catch (error) {
      console.error('Error archiving conversation:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ FIXED: Create conversation with proper data return
  ipcMain.handle('whatsapp:createConversation', async (event, { candidateId, phoneNumber, candidateName }) => {
    try {
      console.log('📞 Creating conversation for candidate:', candidateId, candidateName);

      // Check if conversation already exists
      let conversation = await db.get(`
        SELECT * FROM whatsapp_conversations 
        WHERE candidate_id = ?
      `, [candidateId]);

      if (!conversation) {
        console.log('Creating new conversation...');
        
        // Create new conversation
        const result = await db.run(`
          INSERT INTO whatsapp_conversations (
            candidate_id, 
            phone_number, 
            last_message_time
          ) VALUES (?, ?, ?)
        `, [candidateId, phoneNumber, Date.now()]);

        // ✅ FIX: Fetch the created conversation to get all fields
        conversation = await db.get(`
          SELECT * FROM whatsapp_conversations 
          WHERE id = ?
        `, [result.lastID]);

        console.log('✅ New conversation created:', conversation);
      } else {
        console.log('✅ Existing conversation found:', conversation);
      }

      // ✅ FIX: Return complete data structure
      return { 
        success: true, 
        conversationId: conversation.id,
        data: {
          id: conversation.id,
          candidate_id: conversation.candidate_id,
          phone_number: conversation.phone_number,
          candidate_name: candidateName,
          last_message_time: conversation.last_message_time,
          archived: conversation.archived
        }
      };
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Initialize all conversations
  ipcMain.handle('whatsapp:initializeAllConversations', async () => {
    try {
      // Get all candidates with phone numbers
      const candidates = await db.all(`
        SELECT id, name, contact as phone_number 
        FROM candidates 
        WHERE contact IS NOT NULL 
        AND contact != ''
        AND isDeleted = 0
      `);

      let created = 0;

      for (const candidate of candidates) {
        // Check if conversation exists
        const existing = await db.get(`
          SELECT id FROM whatsapp_conversations 
          WHERE candidate_id = ?
        `, [candidate.id]);

        if (!existing) {
          // Create conversation
          await db.run(`
            INSERT INTO whatsapp_conversations (
              candidate_id, 
              phone_number, 
              last_message_time
            ) VALUES (?, ?, ?)
          `, [candidate.id, candidate.phone_number, Date.now()]);
          
          created++;
        }
      }

      console.log(`✅ Initialized ${created} conversations`);

      return { 
        success: true, 
        created,
        total: candidates.length 
      };
    } catch (error) {
      console.error('Error initializing conversations:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Get candidates for chat
  ipcMain.handle('whatsapp:getCandidatesForChat', async () => {
    try {
      return await getCandidatesForWhatsApp();
    } catch (error) {
      console.error('whatsapp:getCandidatesForChat error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ WhatsApp IPC handlers registered');
}

module.exports = { initializeWhatsAppHandlers };
