// src-electron/ipc/whatsappHandlers.cjs

const { ipcMain } = require('electron');
const { getDatabase } = require('../db/database.cjs');

let whatsappService;

function initializeWhatsAppHandlers(database, whatsappServiceInstance) {
  whatsappService = whatsappServiceInstance;


  ipcMain.handle('whatsapp:editMessage', async (event, messageId, newContent) => {
  try {
    const db = getDatabase();
    
    await db.run(`
      UPDATE whatsapp_messages 
      SET body = ?, 
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [newContent, messageId]);

    return { success: true };
  } catch (error) {
    console.error('Error editing message:', error);
    return { success: false, error: error.message };
  }
});

// Archive conversation
ipcMain.handle('whatsapp:archiveConversation', async (event, conversationId) => {
  try {
    const db = getDatabase();
    
    await db.run(`
      UPDATE whatsapp_conversations 
      SET is_archived = 1,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `, [conversationId]);
    
    return { success: true };
  } catch (error) {
    console.error('Error archiving conversation:', error);
    return { success: false, error: error.message };
  }
});

  // ========================================================================
  // GET CONVERSATIONS
  // ========================================================================
  ipcMain.handle('whatsapp:getConversations', async () => {
    try {
      const db = getDatabase();
      
      const conversations = await db.all(`
        SELECT 
    id,
    candidate_id,
    candidate_name,
    phone_number,
    last_message_time
  FROM whatsapp_conversations
        WHERE is_deleted = 0
        ORDER BY last_message_time DESC
      `);

      return {
        success: true,
        data: conversations || []
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  });

  // ========================================================================
  // GET MESSAGES
  // ========================================================================
  ipcMain.handle('whatsapp:getMessages', async (event, conversationId) => {
    try {
      const db = getDatabase();
      
      const messages = await db.all(`
        SELECT 
          id,
          conversation_id,
          direction,
          body,
          media_url,
          media_type,
          status,
          timestamp,
          from_number,
          to_number,
          message_sid
        FROM whatsapp_messages 
        WHERE conversation_id = ? 
          AND is_deleted = 0
        ORDER BY timestamp ASC
      `, [conversationId]);

      return { 
        success: true, 
        data: messages || [] 
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { 
        success: false, 
        error: error.message,
        data: []
      };
    }
  });

  // ========================================================================
  // SEND MESSAGE
  // ========================================================================
  ipcMain.handle('whatsapp:sendMessage', async (event, { conversationId, phoneNumber, message }) => {
    try {
      const db = getDatabase();
      
      // ✅ Validate inputs
      if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
      }
      if (!message) {
        return { success: false, error: 'Message content is required' };
      }

      console.log('📤 Sending WhatsApp message to:', phoneNumber);

      // Format phone number for Twilio (must include whatsapp: prefix)
      let formattedPhone = phoneNumber.replace(/\s+/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      // Twilio WhatsApp requires whatsapp: prefix
      const twilioNumber = formattedPhone.startsWith('whatsapp:') 
        ? formattedPhone 
        : `whatsapp:${formattedPhone}`;

      // Send via Twilio WhatsApp service
      const twilioResult = await whatsappService.sendMessage(twilioNumber, message);
      
      if (!twilioResult.success) {
        console.error('❌ Twilio send failed:', twilioResult.error);
        return { 
          success: false, 
          error: twilioResult.error || 'Failed to send message via Twilio' 
        };
      }

      console.log('✅ Twilio message sent:', twilioResult.messageId);

      // Store in database
      const timestamp = new Date().toISOString();
      const result = await db.run(`
        INSERT INTO whatsapp_messages (
          conversation_id,
          message_sid,
          direction,
          body,
          status,
          timestamp,
          from_number,
          to_number,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        conversationId,
        twilioResult.messageId || null,
        'outbound',
        message,
        twilioResult.status || 'sent',
        timestamp,
        whatsappService.whatsappNumber || 'system',
        formattedPhone,
        timestamp
      ]);

      // Update conversation last message time
      await db.run(`
        UPDATE whatsapp_conversations 
        SET last_message_time = ?,
            updated_at = ?
        WHERE id = ?
      `, [timestamp, timestamp, conversationId]);

      console.log('✅ Message saved to database');

      return { 
        success: true, 
        data: { 
          id: result.lastID,
          messageId: twilioResult.messageId,
          status: twilioResult.status || 'sent',
          timestamp: timestamp
        }
      };
    } catch (error) {
      console.error('❌ Error sending message:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // ========================================================================
  // CREATE CONVERSATION
  // ========================================================================
  ipcMain.handle('whatsapp:createConversation', async (event, { candidateId, candidateName, phoneNumber }) => {
    try {
      const db = getDatabase();
      
      console.log('📞 Creating conversation:', { candidateId, candidateName, phoneNumber });

      // ✅ Validate phone number
      if (!phoneNumber) {
        return { 
          success: false, 
          error: 'Phone number is required' 
        };
      }

      // Format phone number
      let formattedPhone = phoneNumber.replace(/\s+/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // Check if conversation already exists
      let conversation = await db.get(`
        SELECT * FROM whatsapp_conversations 
        WHERE phone_number = ? AND is_deleted = 0
      `, [formattedPhone]);

      if (!conversation) {
        console.log('Creating new conversation...');
        
        const timestamp = new Date().toISOString();
        const result = await db.run(`
          INSERT INTO whatsapp_conversations (
            candidate_id,
            candidate_name,
            phone_number,
            last_message_time,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          candidateId || null,
          candidateName || 'Unknown',
          formattedPhone,
          timestamp,
          timestamp,
          timestamp
        ]);

        conversation = await db.get(`
          SELECT * FROM whatsapp_conversations 
          WHERE id = ?
        `, [result.lastID]);

        console.log('✅ New conversation created:', conversation);
      } else {
        console.log('✅ Existing conversation found:', conversation);
      }

      return { 
        success: true,
        conversationId: conversation.id,
        data: {
          id: conversation.id,
          candidate_id: conversation.candidate_id,
          candidate_name: conversation.candidate_name,
          phone_number: conversation.phone_number,
          last_message_time: conversation.last_message_time,
          unread_count: conversation.unread_count || 0
        }
      };
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // ========================================================================
  // GET CANDIDATES WITH PHONE
  // ========================================================================
  ipcMain.handle('whatsapp:getCandidatesWithPhone', async () => {
    try {
      const db = getDatabase();
      
      console.log('📞 Fetching candidates with phone numbers...');
      
      const candidates = await db.all(`
        SELECT 
          id,
          name,
          contact,
          Position as position,
          education
        FROM candidates
        WHERE contact IS NOT NULL 
          AND TRIM(contact) != ''
          AND isDeleted = 0
        ORDER BY name ASC
      `);

      // ✅ Log results for debugging
      console.log(`✅ Query returned ${candidates?.length || 0} candidates`);
      
      if (!candidates) {
        console.warn('⚠️ Query returned null/undefined');
        return {
          success: true,
          data: []
        };
      }

      if (candidates.length > 0) {
        console.log('✅ Sample candidate:', {
          id: candidates[0].id,
          name: candidates[0].name,
          contact: candidates[0].contact
        });
      }
      
      return {
        success: true,
        data: candidates
      };
      
    } catch (error) {
      console.error('❌ Error fetching candidates with phone:', error.message);
      console.error('Stack:', error.stack);
      
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  });

  // ========================================================================
  // DELETE MESSAGE
  // ========================================================================
  ipcMain.handle('whatsapp:deleteMessage', async (event, messageId) => {
    try {
      const db = getDatabase();
      
      await db.run(`
        UPDATE whatsapp_messages 
        SET is_deleted = 1 
        WHERE id = ?
      `, [messageId]);

      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // DELETE CONVERSATION
  // ========================================================================
  ipcMain.handle('whatsapp:deleteConversation', async (event, conversationId) => {
    try {
      const db = getDatabase();
      
      await db.run(`
        UPDATE whatsapp_conversations 
        SET is_deleted = 1 
        WHERE id = ?
      `, [conversationId]);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // GET WHATSAPP STATUS
  // ========================================================================
  ipcMain.handle('whatsapp:getStatus', async () => {
    try {
      return await whatsappService.getStatus();
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      return { 
        success: false, 
        error: error.message,
        hasCredentials: false,
        isReady: false
      };
    }
  });

  // ========================================================================
  // SAVE CREDENTIALS
  // ========================================================================
  ipcMain.handle('whatsapp:saveCredentials', async (event, credentials) => {
    try {
      return await whatsappService.saveCredentials(
        credentials.accountSid,
        credentials.authToken,
        credentials.whatsappNumber
      );
    } catch (error) {
      console.error('Error saving credentials:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // TEST CONNECTION
  // ========================================================================
  ipcMain.handle('whatsapp:testConnection', async (event, credentials) => {
    try {
      return await whatsappService.testConnection(
        credentials.accountSid,
        credentials.authToken,
        credentials.whatsappNumber
      );
    } catch (error) {
      console.error('Error testing connection:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // LOGOUT/DISCONNECT
  // ========================================================================
  ipcMain.handle('whatsapp:logout', async () => {
    try {
      await whatsappService.disconnect();
      return { success: true };
    } catch (error) {
      console.error('Error logging out:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ WhatsApp IPC handlers registered');
}

module.exports = { initializeWhatsAppHandlers };
