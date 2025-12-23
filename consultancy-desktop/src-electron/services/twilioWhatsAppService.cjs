const twilio = require('twilio');
const { dbAll, dbGet, dbRun } = require('../db/database.cjs');
const TwilioWebhookServer = require('./twilioWebhookServer.cjs');

class TwilioWhatsAppService {
  constructor(mainWindow, db) {
    this.mainWindow = mainWindow;
    this.db = db;
    this.client = null;
    this.isReady = false;
    this.webhookUrl = null;
    this.webhookServer = null;

    // Twilio credentials (will be stored in database)
    this.accountSid = null;
    this.authToken = null;
    this.whatsappNumber = null; // Format: whatsapp:+14155238886
  }

  // ========================================
  // Normalize phone number to E.164 format
  // ========================================
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Remove all non-digit characters except leading +
    let cleaned = phoneNumber.replace(/\D/g, '');
    console.log('Normalizing phone:', phoneNumber, '->', cleaned);

    // Remove + if present
    cleaned = cleaned.replace(/^\+/, '');

    // Handle specific cases
    // Case 1: Number starts with 962 but is only 10 digits (missing +91)
    if (cleaned.startsWith('962') && cleaned.length === 10) {
      cleaned = '91' + cleaned;
      console.log('Fixed: Added country code +91', cleaned);
    }
    // Case 2: Number starts with 0 (remove leading zero)
    else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
      console.log('Fixed: Removed leading 0', cleaned);
    }
    // Case 3: 10-digit number without country code (assume India +91)
    else if (cleaned.length === 10 && !cleaned.startsWith('91')) {
      cleaned = '91' + cleaned;
      console.log('Fixed: Added default country code +91', cleaned);
    }
    // Case 4: Already has +91 prefix (12 digits total)
    else if (cleaned.startsWith('91') && cleaned.length === 12) {
      console.log('Already formatted correctly', cleaned);
    }

    return '+' + cleaned;
  }

  // ========================================
  // Initialize service
  // ========================================
  async initialize() {
    console.log('Initializing Twilio WhatsApp service...');

    try {
      // Load credentials from database
      await this.loadCredentials();

      if (!this.accountSid || !this.authToken || !this.whatsappNumber) {
        console.log('Twilio credentials not configured');
        this.isReady = false;
        return;
      }

      // Initialize Twilio client
      this.client = twilio(this.accountSid, this.authToken);

      // Test connection
      await this.testConnection();

      // Initialize webhook server for incoming messages
      try {
        this.webhookServer = new TwilioWebhookServer(this.mainWindow, this.db, 3001);
        await this.webhookServer.initialize(this.authToken);
        console.log('Webhook server initialized on port 3001');
      } catch (webhookError) {
        console.warn('Failed to start webhook server:', webhookError.message);
        // Don't fail - app can still send messages
      }

      this.isReady = true;
      this.mainWindow.webContents.send('whatsapp:ready');
      console.log('✅ Twilio WhatsApp service initialized');
    } catch (error) {
      console.error('Twilio initialization failed:', error);
      this.isReady = false;
      throw error;
    }
  }

  // ========================================
  // Load credentials from database
  // ========================================
  async loadCredentials() {
    try {
      const settings = await dbAll(this.db,
        `SELECT key, value FROM system_settings WHERE key IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number')`
      );

      const settingsArray = Array.isArray(settings) ? settings : [settings];

      if (settingsArray.length === 0) {
        console.log('No Twilio credentials configured yet');
        return;
      }

      settingsArray.forEach(setting => {
        if (setting.key === 'twilio_account_sid') {
          this.accountSid = setting.value;
        } else if (setting.key === 'twilio_auth_token') {
          this.authToken = setting.value;
        } else if (setting.key === 'twilio_whatsapp_number') {
          this.whatsappNumber = setting.value;
        }
      });

      console.log('Loaded Twilio credentials:', {
        accountSid: this.accountSid ? 'configured' : 'missing',
        authToken: this.authToken ? 'configured' : 'missing',
        whatsappNumber: this.whatsappNumber
      });
    } catch (error) {
      console.error('Error loading Twilio credentials:', error);
    }
  }

  // ========================================
  // Save credentials
  // ========================================
  async saveCredentials(accountSid, authToken, whatsappNumber) {
    try {
      const credentials = [
        { key: 'twilio_account_sid', value: accountSid },
        { key: 'twilio_auth_token', value: authToken },
        { key: 'twilio_whatsapp_number', value: whatsappNumber }
      ];

      for (const credential of credentials) {
        await dbRun(this.db,
          `INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)`,
          [credential.key, credential.value]
        );
      }

      console.log('Twilio credentials saved successfully');

      // Update instance variables
      this.accountSid = accountSid;
      this.authToken = authToken;
      this.whatsappNumber = whatsappNumber;

      // Reinitialize Twilio client
      await this.initialize();

      return { success: true };
    } catch (error) {
      console.error('Error saving credentials:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Test connection
  // ========================================
  async testConnection() {
    try {
      // Try to fetch account info to verify credentials
      const account = await this.client.api.accounts(this.accountSid).fetch();
      console.log('Twilio connection verified:', account.friendlyName);
      return true;
    } catch (error) {
      console.error('Twilio connection test failed:', error);
      throw new Error('Invalid Twilio credentials');
    }
  }

  // ========================================
  // 🆕 UPLOAD MEDIA TO TWILIO (NEW METHOD)
  // ========================================
  async uploadMediaToTwilio(filePath) {
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');
    const axios = require('axios');

    try {
      console.log('📤 Uploading media to Twilio:', filePath);

      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }

      const fileStream = fs.createReadStream(filePath);
      const fileName = path.basename(filePath);
      
      // Determine content type from extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.mp4': 'video/mp4',
        '.mp3': 'audio/mpeg',
        '.txt': 'text/plain',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
      
      contentType = contentTypeMap[ext] || contentType;

      // Create form data
      const formData = new FormData();
      formData.append('file', fileStream, {
        filename: fileName,
        contentType: contentType
      });

      // Upload to Twilio
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages/Media.json`;
      
      const response = await axios.post(url, formData, {
        auth: {
          username: this.accountSid,
          password: this.authToken
        },
        headers: {
          ...formData.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      // Get the media URL
      const mediaUri = response.data.uri;
      const mediaUrl = `https://api.twilio.com${mediaUri.replace('.json', '')}`;
      
      console.log('✅ Media uploaded successfully:', mediaUrl);
      return mediaUrl;
      
    } catch (error) {
      console.error('❌ Twilio media upload failed:', error.response?.data || error.message);
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  }

  // ========================================
// SEND MESSAGE WITH MEDIA (NGROK VERSION)
// ========================================
async sendMessage(phoneNumber, content, localMediaPaths, ngrokUrl = null) {
  if (!this.isReady) {
    throw new Error('Twilio WhatsApp service is not ready');
  }

  try {
    const formattedNumber = phoneNumber.startsWith('+')
      ? `whatsapp:${phoneNumber}`
      : `whatsapp:+${phoneNumber.replace(/[^0-9]/g, '')}`;

    console.log('📤 Sending WhatsApp message via Twilio to:', formattedNumber);

    const messageOptions = {
      from: this.whatsappNumber,
      to: formattedNumber,
      body: content || '📎 Media'
    };

    // ✅ Add media URLs if provided and ngrok is configured
    if (Array.isArray(localMediaPaths) && localMediaPaths.length > 0) {
      if (!ngrokUrl) {
        console.warn('⚠️  Media files detected but no ngrok URL configured');
        console.warn('⚠️  Message will be sent without media');
        console.warn('⚠️  Please configure ngrok URL in WhatsApp settings');
      } else {
        const publicUrls = [];
        const fs = require('fs');
        const path = require('path');
        const jwt = require('jsonwebtoken');
        
        const SECRET = '12023e5cf451cc4fc225b09f1543bd6c43c735c71db89f20c63cd6860430fc395b88778254ccbba2043df5989c0e61968cbf4ef6e4c6a6924f90fbe4c75cbb60';
        
        for (const localPath of localMediaPaths) {
          if (!fs.existsSync(localPath)) {
            console.warn('⚠️  File not found:', localPath);
            continue;
          }
          
          // Generate public URL using ngrok
          const token = jwt.sign({ path: localPath }, SECRET, { expiresIn: '24h' });
          const filename = path.basename(localPath);
          const publicUrl = `${ngrokUrl}/public/files/${token}/${filename}`;
          
          publicUrls.push(publicUrl);
          console.log('✅ Generated public media URL:', publicUrl);
          
          break; // WhatsApp supports 1 media per message
        }
        
        if (publicUrls.length > 0) {
          messageOptions.mediaUrl = publicUrls;
          console.log('✅ Including media URL in Twilio message');
        }
      }
    }

    // Send message via Twilio
    const message = await this.client.messages.create(messageOptions);
    
    console.log('✅ Message sent:', message.sid);
    console.log('Status:', message.status);

    return {
      success: true,
      messageId: message.sid,
      messagesid: message.sid,
      status: message.status,
      timestamp: new Date(message.dateCreated).toISOString()
    };
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return {
      success: false,
      error: error.message
    };
  }
}


  // ========================================
  // Handle incoming message (unchanged)
  // ========================================
  async handleIncomingMessage(messageData) {
    try {
      // Extract phone number (remove whatsapp: prefix)
      const phoneNumber = messageData.From.replace('whatsapp:', '');
      const content = messageData.Body;
      const timestamp = new Date(messageData.DateCreated || Date.now()).getTime();

      console.log('📥 Incoming message from:', phoneNumber);

      // Find candidate by phone number
      const candidate = await dbGet(this.db,
        `SELECT id, name FROM candidates WHERE contact LIKE ? OR contact LIKE ?`,
        [`%${phoneNumber}`, `%${phoneNumber.slice(-10)}`]
      );

      if (!candidate) {
        console.log('No candidate found for phone:', phoneNumber);
        return { success: false, error: 'Candidate not found' };
      }

      // Find or create conversation
      let conversation = await this.db.get(
        `SELECT id FROM whatsapp_conversations WHERE candidate_id = ?`,
        [candidate.id]
      );

      if (!conversation) {
        const result = await dbRun(this.db,
          `INSERT INTO whatsapp_conversations (candidate_id, phone_number, last_message_time) VALUES (?, ?, ?)`,
          [candidate.id, phoneNumber, timestamp]
        );
        conversation = { id: result.lastID };
      } else {
        // Update last message time
        await dbRun(this.db,
          `UPDATE whatsapp_conversations SET last_message_time = ? WHERE id = ?`,
          [timestamp, conversation.id]
        );
      }

      // Store message in database
      const result = await dbRun(this.db,
        `INSERT INTO whatsapp_messages (
          conversation_id, sender_type, content, message_type, status, timestamp, is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [conversation.id, 'candidate', content, 'text', 'received', timestamp, 0]
      );

      // Send to renderer
      const message = {
        id: result.lastID,
        conversation_id: conversation.id,
        sender_type: 'candidate',
        content: content,
        message_type: 'text',
        status: 'received',
        timestamp: timestamp,
        is_read: 0
      };

      this.mainWindow.webContents.send('whatsapp:new-message', message);
      console.log('Message stored and sent to UI');

      return { success: true, message };
    } catch (error) {
      console.error('Error handling incoming message:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // Get status
  // ========================================
  async getStatus() {
    return {
      isReady: this.isReady,
      hasCredentials: !!(this.accountSid && this.authToken && this.whatsappNumber),
      whatsappNumber: this.whatsappNumber
    };
  }

  // ========================================
  // Disconnect
  // ========================================
  async disconnect() {
    this.isReady = false;
    this.mainWindow.webContents.send('whatsapp:disconnected', 'Manual disconnect');
    console.log('Twilio WhatsApp disconnected');
  }

  // ========================================
  // Destroy
  // ========================================
  async destroy() {
    if (this.webhookServer) {
      await this.webhookServer.destroy();
    }
    this.client = null;
    this.isReady = false;
    console.log('Twilio WhatsApp service destroyed');
  }

  // ========================================
  // Get webhook URL
  // ========================================
  getWebhookUrl(publicUrl = 'http://localhost:3001') {
    if (!this.webhookServer) return null;
    return this.webhookServer.getWebhookUrl(publicUrl);
  }
}

module.exports = TwilioWhatsAppService;
