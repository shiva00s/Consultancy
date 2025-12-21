// src-electron/services/twilioWebhookServer.cjs
// Handles incoming WhatsApp messages from Twilio webhook

const express = require('express');
const crypto = require('crypto');
const { dbGet, dbRun, dbAll } = require('../db/database.cjs');

class TwilioWebhookServer {
  constructor(mainWindow, db, port = 3001) {
    this.mainWindow = mainWindow;
    this.db = db;
    this.port = port;
    this.app = null;
    this.server = null;
    this.authToken = null; // Will be set from credentials
  }

  // Initialize webhook server with auth token for signature verification
  async initialize(authToken) {
    try {
      this.authToken = authToken;
      this.app = express();

      // Middleware
      this.app.use(express.urlencoded({ extended: false }));

      // Health check
      this.app.get('/health', (req, res) => {
        res.json({ status: 'ok', message: 'Twilio webhook server running' });
      });

      // Incoming message webhook
      this.app.post('/whatsapp/webhook', (req, res) => {
        this.handleIncomingMessage(req, res);
      });

      this.server = this.app.listen(this.port, () => {
        console.log(`✅ Twilio webhook server listening on port ${this.port}`);
      });
    } catch (error) {
      console.error('❌ Failed to initialize webhook server:', error);
      throw error;
    }
  }

  // Verify Twilio signature (security)
  verifyTwilioSignature(req) {
    if (!this.authToken) {
      console.warn('⚠️ Twilio auth token not configured, skipping signature verification');
      return true; // Development mode
    }

    const twilioSignature = req.get('X-Twilio-Signature') || '';
    const url = `http://${req.get('host')}${req.originalUrl}`;
    const params = req.body;

    // Build the signed data
    let data = url;
    Object.keys(params)
      .sort()
      .forEach((key) => {
        data += key + params[key];
      });

    // Compute HMAC
    const hash = crypto
      .createHmac('sha1', this.authToken)
      .update(data)
      .digest('Base64');

    return hash === twilioSignature;
  }

  // Handle incoming message
  async handleIncomingMessage(req, res) {
    try {
      // Verify signature
      if (!this.verifyTwilioSignature(req)) {
        console.warn('⚠️ Invalid Twilio signature');
        return res.status(401).send('Unauthorized');
      }

      const { From, To, Body, MediaUrl0, MediaContentType0 } = req.body;

      if (!From || !Body) {
        return res.status(400).send('Missing required fields');
      }

      console.log('📨 Incoming WhatsApp message from:', From);
      console.log('   Body:', Body);

      // Extract phone number (remove 'whatsapp:' prefix)
      const phoneNumber = From.replace('whatsapp:', '');
      const content = Body;
      const timestamp = new Date().toISOString();
      const mediaUrl = MediaUrl0 || null;
      const mediaType = MediaContentType0 || null;

      // Find candidate by phone
      const candidate = await dbGet(
        this.db,
        `SELECT id, name FROM candidates 
         WHERE contact LIKE ? OR contact LIKE ? 
         LIMIT 1`,
        [`%${phoneNumber}%`, `%${phoneNumber.slice(-10)}%`]
      );

      if (!candidate) {
        console.warn('⚠️ No candidate found for phone:', phoneNumber);
        // Optionally create new conversation for unknown sender
        // For now, just acknowledge to Twilio
        return res.send('OK');
      }

      // Find or create conversation
      let conversation = await dbGet(
        this.db,
        `SELECT id FROM whatsapp_conversations 
         WHERE candidate_id = ? AND phone_number = ?`,
        [candidate.id, phoneNumber]
      );

      if (!conversation) {
        const result = await dbRun(
          this.db,
          `INSERT INTO whatsapp_conversations (
            candidate_id, 
            candidate_name,
            phone_number, 
            last_message_time,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [candidate.id, candidate.name, phoneNumber, timestamp, timestamp, timestamp]
        );

        conversation = { id: result.lastID };
      } else {
        // Update last message time
        await dbRun(
          this.db,
          `UPDATE whatsapp_conversations 
           SET last_message_time = ?, updated_at = ? 
           WHERE id = ?`,
          [timestamp, timestamp, conversation.id]
        );
      }

      // Insert message
      const msgResult = await dbRun(
        this.db,
        `INSERT INTO whatsapp_messages (
          conversation_id,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation.id,
          'inbound',
          content,
          mediaUrl,
          mediaType,
          'received',
          timestamp,
          phoneNumber,
          To.replace('whatsapp:', ''),
          timestamp,
          0
        ]
      );

      // Send to UI
      const message = {
        id: msgResult.lastID,
        conversation_id: conversation.id,
        direction: 'inbound',
        body: content,
        media_url: mediaUrl,
        media_type: mediaType,
        status: 'received',
        timestamp: timestamp,
        from_number: phoneNumber,
        to_number: To.replace('whatsapp:', '')
      };

      this.mainWindow.webContents.send('whatsapp:new-message', message);

      console.log('✅ Message stored:', message.id);

      // Send empty response to Twilio (it expects a 200 OK)
      res.send('OK');
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
      res.status(500).send('Error processing message');
    }
  }

  // Stop webhook server
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

  // Get webhook URL (caller will provide the public URL)
  getWebhookUrl(publicUrl) {
    return `${publicUrl}/whatsapp/webhook`;
  }
}

module.exports = TwilioWebhookServer;
