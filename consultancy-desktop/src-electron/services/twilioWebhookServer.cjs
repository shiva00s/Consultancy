// src-electron/services/twilioWebhookServer.cjs

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // ✅ ADD THIS
const os = require('os'); // ✅ ADD THIS
const { dbGet, dbRun, dbAll } = require('../db/database.cjs');

// ✅ JWT Secret for file URL signing (MUST MATCH whatsappHandlers.cjs)
const SECRET = '12023e5cf451cc4fc225b09f1543bd6c43c735c71db89f20c63cd6860430fc395b88778254ccbba2043df5989c0e61968cbf4ef6e4c6a6924f90fbe4c75cbb60';

class TwilioWebhookServer {
  constructor(mainWindow, db, port = 3001) {
    this.mainWindow = mainWindow;
    this.db = db;
    this.port = port;
    this.app = null;
    this.server = null;
    this.authToken = null;
    this.accountSid = null; // ✅ ADD THIS
  }

  async initialize(authToken, accountSid) { // ✅ ADD accountSid parameter
    try {
      this.authToken = authToken;
      this.accountSid = accountSid; // ✅ ADD THIS
      this.app = express();
      
      // Middleware
      this.app.use(express.urlencoded({ extended: false }));
      this.app.use(express.json());

      // Health check
      this.app.get('/health', (req, res) => {
        res.json({ status: 'ok', message: 'Twilio webhook server running' });
      });

      // JWT-secured file serving route
      this.app.get('/public/files/:token/:filename', (req, res) => {
        this.serveFile(req, res);
      });

      // Incoming message webhook
      this.app.post('/whatsapp/webhook', (req, res) => {
        this.handleIncomingMessage(req, res);
      });

      // Status callback webhook
      this.app.post('/whatsapp/status', (req, res) => {
        this.handleStatusCallback(req, res);
      });

      this.server = this.app.listen(this.port, () => {
        console.log(`✅ Twilio webhook server listening on port ${this.port}`);
        console.log(`📍 Incoming messages: http://localhost:${this.port}/whatsapp/webhook`);
        console.log(`📍 Status callbacks: http://localhost:${this.port}/whatsapp/status`);
        console.log(`📍 File server: http://localhost:${this.port}/public/files/`);
      });
    } catch (error) {
      console.error('❌ Failed to initialize webhook server:', error);
      throw error;
    }
  }

  async serveFile(req, res) {
    try {
      const { token, filename } = req.params;
      
      // ✅ Decode filename (in case of special characters)
      const decodedFilename = decodeURIComponent(filename);
      
      let decoded;
      try {
        decoded = jwt.verify(token, SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          console.error('❌ JWT token expired for file:', decodedFilename);
          return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
          console.error('❌ Invalid JWT token for file:', decodedFilename);
          return res.status(401).json({ error: 'Invalid token' });
        }
        throw error;
      }

      const filePath = decoded.path;
      
      if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
      }

      const actualFilename = path.basename(filePath);
      if (actualFilename !== decodedFilename) {
        console.error('❌ Filename mismatch:', { expected: decodedFilename, actual: actualFilename });
        return res.status(400).json({ error: 'Invalid filename' });
      }

      console.log('✅ Serving file:', filePath);
      
      const ext = path.extname(decodedFilename).toLowerCase();
      const contentTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg'
      };
      const contentType = contentTypes[ext] || 'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
      
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Length', stat.size);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('❌ Error streaming file:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error serving file' });
        }
      });
    } catch (error) {
      console.error('❌ Error serving file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  // ✅ NEW METHOD: Download media from Twilio and save locally
  async downloadMediaFromTwilio(mediaUrl, mediaType, messageSid) {
    try {
      if (!mediaUrl) return null;

      console.log('📥 Downloading media from Twilio:', mediaUrl);

      // Create downloads directory
      const documentsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'consultancy-app', 'documents');
      const whatsappMediaPath = path.join(documentsPath, 'whatsapp-media');
      
      if (!fs.existsSync(whatsappMediaPath)) {
        fs.mkdirSync(whatsappMediaPath, { recursive: true });
      }

      // Determine file extension from media type
      const ext = mediaType ? mediaType.split('/')[1] : 'bin';
      const filename = `${messageSid || Date.now()}-${Date.now()}.${ext}`;
      const localPath = path.join(whatsappMediaPath, filename);

      // Download file with Twilio authentication
      const response = await axios.get(mediaUrl, {
        auth: {
          username: this.accountSid || '',
          password: this.authToken || ''
        },
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });

      // Save to local file
      fs.writeFileSync(localPath, response.data);
      
      console.log('✅ Media downloaded successfully:', localPath);
      console.log('📦 File size:', response.data.length, 'bytes');

      return localPath;
    } catch (error) {
      console.error('❌ Failed to download media from Twilio:', error.message);
      return null; // Return null instead of throwing - allow message to save without media
    }
  }

  verifyTwilioSignature(req) {
    if (!this.authToken) {
      console.warn('⚠️ Twilio auth token not configured, skipping signature verification');
      return true;
    }

    const twilioSignature = req.get('X-Twilio-Signature') || '';
    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
    const url = `${protocol}://${req.get('host')}${req.originalUrl}`;
    
    console.log('🔐 Verifying signature for URL:', url);
    
    const params = req.body;
    let data = url;
    Object.keys(params)
      .sort()
      .forEach((key) => {
        data += key + params[key];
      });

    const hash = crypto
      .createHmac('sha1', this.authToken)
      .update(data)
      .digest('base64');

    const isValid = hash === twilioSignature;
    
    if (!isValid) {
      console.warn('⚠️ Signature mismatch!');
      console.warn('  Expected:', hash);
      console.warn('  Received:', twilioSignature);
    } else {
      console.log('✅ Twilio signature validated');
    }

    return isValid;
  }

  // ✅ FIXED: Handle incoming message with media download
  async handleIncomingMessage(req, res) {
    try {
      console.log('📥 Webhook received from Twilio');
      console.log('📦 Full body:', JSON.stringify(req.body, null, 2));

      // ✅ Check direction to prevent duplicates
      const direction = req.body.Direction || req.body.direction || '';
      const messageStatus = req.body.MessageStatus || req.body.messageStatus || '';
      const apiVersion = req.body.ApiVersion || req.body.apiVersion || '';

      console.log('🔍 Direction:', direction);
      console.log('🔍 MessageStatus:', messageStatus);
      console.log('🔍 ApiVersion:', apiVersion);

      // ✅ Only ignore if explicitly outbound
      if (direction && (direction === 'outbound-api' || direction === 'outbound-reply')) {
        console.log('⏩ Ignoring outbound message - Direction:', direction);
        return res.status(200).send('OK');
      }

      // ✅ If direction is missing, check if it's a status callback
      if (!direction && messageStatus) {
        console.log('⏩ This looks like a status callback, not a new message');
        return res.status(200).send('OK');
      }

      // ✅ Verify signature
      if (!this.verifyTwilioSignature(req)) {
        console.warn('⚠️ Invalid Twilio signature');
        return res.status(401).send('Unauthorized');
      }

      const { From, To, Body, MessageSid, MediaUrl0, MediaContentType0, NumMedia } = req.body;

      if (!From) {
        console.error('❌ Missing From field');
        return res.status(400).send('Missing required fields');
      }

      // ✅ Handle empty body (media-only messages)
      const messageBody = Body || (NumMedia > 0 ? '[Media]' : '');

      console.log('📨 Processing WhatsApp message from:', From);
      console.log('  Body:', messageBody);
      console.log('  MessageSid:', MessageSid);
      console.log('  Media Count:', NumMedia || 0);

      // ✅ Check if message already exists (prevent duplicates)
      if (MessageSid) {
        const existingMessage = await dbGet(
          this.db,
          `SELECT id FROM whatsapp_messages WHERE message_sid = ? LIMIT 1`,
          [MessageSid]
        );

        if (existingMessage) {
          console.log('⏩ Message already exists, skipping - MessageSid:', MessageSid);
          return res.status(200).send('OK');
        }
      }

      // Extract phone number
      const phoneNumber = From.replace('whatsapp:', '').replace(/\+/g, '');
      const timestamp = new Date().toISOString();
      
      // ✅ **CRITICAL FIX**: Download media locally instead of storing Twilio URL
      let localMediaPath = null;
      let mediaType = null;

      if (MediaUrl0) {
        console.log('📥 Media detected, downloading from Twilio...');
        mediaType = MediaContentType0 || null;
        localMediaPath = await this.downloadMediaFromTwilio(MediaUrl0, mediaType, MessageSid);
        
        if (localMediaPath) {
          console.log('✅ Media saved locally:', localMediaPath);
        } else {
          console.warn('⚠️ Failed to download media, message will be saved without media');
        }
      }

      // Find candidate by phone
      const candidate = await dbGet(
        this.db,
        `SELECT id, name FROM candidates
         WHERE contact LIKE ? OR contact LIKE ?
         AND isDeleted = 0
         LIMIT 1`,
        [`%${phoneNumber}%`, `%${phoneNumber.slice(-10)}%`]
      );

      if (!candidate) {
        console.warn('⚠️ No candidate found for phone:', phoneNumber);
        return res.status(200).send('OK');
      }

      console.log('✅ Found candidate:', candidate.name, '(ID:', candidate.id + ')');

      // Find or create conversation
      let conversation = await dbGet(
        this.db,
        `SELECT id FROM whatsapp_conversations
         WHERE candidate_id = ? AND is_deleted = 0
         LIMIT 1`,
        [candidate.id]
      );

      if (!conversation) {
        console.log('📝 Creating new conversation for candidate:', candidate.id);
        const result = await dbRun(
          this.db,
          `INSERT INTO whatsapp_conversations (
            candidate_id,
            candidate_name,
            phone_number,
            last_message_time,
            last_message,
            unread_count,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [candidate.id, candidate.name, '+' + phoneNumber, timestamp, messageBody, 1, timestamp, timestamp]
        );
        conversation = { id: result.lastID };
        console.log('✅ New conversation created with ID:', conversation.id);
      } else {
        console.log('✅ Using existing conversation ID:', conversation.id);
        // Update last message time and increment unread count
        await dbRun(
          this.db,
          `UPDATE whatsapp_conversations
           SET last_message_time = ?,
               last_message = ?,
               unread_count = unread_count + 1,
               updated_at = ?
           WHERE id = ?`,
          [timestamp, messageBody, timestamp, conversation.id]
        );
      }

      // ✅ Insert message with LOCAL media path
      console.log('💾 Saving message to database...');
      const msgResult = await dbRun(
        this.db,
        `INSERT INTO whatsapp_messages (
          conversation_id,
          message_sid,
          direction,
          body,
          media_url,
          media_type,
          status,
          timestamp,
          from_number,
          to_number,
          created_at,
          is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          MessageSid || null,
          'inbound',
          messageBody,
          localMediaPath,  // ✅ Store LOCAL path, not Twilio URL
          mediaType,
          'received',
          timestamp,
          phoneNumber,
          To.replace('whatsapp:', ''),
          timestamp,
          0
        ]
      );

      console.log('✅ Message saved with ID:', msgResult.lastID);

      const message = {
        id: msgResult.lastID,
        conversation_id: conversation.id,
        conversationid: conversation.id,
        message_sid: MessageSid || null,
        direction: 'inbound',
        body: messageBody,
        media_url: localMediaPath,  // ✅ LOCAL path
        mediaurl: localMediaPath,   // ✅ LOCAL path (for backward compatibility)
        media_type: mediaType,
        status: 'received',
        timestamp: timestamp,
        from_number: phoneNumber,
        to_number: To.replace('whatsapp:', '')
      };

      console.log('📡 Broadcasting message:', JSON.stringify(message, null, 2));

      // ✅ Broadcast via Socket.IO
      if (global.realtimeSync) {
        global.realtimeSync.broadcast('whatsapp:new-message', message);
        console.log('✅ Message broadcasted via Socket.IO');
      } else {
        console.warn('⚠️ global.realtimeSync NOT AVAILABLE');
      }

      // ✅ Send via IPC (backward compatibility)
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('whatsapp:new-message', message);
        console.log('✅ Message sent via IPC to main window');
      } else {
        console.error('❌ mainWindow.webContents not available!');
      }

      console.log('✅ Message processing complete:', message.id);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).send('Error processing message');
    }
  }

  async handleStatusCallback(req, res) {
    try {
      console.log('📊 Status callback received');
      console.log('  Data:', JSON.stringify(req.body, null, 2));

      const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;

      if (!MessageSid || !MessageStatus) {
        console.error('❌ Missing MessageSid or MessageStatus');
        return res.status(400).send('Missing required fields');
      }

      console.log(`📍 Message ${MessageSid} status: ${MessageStatus}`);

      const statusMap = {
        'queued': 'sending',
        'sending': 'sending',
        'sent': 'sent',
        'delivered': 'delivered',
        'read': 'read',
        'failed': 'failed',
        'undelivered': 'failed'
      };

      const dbStatus = statusMap[MessageStatus] || MessageStatus;

      const result = await dbRun(
        this.db,
        `UPDATE whatsapp_messages
         SET status = ?
         WHERE message_sid = ?`,
        [dbStatus, MessageSid]
      );

      console.log(`✅ Updated ${result.changes} message(s) in database`);

      const statusUpdate = {
        messageSid: MessageSid,
        status: dbStatus,
        originalStatus: MessageStatus,
        timestamp: new Date().toISOString(),
        to: To,
        error: ErrorCode ? { code: ErrorCode, message: ErrorMessage } : null
      };

      if (global.realtimeSync) {
        global.realtimeSync.broadcast('whatsapp:message-status', statusUpdate);
        console.log('✅ Status update broadcasted via Socket.IO');
      }

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('whatsapp:message-ack', statusUpdate);
        console.log('✅ Status update sent via IPC');
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error handling status callback:', error);
      res.status(500).send('Error processing status');
    }
  }

  async destroy() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Webhook server shut down');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getWebhookUrl(publicUrl) {
    return {
      incoming: `${publicUrl}/whatsapp/webhook`,
      status: `${publicUrl}/whatsapp/status`
    };
  }
}

module.exports = TwilioWebhookServer;
