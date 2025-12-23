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

  /// Initialize webhook server with auth token for signature verification
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

    // ✅ NEW: Status callback webhook (for delivery receipts)
    this.app.post('/whatsapp/status', (req, res) => {
      this.handleStatusCallback(req, res);
    });

    this.server = this.app.listen(this.port, () => {
      console.log(`✅ Twilio webhook server listening on port ${this.port}`);
      console.log(`📍 Incoming messages: http://localhost:${this.port}/whatsapp/webhook`);
      console.log(`📍 Status callbacks: http://localhost:${this.port}/whatsapp/status`);
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
  
  // ✅ FIXED: Use X-Forwarded-Proto for ngrok, fallback to req.protocol
  const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
  const url = `${protocol}://${req.get('host')}${req.originalUrl}`;
  
  console.log('🔐 Verifying signature for URL:', url);
  
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
    .digest('base64');  // ✅ FIXED: lowercase 'base64' (more standard)

  const isValid = hash === twilioSignature;
  
  if (!isValid) {
    console.warn('⚠️ Signature mismatch!');
    console.warn('   Expected:', hash);
    console.warn('   Received:', twilioSignature);
    console.warn('   URL used:', url);
  } else {
    console.log('✅ Twilio signature validated successfully');
  }

  return isValid;
}


  // ✅ UPDATED: Handle incoming message with real-time broadcast
  async handleIncomingMessage(req, res) {
    try {
      console.log('📥 Webhook received from Twilio');
      
      // Verify signature
      if (!this.verifyTwilioSignature(req)) {
        console.warn('⚠️ Invalid Twilio signature');
        return res.status(401).send('Unauthorized');
      }

      const { From, To, Body, MediaUrl0, MediaContentType0 } = req.body;

      if (!From || !Body) {
        console.error('❌ Missing required fields (From or Body)');
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
        // Still acknowledge to Twilio
        return res.send('OK');
      }

      console.log('✅ Found candidate:', candidate.name, '(ID:', candidate.id + ')');

      // Find or create conversation
      let conversation = await dbGet(
        this.db,
        `SELECT id FROM whatsapp_conversations 
         WHERE candidate_id = ? AND phone_number = ?`,
        [candidate.id, phoneNumber]
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
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [candidate.id, candidate.name, phoneNumber, timestamp, timestamp, timestamp]
        );

        conversation = { id: result.lastID };
        console.log('✅ New conversation created with ID:', conversation.id);
      } else {
        console.log('✅ Using existing conversation ID:', conversation.id);
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
      console.log('💾 Saving message to database...');
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

      console.log('✅ Message saved with ID:', msgResult.lastID);

      const message = {
  id: msgResult.lastID,
  conversationid: conversation.id,  // ✅ FIXED: matches React field name
  direction: 'inbound',
  body: content,
  mediaurl: mediaUrl,
  mediatype: mediaType,
  status: 'received',
  timestamp: timestamp,
  fromnumber: phoneNumber,
  tonumber: To.replace('whatsapp:', '')
};

console.log('📡 Broadcasting message:', JSON.stringify(message, null, 2));

// ✅ Broadcast via Socket.IO (real-time sync)
if (global.realtimeSync) {
  global.realtimeSync.broadcast('whatsapp:new-message', message);
  console.log('✅ Message broadcasted via Socket.IO');
} else {
  console.error('❌ global.realtimeSync NOT AVAILABLE - Socket.IO not initialized!');
}

// ✅ Send via IPC (backward compatibility)
if (this.mainWindow && this.mainWindow.webContents) {
  this.mainWindow.webContents.send('whatsapp:new-message', message);
  console.log('✅ Message sent via IPC to main window');
} else {
  console.error('❌ mainWindow.webContents not available!');
}

console.log('✅ Message processing complete:', message.id);

      // Send empty response to Twilio (it expects a 200 OK)
      res.send('OK');
    } catch (error) {
      console.error('❌ Error handling incoming message:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).send('Error processing message');
    }
  }

  // ✅ NEW: Handle message status updates (sent/delivered/read/failed)
async handleStatusCallback(req, res) {
  try {
    console.log('📊 Status callback received from Twilio');
    console.log('   Data:', JSON.stringify(req.body, null, 2));

    const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;

    if (!MessageSid || !MessageStatus) {
      console.error('❌ Missing MessageSid or MessageStatus');
      return res.status(400).send('Missing required fields');
    }

    console.log(`📍 Message ${MessageSid} status: ${MessageStatus}`);

    // Map Twilio status to our database status
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

    // Update message status in database
    const result = await dbRun(
      this.db,
      `UPDATE whatsapp_messages 
       SET status = ? 
       WHERE message_sid = ?`,
      [dbStatus, MessageSid]
    );

    console.log(`✅ Updated ${result.changes} message(s) in database`);

    // Build status update object
    const statusUpdate = {
      messageSid: MessageSid,
      status: dbStatus,
      originalStatus: MessageStatus,
      timestamp: new Date().toISOString(),
      to: To,
      error: ErrorCode ? { code: ErrorCode, message: ErrorMessage } : null
    };

    // Broadcast status update via Socket.IO
    if (global.realtimeSync) {
      global.realtimeSync.broadcast('whatsapp:message-status', statusUpdate);
      console.log('✅ Status update broadcasted via Socket.IO');
    } else {
      console.warn('⚠️ global.realtimeSync not available');
    }

    // Send via IPC (backward compatibility)
    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('whatsapp:message-ack', statusUpdate);
      console.log('✅ Status update sent via IPC');
    }

    res.send('OK');
  } catch (error) {
    console.error('❌ Error handling status callback:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).send('Error processing status');
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
  // Get webhook URLs (caller will provide the public URL)
getWebhookUrl(publicUrl) {
  return {
    incoming: `${publicUrl}/whatsapp/webhook`,
    status: `${publicUrl}/whatsapp/status`
  };
}

}

module.exports = TwilioWebhookServer;
