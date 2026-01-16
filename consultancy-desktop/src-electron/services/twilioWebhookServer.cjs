// FILE: src-electron/services/twilioWebhookServer.cjs

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const os = require('os');
const { dbGet, dbRun, dbAll } = require('../db/database.cjs');
const keyManager = require('./keyManager.cjs');

class TwilioWebhookServer {
  constructor(mainWindow, db, port = 3001) {
    this.mainWindow = mainWindow;
    this.db = db;
    this.port = port;
    this.app = null;
    this.server = null;
    this.authToken = null;
    this.accountSid = null;
    this.ngrokUrl = null; // ✅ Will be set from electron.cjs
  }

  // ✅ NEW: Method to set ngrok URL from electron.cjs
  setNgrokUrl(url) {
    this.ngrokUrl = url;
    console.log('🌐 Public URL updated in webhook server:', this.ngrokUrl);
  }

  async loadNgrokUrl() {
    try {
      const result = await dbGet(
        this.db,
        `SELECT value FROM system_settings WHERE key = 'twilioNgrokUrl' LIMIT 1`
      );
      if (result && result.value) {
        this.ngrokUrl = result.value;
        console.log('✅ Loaded ngrok URL from database:', this.ngrokUrl);
      } else {
        console.log('⚠️ No ngrok URL configured, will use localhost');
        this.ngrokUrl = 'http://127.0.0.1:3001';
      }
    } catch (error) {
      console.error('Error loading ngrok URL:', error);
      this.ngrokUrl = 'http://127.0.0.1:3001';
    }
  }

  async generatePublicFileUrl(filePath) {
    try {
      if (!filePath) return null;

      const BASE_URL = this.ngrokUrl || 'http://127.0.0.1:3001';
      console.log('🌐 Using base URL:', BASE_URL);
      
      const normalizedPath = path.resolve(filePath);

      // Ensure file exists before signing
      try {
        await fs.promises.access(normalizedPath);
      } catch (accessErr) {
        console.warn('File not accessible for public URL generation:', normalizedPath);
        return null;
      }

      const secret = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || process.env.JWT_SECRET || 'dev-temporary-secret';
      const token = jwt.sign({ path: normalizedPath }, secret, { expiresIn: '7d' });
      const filename = path.basename(normalizedPath);
      const publicUrl = `${BASE_URL}/public/files/${token}/${encodeURIComponent(filename)}`;

      console.log('🔗 Generated public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('❌ Error generating public URL:', error && error.message);
      return null;
    }
  }

  async initialize(authToken, accountSid) {
    try {
      this.authToken = authToken;
      this.accountSid = accountSid;
      
      // ✅ Load existing ngrok URL from database (if available)
      await this.loadNgrokUrl();
      
      this.app = express();
      
      // ✅ CORS MIDDLEWARE FIRST
      this.app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
        
        next();
      });
      
      // Middleware
      this.app.use(express.urlencoded({ extended: false }));
      this.app.use(express.json());

      // Health check
      this.app.get('/health', (req, res) => {
        res.json({ 
          status: 'ok', 
          message: 'Twilio webhook server running',
          ngrokUrl: this.ngrokUrl,
          timestamp: new Date().toISOString()
        });
      });

      // ✅ JWT-secured file serving with CORS
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

      // ✅ Create HTTP server (no ngrok initialization here)
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`✅ Twilio webhook server listening on port ${this.port}`);
        console.log(`📍 Health check: http://localhost:${this.port}/health`);
        console.log(`📍 File server: http://localhost:${this.port}/public/files/`);
        
        if (this.ngrokUrl) {
          console.log(`🌐 Public URL: ${this.ngrokUrl}`);
        } else {
          console.log(`⚠️ Public URL not yet configured (waiting for ngrok)`);
        }
        
        console.log(`✅ CORS enabled for all origins`);
      });

      return this.server; // ✅ Return server for Socket.IO attachment in electron.cjs
    } catch (error) {
      console.error('❌ Failed to initialize webhook server:', error);
      throw error;
    }
  }

  async serveFile(req, res) {
  try {
    const { token, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log('📂 File request from:', req.get('User-Agent'));
    console.log('📂 Requested file:', decodedFilename);
    
    // ✅ CRITICAL: Set headers BEFORE any response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('ngrok-skip-browser-warning', 'true');
    
    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // ✅ Verify JWT token
    let decoded;
    try {
      const secret = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || process.env.JWT_SECRET || 'dev-temporary-secret';
      decoded = jwt.verify(token, secret);
    } catch (error) {
      console.error('❌ Invalid token:', error && error.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const filePath = decoded.path;
    
    // ✅ Security check
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    const actualFilename = path.basename(filePath);
    if (actualFilename !== decodedFilename) {
      console.error('❌ Filename mismatch');
      return res.status(400).json({ error: 'Invalid filename' });
    }

    console.log('✅ Serving file:', filePath);
    
    // Determine content type
    const ext = path.extname(decodedFilename).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Get file stats
    const stat = fs.statSync(filePath);
    
    // ✅ Set all required headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${decodedFilename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle HEAD requests (Twilio checks before downloading)
    if (req.method === 'HEAD') {
      console.log('✅ HEAD request successful');
      return res.status(200).end();
    }

    // Stream file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('❌ Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error serving file' });
      }
    });

    fileStream.on('end', () => {
      console.log('✅ File served successfully:', decodedFilename);
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ Error in serveFile:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}


  async downloadMediaFromTwilio(mediaUrl, mediaType, messageSid) {
    try {
      if (!mediaUrl) return null;

      console.log('📥 Downloading media from Twilio:', mediaUrl);

      const documentsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'consultancy-app', 'documents');
      const whatsappMediaPath = path.join(documentsPath, 'whatsapp-media');
      
      if (!fs.existsSync(whatsappMediaPath)) {
        fs.mkdirSync(whatsappMediaPath, { recursive: true });
      }

      const ext = mediaType ? mediaType.split('/')[1] : 'bin';
      const filename = `${messageSid || Date.now()}-${Date.now()}.${ext}`;
      const localPath = path.join(whatsappMediaPath, filename);

      const response = await axios.get(mediaUrl, {
        auth: {
          username: this.accountSid || '',
          password: this.authToken || ''
        },
        responseType: 'arraybuffer',
        timeout: 30000
      });

      fs.writeFileSync(localPath, response.data);
      
      console.log('✅ Media downloaded successfully:', localPath);
      console.log('📦 File size:', response.data.length, 'bytes');

      return localPath;
    } catch (error) {
      console.error('❌ Failed to download media from Twilio:', error.message);
      return null;
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
    } else {
      console.log('✅ Twilio signature validated');
    }

    return isValid;
  }

  async handleIncomingMessage(req, res) {
    try {
      console.log('📥 Webhook received from Twilio');

      const direction = req.body.Direction || req.body.direction || '';
      const messageStatus = req.body.MessageStatus || req.body.messageStatus || '';

      if (direction && (direction === 'outbound-api' || direction === 'outbound-reply')) {
        console.log('⏩ Ignoring outbound message');
        return res.status(200).send('OK');
      }

      if (!direction && messageStatus) {
        console.log('⏩ Status callback, not a new message');
        return res.status(200).send('OK');
      }

      if (!this.verifyTwilioSignature(req)) {
        console.warn('⚠️ Invalid Twilio signature');
        return res.status(401).send('Unauthorized');
      }

      const { From, To, Body, MessageSid, MediaUrl0, MediaContentType0, NumMedia } = req.body;

      if (!From) {
        console.error('❌ Missing From field');
        return res.status(400).send('Missing required fields');
      }

      if (MessageSid) {
        const existingMessage = await dbGet(
          this.db,
          `SELECT id FROM whatsapp_messages WHERE message_sid = ? LIMIT 1`,
          [MessageSid]
        );

        if (existingMessage) {
          console.log('⏩ Message already exists, skipping');
          return res.status(200).send('OK');
        }
      }

      const messageBody = Body || (NumMedia > 0 ? '[Media]' : '');
      const phoneNumber = From.replace('whatsapp:', '').replace(/\+/g, '');
      const timestamp = new Date().toISOString();
      
      let localMediaPath = null;
      let publicMediaUrl = null;
      let mediaType = null;

      if (MediaUrl0) {
        console.log('📥 Media detected, downloading...');
        mediaType = MediaContentType0 || null;
        
        if (!this.accountSid || !this.authToken) {
          console.error('❌ Missing Twilio credentials');
        } else {
          localMediaPath = await this.downloadMediaFromTwilio(MediaUrl0, mediaType, MessageSid);
          
            if (localMediaPath) {
            console.log('✅ Media saved locally:', localMediaPath);

            if (!this.ngrokUrl) {
              await this.loadNgrokUrl();
            }

            publicMediaUrl = await this.generatePublicFileUrl(localMediaPath);
            console.log('✅ Public URL generated:', publicMediaUrl);
          }
        }
      }

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

      let conversation = await dbGet(
        this.db,
        `SELECT id FROM whatsapp_conversations
         WHERE candidate_id = ? AND is_deleted = 0
         LIMIT 1`,
        [candidate.id]
      );

      if (!conversation) {
        const result = await dbRun(
          this.db,
          `INSERT INTO whatsapp_conversations (
            candidate_id, candidate_name, phone_number,
            last_message_time, last_message, unread_count,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [candidate.id, candidate.name, '+' + phoneNumber, timestamp, messageBody, 1, timestamp, timestamp]
        );
        conversation = { id: result.lastID };
      } else {
        await dbRun(
          this.db,
          `UPDATE whatsapp_conversations
           SET last_message_time = ?, last_message = ?,
               unread_count = unread_count + 1, updated_at = ?
           WHERE id = ?`,
          [timestamp, messageBody, timestamp, conversation.id]
        );
      }

      const msgResult = await dbRun(
        this.db,
        `INSERT INTO whatsapp_messages (
          conversation_id, message_sid, direction, body,
          media_url, media_type, status, timestamp,
          from_number, to_number, created_at, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id, MessageSid || null, 'inbound', messageBody,
          publicMediaUrl, mediaType, 'received', timestamp,
          phoneNumber, To.replace('whatsapp:', ''), timestamp, 0
        ]
      );

      if (localMediaPath && publicMediaUrl) {
        await dbRun(
          this.db,
          `INSERT INTO whatsapp_message_attachments (
            message_id, file_path, original_name, mime_type, created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [msgResult.lastID, localMediaPath, path.basename(localMediaPath), mediaType, timestamp]
        );
      }

      const message = {
        id: msgResult.lastID,
        conversation_id: conversation.id,
        conversationid: conversation.id,
        message_sid: MessageSid || null,
        direction: 'inbound',
        body: messageBody,
        media_url: publicMediaUrl,
        mediaurl: publicMediaUrl,
        media_type: mediaType,
        mediatype: mediaType,
        status: 'received',
        timestamp: timestamp,
        from_number: phoneNumber,
        fromnumber: phoneNumber,
        to_number: To.replace('whatsapp:', ''),
        tonumber: To.replace('whatsapp:', '')
      };

      if (global.realtimeSync) {
        global.realtimeSync.broadcast('whatsapp:new-message', message);
      }

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('whatsapp:new-message', message);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
      res.status(500).send('Error processing message');
    }
  }

  async handleStatusCallback(req, res) {
    try {
      const { MessageSid, MessageStatus } = req.body;

      if (!MessageSid || !MessageStatus) {
        return res.status(400).send('Missing required fields');
      }

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

      await dbRun(
        this.db,
        `UPDATE whatsapp_messages SET status = ? WHERE message_sid = ?`,
        [dbStatus, MessageSid]
      );

      const statusUpdate = {
        messageSid: MessageSid,
        status: dbStatus,
        timestamp: new Date().toISOString()
      };

      if (global.realtimeSync) {
        global.realtimeSync.broadcast('whatsapp:message-status', statusUpdate);
      }

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('whatsapp:message-ack', statusUpdate);
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
    const baseUrl = publicUrl || this.ngrokUrl || `http://localhost:${this.port}`;
    return {
      incoming: `${baseUrl}/whatsapp/webhook`,
      status: `${baseUrl}/whatsapp/status`
    };
  }
}

module.exports = TwilioWebhookServer;
