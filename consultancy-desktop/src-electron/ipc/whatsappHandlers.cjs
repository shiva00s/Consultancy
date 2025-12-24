// src-electron/ipc/whatsappHandlers.cjs

const { ipcMain } = require('electron');
const { getDatabase, dbAll, dbGet, dbRun } = require('../db/database.cjs');

let NGROK_URL = null;
let whatsappService;

// ✅ FIX 1: Match webhook server expiry (7 days) + proper encoding
async function generatePublicFileUrl(filePath) {
  const jwt = require('jsonwebtoken');
  const path = require('path');
  
  const db = getDatabase();
  const setting = await dbGet(
    db,
    `SELECT value FROM system_settings WHERE key = 'twilioNgrokUrl' LIMIT 1`
  );
  
  const BASE_URL = setting?.value || 'http://127.0.0.1:3001';
  const SECRET = '12023e5cf451cc4fc225b09f1543bd6c43c735c71db89f20c63cd6860430fc395b88778254ccbba2043df5989c0e61968cbf4ef6e4c6a6924f90fbe4c75cbb60';
  
  try {
    if (!filePath) throw new Error('File path is required');
    
    const normalizedPath = path.resolve(filePath);
    
    // ✅ CRITICAL FIX: Match webhook server - 7 days expiry
    const token = jwt.sign({ path: normalizedPath }, SECRET, { expiresIn: '7d' });
    
    const filename = path.basename(normalizedPath);
    
    // ✅ CRITICAL FIX: Encode filename for special characters
    const publicUrl = `${BASE_URL}/public/files/${token}/${encodeURIComponent(filename)}`;
    
    console.log('✅ Generated public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Error generating public URL:', error);
    throw error;
  }
}

async function loadNgrokUrl() {
  try {
    const db = getDatabase();
    const result = await dbGet(db, 
      `SELECT value FROM system_settings WHERE key = 'twilioNgrokUrl' LIMIT 1`
    );

    if (result && result.value) {
      NGROK_URL = result.value;
      console.log('✅ Loaded ngrok URL from database:', NGROK_URL);
    } else {
      console.log('⚠️ No ngrok URL configured');
    }
  } catch (error) {
    console.error('❌ Error loading ngrok URL:', error);
  }
}

function initializeWhatsAppHandlers(database, whatsappServiceInstance) {
  whatsappService = whatsappServiceInstance;
  loadNgrokUrl();

  // ========================================================================
  // NGROK URL HANDLERS
  // ========================================================================
  
  ipcMain.handle('whatsapp:saveNgrokUrl', async (event, ngrokUrl) => {
    try {
      const db = getDatabase();
      
      if (!ngrokUrl || typeof ngrokUrl !== 'string') {
        return { success: false, error: 'Valid ngrok URL required' };
      }

      await dbRun(db,
        `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
        [ngrokUrl]
      );

      NGROK_URL = ngrokUrl;
      console.log('✅ Ngrok URL saved to system_settings:', ngrokUrl);
      return { success: true, ngrokUrl };
    } catch (error) {
      console.error('❌ Error saving ngrok URL:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:getNgrokUrl', async () => {
    try {
      const db = getDatabase();
      const setting = await dbGet(db,
        `SELECT value FROM system_settings WHERE key = 'twilioNgrokUrl' LIMIT 1`
      );
      
      return { 
        success: true, 
        ngrokUrl: setting?.value || null 
      };
    } catch (error) {
      console.error('❌ Error getting ngrok URL:', error);
      return { success: false, error: error.message, ngrokUrl: null };
    }
  });

  // ✅ DEPRECATED: Remove duplicate setNgrokUrl handler
  ipcMain.handle('whatsapp:setNgrokUrl', async (event, ngrokUrl) => {
    try {
      const db = getDatabase();
      
      if (!ngrokUrl || typeof ngrokUrl !== 'string') {
        return { success: false, error: 'Valid ngrok URL required' };
      }
      
      const urlPattern = /^https:\/\/.+\.ngrok-free\.(dev|app)$/;
      if (!urlPattern.test(ngrokUrl)) {
        return { 
          success: false, 
          error: 'Invalid ngrok URL format' 
        };
      }
      
      await dbRun(db,
        `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
        [ngrokUrl]
      );
      
      NGROK_URL = ngrokUrl;
      console.log('✅ Ngrok URL saved:', ngrokUrl);
      return { success: true, url: ngrokUrl };
    } catch (error) {
      console.error('Error saving ngrok URL:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // MESSAGE HANDLERS
  // ========================================================================

  ipcMain.handle('whatsapp:editMessage', async (event, messageId, newContent) => {
    try {
      const db = getDatabase();
      await dbRun(db, `
        UPDATE whatsapp_messages
        SET body = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [newContent, messageId]);

      return { success: true };
    } catch (error) {
      console.error('Error editing message:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:archiveConversation', async (event, conversationId) => {
    try {
      const db = getDatabase();
      await dbRun(db, `
        UPDATE whatsapp_conversations
        SET is_archived = 1, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `, [conversationId]);

      return { success: true };
    } catch (error) {
      console.error('Error archiving conversation:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:getConversations', async () => {
    try {
      const db = getDatabase();
      const conversations = await dbAll(db, `
        SELECT
          wc.id, wc.candidate_id, wc.candidate_name,
          wc.phone_number, wc.last_message_time, wc.last_message,
          wc.unread_count, wc.created_at, wc.updated_at, wc.media_name
        FROM whatsapp_conversations wc
        WHERE wc.is_deleted = 0
        ORDER BY wc.last_message_time DESC
      `);

      const fs = require('fs');
      const path = require('path');

      const conversationsEnriched = Array.isArray(conversations) ? await Promise.all(
        conversations.map(async (conv) => {
          try {
            if (!conv || !conv.candidate_id) return conv;

            const candidate = await dbGet(db, 
              `SELECT id, photo_path FROM candidates WHERE id = ? LIMIT 1`, 
              [conv.candidate_id]
            );

            if (candidate && candidate.photo_path) {
              const photoPath = candidate.photo_path;
              try {
                if (fs.existsSync(photoPath)) {
                  const buffer = fs.readFileSync(photoPath);
                  const ext = (path.extname(photoPath) || '').toLowerCase();
                  let mime = 'image/png';
                  if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
                  else if (ext === '.gif') mime = 'image/gif';
                  else if (ext === '.webp') mime = 'image/webp';

                  const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
                  return { ...conv, photo_base64: dataUri, photo_path: photoPath };
                }
              } catch (fsErr) {
                console.error('Error reading candidate photo:', fsErr);
              }
            }

            return conv;
          } catch (err) {
            console.error('Error enriching conversation:', err);
            return conv;
          }
        })
      ) : [];

      return {
        success: true,
        data: Array.isArray(conversationsEnriched) ? conversationsEnriched : []
      };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ✅ FIX 2: Regenerate URLs and proper field mapping
  ipcMain.handle('whatsapp:getMessages', async (event, conversationId) => {
    try {
      const db = getDatabase();
      const messages = await dbAll(db, `
        SELECT
          id, conversation_id, direction, body,
          media_url, media_type, media_name, status,
          timestamp, from_number, to_number, message_sid
        FROM whatsapp_messages
        WHERE conversation_id = ? AND is_deleted = 0
        ORDER BY timestamp ASC
      `, [conversationId]);

      const fs = require('fs');
      
      // ✅ Generate fresh public URLs with proper encoding
      for (const msg of messages) {
  if (msg.media_url) {
    const isUrl = msg.media_url.startsWith('http://') || msg.media_url.startsWith('https://');
    
    // ✅ NEW: Check if URL has wrong base URL
    const hasWrongBase = msg.media_url.includes('192.168.') || 
                         msg.media_url.includes('127.0.0.1') ||
                         msg.media_url.includes('localhost');
    
    if (!isUrl || hasWrongBase) {
      // Wrong/local URL - regenerate
      console.log('🔄 Fixing wrong URL for message', msg.id);
      if (fs.existsSync(msg.media_url)) {
        const publicUrl = await generatePublicFileUrl(msg.media_url);
        msg.mediaurl = publicUrl;
      } else {
        msg.mediaurl = null;
      }
    } else {
      // Correct URL
      msg.mediaurl = msg.media_url;
    }
  }
        
        // Map all fields for compatibility
        msg.conversationid = msg.conversation_id;
        msg.messagesid = msg.message_sid;
        msg.mediatype = msg.media_type;
        msg.medianame = msg.media_name;
        msg.fromnumber = msg.from_number;
        msg.tonumber = msg.to_number;
      }

      // Fetch attachments
      if (Array.isArray(messages) && messages.length > 0) {
        const ids = messages.map(m => m.id);
        const placeholders = ids.map(() => '?').join(',');
        const attachments = await dbAll(db, `
          SELECT id, message_id, document_id, file_path, original_name, mime_type, created_at
          FROM whatsapp_message_attachments
          WHERE message_id IN (${placeholders})
        `, ids);

        const map = {};

        for (const a of attachments || []) {
          if (!map[a.message_id]) map[a.message_id] = [];

          let fileUrl = null;
          try {
            if (a.file_path && fs.existsSync(a.file_path)) {
              fileUrl = await generatePublicFileUrl(a.file_path);
            }
          } catch (e) {
            fileUrl = null;
          }

          map[a.message_id].push({
            id: a.id,
            documentId: a.document_id,
            path: a.file_path,
            url: fileUrl,
            originalName: a.original_name,
            mimeType: a.mime_type,
            createdAt: a.created_at
          });
        }

        for (const m of messages) {
          m.attachments = map[m.id] || [];
        }
      }

      console.log(`✅ Loaded ${messages.length} messages for conversation ${conversationId}`);
      
      const withMedia = messages.find(m => m.mediaurl);
      if (withMedia) {
        console.log('📷 Sample media URL:', withMedia.mediaurl?.substring(0, 100));
      }

      return {
        success: true,
        data: Array.isArray(messages) ? messages : []
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  ipcMain.handle('whatsapp:sendMessage', async (event, { conversationId, phoneNumber, message, attachments }) => {
    try {
      const db = getDatabase();

      if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
      }

      if (!message && (!attachments || attachments.length === 0)) {
        return { success: false, error: 'Message content or attachment is required' };
      }

      console.log('📤 Sending WhatsApp message to:', phoneNumber);

      let formattedPhone = phoneNumber.replace(/\D/g, '');
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const twilioNumber = formattedPhone.startsWith('whatsapp:')
        ? formattedPhone
        : 'whatsapp:' + formattedPhone;

      let localFilePaths = [];
      let mediaType = null;
      let mediaName = null;
      let localFilePath = null;
      let publicMediaUrl = null;

      if (Array.isArray(attachments) && attachments.length > 0) {
        const fs = require('fs');
        const path = require('path');

        for (const att of attachments) {
          let filePath = att.path || att.filePath || att.filepath || null;

          if (!filePath && att.id) {
            try {
              const docRow = await dbGet(db,
                `SELECT filePath, filepath FROM documents WHERE id = ? LIMIT 1`,
                [att.id]
              );
              if (docRow) {
                filePath = docRow.filePath || docRow.filepath;
              }
            } catch (e) {
              console.warn('Could not resolve document path:', e.message);
            }
          }

          if (!filePath || !fs.existsSync(filePath)) {
            console.warn('⚠️ File not found, skipping:', filePath);
            continue;
          }

          localFilePath = filePath;
          localFilePaths.push(filePath);
          mediaType = att.mimeType || att.fileType || 'application/octet-stream';
          mediaName = att.originalName || att.fileName || path.basename(filePath);

          // Generate public URL with proper encoding
          publicMediaUrl = await generatePublicFileUrl(filePath);
          console.log('📎 Generated public media URL:', publicMediaUrl);

          break; // Twilio supports 1 media per message
        }
      }

      const twilioResult = await whatsappService.sendMessage(
        twilioNumber,
        message || '📎 Media',
        localFilePaths,
        NGROK_URL
      );

      if (!twilioResult.success) {
        console.error('❌ Twilio send failed:', twilioResult.error);
        return {
          success: false,
          error: twilioResult.error || 'Failed to send message via Twilio'
        };
      }

      console.log('✅ Twilio message sent:', twilioResult.messageId);

      const timestamp = new Date().toISOString();
      const result = await dbRun(
        db,
        `INSERT INTO whatsapp_messages (
          conversation_id, message_sid, direction, body,
          media_url, media_type, media_name, status,
          timestamp, from_number, to_number, created_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversationId, twilioResult.messageId || null, 'outbound',
          message || '', publicMediaUrl, mediaType, mediaName,
          twilioResult.status || 'sent', timestamp,
          whatsappService.whatsappNumber || 'system',
          formattedPhone, timestamp, 0
        ]
      );

      await dbRun(
        db,
        `UPDATE whatsapp_conversations
         SET last_message_time = ?, last_message = ?,
             media_name = ?, updated_at = ?
         WHERE id = ?`,
        [timestamp, message || '[Media]', mediaName, timestamp, conversationId]
      );

      console.log('✅ Message saved to database with public URL');

      const messageData = {
        id: result.lastID,
        conversation_id: conversationId,
        conversationid: conversationId,
        message_sid: twilioResult.messageId,
        direction: 'outbound',
        body: message || '',
        media_url: publicMediaUrl,
        mediaurl: publicMediaUrl,
        media_type: mediaType,
        mediatype: mediaType,
        media_name: mediaName,
        medianame: mediaName,
        status: twilioResult.status || 'sent',
        timestamp: timestamp,
        from_number: whatsappService.whatsappNumber || 'system',
        fromnumber: whatsappService.whatsappNumber || 'system',
        to_number: formattedPhone,
        tonumber: formattedPhone
      };

      if (global.realtimeSync) {
        global.realtimeSync.broadcast('whatsapp:new-message', messageData);
      }

      if (localFilePath) {
        await dbRun(
          db,
          `INSERT INTO whatsapp_message_attachments (
            message_id, document_id, file_path, original_name, mime_type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [result.lastID, attachments[0]?.id || null, localFilePath, mediaName, mediaType, timestamp]
        );
      }

      return {
        success: true,
        data: {
          id: result.lastID,
          messageId: twilioResult.messageId,
          message_sid: twilioResult.messageId,
          status: twilioResult.status || 'sent',
          timestamp: timestamp,
          media_url: publicMediaUrl,
          media_name: mediaName
        }
      };
    } catch (error) {
      console.error('❌ Error sending message:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:createConversation', async (event, { candidateId, candidateName, phoneNumber }) => {
    try {
      const db = getDatabase();
      console.log('📞 Creating conversation:', { candidateId, candidateName, phoneNumber });

      if (!phoneNumber) {
        return { success: false, error: 'Phone number is required' };
      }

      let cleanPhone = phoneNumber.replace(/\D/g, '');

      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }

      const formattedPhone = '+' + cleanPhone;

      let conversation = await dbGet(db, `
        SELECT * FROM whatsapp_conversations
        WHERE phone_number = ? AND is_deleted = 0
      `, [formattedPhone]);

      if (!conversation) {
        const timestamp = new Date().toISOString();
        const result = await dbRun(db, `
          INSERT INTO whatsapp_conversations (
            candidate_id, candidate_name, phone_number,
            last_message_time, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          candidateId || null, candidateName || 'Unknown',
          formattedPhone, timestamp, timestamp, timestamp
        ]);

        conversation = await dbGet(db, `
          SELECT * FROM whatsapp_conversations WHERE id = ?
        `, [result.lastID]);
      }

      return {
        success: true,
        conversationId: conversation?.id,
        data: {
          id: conversation?.id,
          candidate_id: conversation?.candidate_id,
          candidate_name: conversation?.candidate_name,
          phone_number: conversation?.phone_number,
          last_message_time: conversation?.last_message_time,
          unread_count: conversation?.unread_count || 0
        }
      };
    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:getCandidatesWithPhone', async () => {
    try {
      const db = getDatabase();
      const candidates = await dbAll(db, `
        SELECT
          id, name, contact, Position as position,
          education, photo_path
        FROM candidates
        WHERE contact IS NOT NULL
          AND TRIM(contact) != ''
          AND isDeleted = 0
        ORDER BY name ASC
      `);

      const candidatesArray = Array.isArray(candidates) ? candidates : [];
      const fs = require('fs');
      const path = require('path');

      for (let i = 0; i < candidatesArray.length; i++) {
        const c = candidatesArray[i];
        if (c && c.photo_path) {
          try {
            if (fs.existsSync(c.photo_path)) {
              const buffer = fs.readFileSync(c.photo_path);
              const ext = (path.extname(c.photo_path) || '').toLowerCase();
              let mime = 'image/png';
              if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
              else if (ext === '.gif') mime = 'image/gif';
              else if (ext === '.webp') mime = 'image/webp';

              c.photo_base64 = `data:${mime};base64,${buffer.toString('base64')}`;
            }
          } catch (err) {
            console.error('Error reading candidate photo:', err);
          }
        }
      }

      return { success: true, data: candidatesArray };
    } catch (error) {
      console.error('❌ Error fetching candidates with phone:', error);
      return { success: false, error: error.message, data: [] };
    }
  });

  ipcMain.handle('whatsapp:deleteMessage', async (event, messageId) => {
    try {
      const db = getDatabase();
      await dbRun(db, `
        UPDATE whatsapp_messages SET is_deleted = 1 WHERE id = ?
      `, [messageId]);

      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:deleteConversation', async (event, conversationId) => {
    try {
      const db = getDatabase();
      await dbRun(db, `
        UPDATE whatsapp_conversations SET is_deleted = 1 WHERE id = ?
      `, [conversationId]);

      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:getStatus', async () => {
    try {
      const db = getDatabase();
      const settings = await dbAll(db, `
        SELECT key, value
        FROM system_settings
        WHERE key IN ('twilioaccountsid', 'twilioauthtoken', 'twiliowhatsappnumber')
      `);

      const config = {};
      const settingsArray = Array.isArray(settings) ? settings : [];
      settingsArray.forEach(s => {
        config[s.key] = s.value;
      });

      const isReady = whatsappService?.isReady || false;
      const hasCredentials = !!(config.twilioaccountsid && config.twilioauthtoken);

      return {
        success: true,
        hasCredentials,
        isReady,
        credentials: {
          accountSid: config.twilioaccountsid || '',
          authToken: config.twilioauthtoken || '',
          whatsappNumber: config.twiliowhatsappnumber || ''
        }
      };
    } catch (error) {
      console.error('❌ Error getting WhatsApp status:', error);
      return {
        success: false,
        error: error.message,
        hasCredentials: false,
        isReady: false,
        credentials: { accountSid: '', authToken: '', whatsappNumber: '' }
      };
    }
  });

  ipcMain.handle('whatsapp:saveCredentials', async (event, credentials) => {
    try {
      const result = await whatsappService.saveCredentials(
        credentials.accountSid,
        credentials.authToken,
        credentials.whatsappNumber
      );

      if (credentials.ngrokUrl) {
        const db = getDatabase();
        await dbRun(
          db,
          `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
          [credentials.ngrokUrl]
        );
        console.log('✅ Ngrok URL saved:', credentials.ngrokUrl);
      }

      return result;
    } catch (error) {
      console.error('Error saving credentials:', error);
      return { success: false, error: error.message };
    }
  });

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

  ipcMain.handle('whatsapp:logout', async () => {
    try {
      await whatsappService.disconnect();
      return { success: true };
    } catch (error) {
      console.error('Error logging out:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:getWebhookInfo', async () => {
    try {
      return {
        success: true,
        webhookUrl: whatsappService?.getWebhookUrl('http://localhost:3001'),
        localPort: 3001
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:saveWebhookUrl', async (event, webhookUrl) => {
    try {
      const db = getDatabase();
      if (!webhookUrl || typeof webhookUrl !== 'string') {
        return { success: false, error: 'Valid webhook URL required' };
      }

      await dbRun(db, `
        INSERT OR REPLACE INTO system_settings (key, value)
        VALUES ('twilio_webhook_url', ?)
      `, [webhookUrl]);

      return { success: true, webhookUrl };
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:verifyConfig', async () => {
    try {
      const db = getDatabase();
      const settings = await dbAll(db, `
        SELECT key, value
        FROM system_settings
        WHERE key IN ('twilioaccountsid', 'twilioauthtoken', 'twiliowhatsappnumber')
      `);

      const config = {};
      const settingsArray = Array.isArray(settings) ? settings : [];
      settingsArray.forEach(s => {
        config[s.key] = s.value;
      });

      const verification = {
        account_sid: !!config.twilioaccountsid,
        auth_token: !!config.twilioauthtoken,
        whatsapp_number: config.twiliowhatsappnumber || null,
        service_status: whatsappService?.isReady || false,
        from_number: whatsappService?.whatsappNumber || 'NOT SET'
      };

      console.log('📋 Twilio Configuration Status:', verification);
      return { success: true, ...verification };
    } catch (error) {
      console.error('Error verifying Twilio config:', error);
      return { success: false, error: error.message };
    }
  });

 // Mark conversation messages as read
ipcMain.handle('whatsapp:mark-as-read', async (event, conversationId) => {
  try {
    console.log('📖 Marking conversation as read:', conversationId);
    
    const db = getDatabase(); // ✅ FIX: Get database instance
    
    // ✅ FIX: Use dbRun instead of mainDb.run
    const result = await dbRun(
      db,
      `UPDATE whatsapp_messages 
       SET is_read = 1 
       WHERE conversation_id = ? AND is_read = 0`,
      [conversationId]
    );
    
    // ✅ Also reset unread count in conversation
    await dbRun(
      db,
      `UPDATE whatsapp_conversations 
       SET unread_count = 0, updated_at = datetime('now', 'localtime')
       WHERE id = ?`,
      [conversationId]
    );
    
    console.log(`✅ Marked messages as read for conversation ${conversationId}`);
    
    // ✅ Broadcast update via Socket.IO
    if (global.realtimeSync) {
      global.realtimeSync.broadcast('whatsapp:conversation-read', { 
        conversationId 
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error marking as read:', error);
    return { success: false, error: error.message };
  }
});



  ipcMain.handle('whatsapp:setWhatsAppNumber', async (event, whatsappNumber) => {
    try {
      const db = getDatabase();
      if (!whatsappNumber) {
        return { success: false, error: 'WhatsApp number is required' };
      }

      let formattedNumber = whatsappNumber.trim();
      if (!formattedNumber.startsWith('whatsapp:')) {
        formattedNumber = `whatsapp:${formattedNumber}`;
      }

      await dbRun(db, `
        INSERT OR REPLACE INTO system_settings (key, value, updated_at)
        VALUES ('twiliowhatsappnumber', ?, datetime('now'))
      `, [formattedNumber]);

      if (whatsappService) {
        whatsappService.whatsappNumber = formattedNumber;
      }

      return { success: true, number: formattedNumber };
    } catch (error) {
      console.error('Error saving WhatsApp number:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ WhatsApp IPC handlers initialized');
}

module.exports = { initializeWhatsAppHandlers };
