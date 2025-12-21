// src-electron/ipc/whatsappHandlers.cjs

const { ipcMain, app } = require('electron');
const { getDatabase, dbAll, dbGet, dbRun } = require('../db/database.cjs');

let whatsappService;

function initializeWhatsAppHandlers(database, whatsappServiceInstance) {
  whatsappService = whatsappServiceInstance;

  // Helper: generate a temporary public URL for a file stored in app documents
  async function generatePublicFileUrl(filePath) {
    try {
      if (!filePath) return null;
      const { getJwtSecret } = require('../db/queries.cjs');
      const jwt = require('jsonwebtoken');
      const ip = require('ip');
      const path = require('path');

      const secret = await getJwtSecret();
      // expire in 1 hour
      const token = jwt.sign({ path: filePath }, secret, { expiresIn: '1h' });
      const host = ip.address() || '127.0.0.1';
      const port = process.env.MOBILE_API_PORT || 3000;
      const fileName = path.basename(filePath);
      return `http://${host}:${port}/public/files/${token}/${encodeURIComponent(fileName)}`;
    } catch (err) {
      console.error('Error generating public file URL:', err);
      return null;
    }
  }


  ipcMain.handle('whatsapp:editMessage', async (event, messageId, newContent) => {
  try {
    const db = getDatabase();
    
    await dbRun(db, `
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
    
    await dbRun(db, `
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
      const conversations = await dbAll(db, `
        SELECT 
          wc.id,
          wc.candidate_id,
          wc.candidate_name,
          wc.phone_number,
          wc.last_message_time
        FROM whatsapp_conversations wc
        WHERE wc.is_deleted = 0
        ORDER BY wc.last_message_time DESC
      `);

      // Attach candidate photo (base64) when available to avoid extra renderer calls
      const fs = require('fs');
      const path = require('path');

      const conversationsEnriched = Array.isArray(conversations) ? await Promise.all(conversations.map(async (conv) => {
        try {
          if (!conv || !conv.candidate_id) return conv;

          const candidate = await dbGet(db, `SELECT id, photo_path FROM candidates WHERE id = ? LIMIT 1`, [conv.candidate_id]);
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
              console.error('Error reading candidate photo for conversation:', fsErr);
            }
          }
          return conv;
        } catch (err) {
          console.error('Error enriching conversation with photo:', err);
          return conv;
        }
      })) : [];

      return {
        success: true,
        data: Array.isArray(conversationsEnriched) ? conversationsEnriched : []
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
      
      const messages = await dbAll(db, `
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

      // Fetch attachments for messages
      if (Array.isArray(messages) && messages.length > 0) {
        const ids = messages.map(m => m.id);
        const placeholders = ids.map(() => '?').join(',');
        const attachments = await dbAll(db, `
          SELECT id, message_id, document_id, file_path, original_name, mime_type, created_at
          FROM whatsapp_message_attachments
          WHERE message_id IN (${placeholders})
        `, ids);

        const path = require('path');
        const map = {};
        for (const a of attachments || []) {
          if (!map[a.message_id]) map[a.message_id] = [];
          // Build a renderer-friendly URL for local files
          let fileUrl = null;
          try {
            if (a.file_path) {
              fileUrl = `file://${path.resolve(a.file_path)}`;
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
      return { 
        success: true, 
        data: Array.isArray(messages) ? messages : [] 
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
  ipcMain.handle('whatsapp:sendMessage', async (event, { conversationId, phoneNumber, message, attachments = [] }) => {
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

      // If attachments exist, generate temporary public URLs so Twilio can fetch media
      let mediaUrls = [];
      if (Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          let filePath = att.path || att.filePath || att.file_path || att.url || null;
          const documentId = att.id || att.documentId || null;
          if (!filePath && documentId) {
            try {
              const docRow = await dbGet(db, 'SELECT filePath, file_path FROM documents WHERE id = ? LIMIT 1', [documentId]);
              if (docRow) filePath = docRow.filePath || docRow.file_path || filePath;
            } catch (e) {
              console.warn('Could not resolve document path for public URL generation', documentId, e && e.message);
            }
          }

          try {
            const publicUrl = await generatePublicFileUrl(filePath);
            if (publicUrl) mediaUrls.push(publicUrl);
          } catch (err) {
            console.warn('Failed to generate public URL for attachment', filePath, err && err.message);
          }
        }
      }

      // Send via Twilio WhatsApp service (include media URLs if any)
      const twilioResult = await whatsappService.sendMessage(twilioNumber, message, mediaUrls.length ? mediaUrls : undefined);
      
      if (!twilioResult.success) {
        console.error('❌ Twilio send failed:', twilioResult.error);
        return { 
          success: false, 
          error: twilioResult.error || 'Failed to send message via Twilio' 
        };
      }

      console.log('✅ Twilio message sent:', twilioResult.messageId);

      // Store in database (support optional attachment metadata)
      const timestamp = new Date().toISOString();
      // If attachments provided, save first attachment metadata into message (supporting single-media messages)
      let media_url = null;
      let media_type = null;
      let media_name = null;
      if (Array.isArray(attachments) && attachments.length > 0) {
        const att = attachments[0];
        // normalize possible fields
        // prefer the public URL if we generated one
        media_url = (mediaUrls && mediaUrls.length > 0) ? mediaUrls[0] : (att.path || att.filePath || att.file_path || att.url || null);
        media_type = att.mimeType || att.fileType || att.mime || null;
        media_name = att.originalName || att.fileName || att.name || null;
      }

      const result = await dbRun(db, `
        INSERT INTO whatsapp_messages (
          conversation_id,
          message_sid,
          direction,
          body,
          media_url,
          media_type,
          media_name,
          status,
          timestamp,
          from_number,
          to_number,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        conversationId,
        twilioResult.messageId || null,
        'outbound',
        message,
        media_url,
        media_type,
        media_name,
        twilioResult.status || 'sent',
        timestamp,
        whatsappService.whatsappNumber || 'system',
        formattedPhone,
        timestamp
      ]);

      // Update conversation last message time
      await dbRun(db, `
        UPDATE whatsapp_conversations 
        SET last_message_time = ?,
            updated_at = ?
        WHERE id = ?
      `, [timestamp, timestamp, conversationId]);

      console.log('✅ Message saved to database');

      // Persist attachments to whatsapp_message_attachments table (if any)
      try {
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const att of attachments) {
            // If attachment references a document id, resolve file path
            let documentId = att.id || att.documentId || null;
            let filePath = att.path || att.filePath || att.file_path || att.url || null;
            let originalName = att.originalName || att.fileName || att.name || null;
            let mimeType = att.mimeType || att.fileType || att.mime || null;

            // If we only have document id, resolve from documents table
            if (!filePath && documentId) {
              try {
                const docRow = await dbGet(db, 'SELECT filePath, file_path FROM documents WHERE id = ? LIMIT 1', [documentId]);
                if (docRow) filePath = docRow.filePath || docRow.file_path || filePath;
              } catch (e) {
                console.warn('Could not resolve document path for attachment', documentId, e && e.message);
              }
            }

            await dbRun(db, `
              INSERT INTO whatsapp_message_attachments (message_id, document_id, file_path, original_name, mime_type, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [result.lastID, documentId, filePath, originalName, mimeType, timestamp]);
          }
        }
      } catch (attachErr) {
        console.error('Error saving message attachments:', attachErr);
      }
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
      let conversation = await dbGet(db, `
        SELECT * FROM whatsapp_conversations 
        WHERE phone_number = ? AND is_deleted = 0
      `, [formattedPhone]);

      if (!conversation) {
        console.log('Creating new conversation...');
        
        const timestamp = new Date().toISOString();
        const result = await dbRun(db, `
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

        console.log('📊 dbRun result:', { lastID: result.lastID, changes: result.changes });

        conversation = await dbGet(db, `
          SELECT * FROM whatsapp_conversations 
          WHERE id = ?
        `, [result.lastID]);

        console.log('✅ New conversation created:', conversation);
        
        if (!conversation) {
          console.error('❌ ERROR: conversation is still undefined after dbGet. lastID was:', result.lastID);
        }
      } else {
        console.log('✅ Existing conversation found:', conversation);
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
      
      // Use dbAll helper instead of db.all (callback-based)
      const candidates = await dbAll(db, `
        SELECT 
          id,
          name,
          contact,
          Position as position,
          education,
          photo_path
        FROM candidates
        WHERE contact IS NOT NULL 
          AND TRIM(contact) != ''
          AND isDeleted = 0
        ORDER BY name ASC
      `);

      console.log('📋 Query result type:', typeof candidates, 'Is array?', Array.isArray(candidates));
      console.log(`✅ Query returned ${Array.isArray(candidates) ? candidates.length : 0} candidates`);
      
      // Ensure we always return an array
      const candidatesArray = Array.isArray(candidates) ? candidates : [];

      // Enrich with base64 preview if photo_path exists
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
            console.error('Error reading candidate photo for list:', err);
          }
        }
      }
      
      if (candidatesArray.length > 0) {
        console.log('✅ Sample candidate:', {
          id: candidatesArray[0].id,
          name: candidatesArray[0].name,
          contact: candidatesArray[0].contact
        });
      } else {
        console.warn('⚠️ No candidates with phone numbers found in database');
      }
      
      return {
        success: true,
        data: candidatesArray
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
      
      await dbRun(db, `
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
      
      await dbRun(db, `
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

  // ========================================================================
  // GET WEBHOOK INFO (for production setup)
  // ========================================================================
  ipcMain.handle('whatsapp:getWebhookInfo', async () => {
    try {
      return {
        success: true,
        webhookUrl: whatsappService?.getWebhookUrl('http://localhost:3001'),
        localPort: 3001,
        instructions: {
          step1: 'Deploy app to production server with fixed public IP or domain',
          step2: 'Update webhook URL in Twilio console: https://console.twilio.com/',
          step3: 'Webhook URL: https://your-production-domain:3001/whatsapp/webhook',
          step4: 'Configure incoming message webhook in Twilio WhatsApp sandbox settings',
          step5: 'Request production approval from Twilio for unlimited messaging'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // SEED CANDIDATES (for testing - adds your 14 real candidates)
  // ========================================================================
  ipcMain.handle('whatsapp:seedCandidates', async () => {
    try {
      const db = getDatabase();

      const candidates = [
        { name: 'Shiva', contact: '9629881598', education: 'MCA', experience: 5, dob: '1992-12-25', passportNo: 'Z1234567', passportExpiry: '2030-12-20', aadhar: '281545439672' },
        { name: 'Rajesh Kumar', contact: '9876543210', education: 'ITI Welder', experience: 5, dob: '1990-05-15', passportNo: 'M1234567', passportExpiry: '2028-10-20', aadhar: '123456789012' },
        { name: 'Priya Sharma', contact: '8765432109', education: 'B.Sc Nursing', experience: 3, dob: '1994-11-02', passportNo: 'P987543', passportExpiry: '2027-01-15', aadhar: '234567890123' },
        { name: 'Ahmed Khan', contact: '7654321098', education: 'B.E Civil', experience: 5, dob: '1988-02-10', passportNo: 'K456789', passportExpiry: '2029-07-30', aadhar: '345678901234' },
        { name: 'Suresh Reddy', contact: '9988776655', education: 'ITI Electrician', experience: 6, dob: '1992-03-25', passportNo: 'S1122334', passportExpiry: '2026-12-01', aadhar: '456789012345' },
        { name: 'Anjali Nair', contact: '8877665544', education: 'M.Com', experience: 4, dob: '1995-01-30', passportNo: 'A556778', passportExpiry: '2028-04-12', aadhar: '567890123456' },
        { name: 'Mohammed Farooq', contact: '7766554433', education: '10th Pass', experience: 10, dob: '1985-06-20', passportNo: 'F8899001', passportExpiry: '2027-09-05', aadhar: '678901234567' },
        { name: 'Deepa Kumari', contact: '9876501234', education: 'B.A', experience: 2, dob: '1998-07-14', passportNo: 'D2233445', passportExpiry: '2029-02-18', aadhar: '789012345678' },
        { name: 'Sandeep Singh', contact: '7654309812', education: 'Diploma (Mech)', experience: 7, dob: '1991-12-11', passportNo: 'S9988776', passportExpiry: '2027-11-11', aadhar: '890123456789' },
        { name: 'Ganesh', contact: '7896541230', education: 'MI', experience: 5, dob: '1995-12-11', passportNo: 'S9632587', passportExpiry: '2035-12-25', aadhar: '963258741002' },
        { name: 'Surya', contact: '6596569856', education: 'hh', experience: 5, dob: '2001-12-03', passportNo: 'F963287', passportExpiry: '2026-01-01', aadhar: '236598653256' },
        { name: 'Kathir', contact: '8523697410', education: 'JJJ', experience: 5, dob: '2000-12-10', passportNo: 'R789541', passportExpiry: '2035-12-17', aadhar: '256986532145' },
        { name: 'Prabhu', contact: '6464646464', education: 'HH', experience: 5, dob: '1998-12-09', passportNo: 'G8523697', passportExpiry: '2032-12-17', aadhar: '373737373773' },
        { name: 'Jai', contact: '6632514896', education: 'G', experience: 5, dob: '2012-12-11', passportNo: 'D2136547', passportExpiry: '2027-12-26', aadhar: '962111222356' }
      ];

      let inserted = 0;
      await dbRun(db, 'BEGIN TRANSACTION;');

      for (const cand of candidates) {
        const exists = await dbGet(db, 'SELECT id FROM candidates WHERE contact = ? LIMIT 1', [cand.contact]);
        if (!exists) {
          await dbRun(db, `
            INSERT INTO candidates (name, contact, education, experience, dob, passportNo, passportExpiry, aadhar, status, isDeleted, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            cand.name,
            cand.contact,
            cand.education,
            cand.experience,
            cand.dob,
            cand.passportNo,
            cand.passportExpiry,
            cand.aadhar,
            'New',
            0,
            new Date().toISOString()
          ]);
          inserted++;
        }
      }

      await dbRun(db, 'COMMIT;');

      console.log(`✅ Seeded ${inserted} candidates`);
      return { success: true, inserted };
    } catch (error) {
      console.error('Error seeding candidates:', error);
      return { success: false, error: error.message };
    }
  });


  ipcMain.handle('whatsapp:saveWebhookUrl', async (event, webhookUrl) => {
    try {
      const db = getDatabase();
      
      if (!webhookUrl || typeof webhookUrl !== 'string') {
        return { success: false, error: 'Valid webhook URL required' };
      }

      // Save to database
      await dbRun(db, `
        INSERT OR REPLACE INTO system_settings (key, value)
        VALUES ('twilio_webhook_url', ?)
      `, [webhookUrl]);

      console.log('✅ Webhook URL saved:', webhookUrl);
      return { success: true, webhookUrl };
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // VERIFY TWILIO CONFIGURATION
  // ========================================================================
  ipcMain.handle('whatsapp:verifyConfig', async () => {
    try {
      const db = getDatabase();
      
      const settings = await dbAll(db, `
        SELECT key, value 
        FROM system_settings 
        WHERE key IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number')
      `);

      const config = {};
      const settingsArray = Array.isArray(settings) ? settings : [];
      
      settingsArray.forEach(s => {
        config[s.key] = s.value;
      });

      const verification = {
        account_sid: !!config.twilio_account_sid,
        auth_token: !!config.twilio_auth_token,
        whatsapp_number: config.twilio_whatsapp_number || null,
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

  // ========================================================================
  // SAVE TWILIO WHATSAPP NUMBER
  // ========================================================================
  ipcMain.handle('whatsapp:setWhatsAppNumber', async (event, whatsappNumber) => {
    try {
      const db = getDatabase();
      
      if (!whatsappNumber) {
        return { success: false, error: 'WhatsApp number is required' };
      }

      // Format the number correctly
      let formattedNumber = whatsappNumber.trim();
      if (!formattedNumber.startsWith('whatsapp:')) {
        formattedNumber = `whatsapp:${formattedNumber}`;
      }

      // Save to database
      await dbRun(db, `
        INSERT OR REPLACE INTO system_settings (key, value)
        VALUES ('twilio_whatsapp_number', ?)
      `, [formattedNumber]);

      console.log('✅ WhatsApp number saved:', formattedNumber);

      // Update the service
      if (whatsappService) {
        whatsappService.whatsappNumber = formattedNumber;
      }

      return { success: true, whatsappNumber: formattedNumber };
    } catch (error) {
      console.error('Error saving WhatsApp number:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ WhatsApp IPC handlers registered');
}

module.exports = { initializeWhatsAppHandlers };
