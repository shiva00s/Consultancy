// src-electron/services/twilioWhatsAppService.cjs

const twilio = require('twilio');

class TwilioWhatsAppService {
  constructor(mainWindow, db) {
    this.mainWindow = mainWindow;
    this.db = db;
    this.client = null;
    this.isReady = false;
    this.webhookUrl = null;
    
    // Twilio credentials (will be stored in database)
    this.accountSid = null;
    this.authToken = null;
    this.whatsappNumber = null; // Format: whatsapp:+14155238886
  }

  async initialize() {
    console.log('🔄 Initializing Twilio WhatsApp service...');

    try {
      // Load credentials from database
      await this.loadCredentials();

      if (!this.accountSid || !this.authToken || !this.whatsappNumber) {
        console.log('⚠️ Twilio credentials not configured');
        this.isReady = false;
        return;
      }

      // Initialize Twilio client
      this.client = twilio(this.accountSid, this.authToken);

      // Test connection
      await this.testConnection();

      this.isReady = true;
      this.mainWindow.webContents.send('whatsapp:ready');
      
      console.log('✅ Twilio WhatsApp service initialized');
    } catch (error) {
      console.error('❌ Twilio initialization failed:', error);
      this.isReady = false;
      throw error;
    }
  }

 async loadCredentials() {
  try {
    const settings = await this.db.all(`
      SELECT key, value 
      FROM system_settings 
      WHERE key IN ('twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number')
    `);
    
    console.log('Settings response:', settings);
    
    const settingsArray = Array.isArray(settings) ? settings : (settings?.data || []);
    
    if (settingsArray.length === 0) {
      console.log('No Twilio credentials configured yet');
      return;
    }
    
    // ✅ Use proper key names
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
      accountSid: this.accountSid ? '***configured***' : 'missing',
      authToken: this.authToken ? '***configured***' : 'missing',
      whatsappNumber: this.whatsappNumber
    });
  } catch (error) {
    console.error('Error loading Twilio credentials:', error);
  }
}

async saveCredentials(accountSid, authToken, whatsappNumber) {
  try {
    const credentials = [
      { key: 'twilio_account_sid', value: accountSid },
      { key: 'twilio_auth_token', value: authToken },
      { key: 'twilio_whatsapp_number', value: whatsappNumber }
    ];
    
    for (const credential of credentials) {
      await this.db.run(`
        INSERT OR REPLACE INTO system_settings (key, value) 
        VALUES (?, ?)
      `, [credential.key, credential.value]);
    }
    
    console.log('✅ Twilio credentials saved successfully');
    
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



  async testConnection() {
    try {
      // Try to fetch account info to verify credentials
      const account = await this.client.api.accounts(this.accountSid).fetch();
      console.log('✅ Twilio connection verified:', account.friendlyName);
      return true;
    } catch (error) {
      console.error('❌ Twilio connection test failed:', error);
      throw new Error('Invalid Twilio credentials');
    }
  }

  async sendMessage(phoneNumber, content) {
    if (!this.isReady) {
      throw new Error('Twilio WhatsApp service is not ready');
    }

    try {
      // Format phone number for WhatsApp (must include country code)
      const formattedNumber = phoneNumber.startsWith('+') 
        ? `whatsapp:${phoneNumber}` 
        : `whatsapp:+${phoneNumber.replace(/[^0-9]/g, '')}`;

      console.log('📤 Sending WhatsApp message via Twilio to:', formattedNumber);

      const message = await this.client.messages.create({
        from: this.whatsappNumber,
        to: formattedNumber,
        body: content
      });

      console.log('✅ Message sent:', message.sid);

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        timestamp: new Date(message.dateCreated).getTime()
      };
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  async handleIncomingMessage(messageData) {
    try {
      // Extract phone number (remove 'whatsapp:' prefix)
      const phoneNumber = messageData.From.replace('whatsapp:', '');
      const content = messageData.Body;
      const timestamp = new Date(messageData.DateCreated || Date.now()).getTime();

      console.log('📨 Incoming message from:', phoneNumber);

      // Find candidate by phone number
      const candidate = await this.db.get(`
        SELECT id, name FROM candidates 
        WHERE contact LIKE ? OR contact LIKE ?
      `, [`%${phoneNumber}%`, `%${phoneNumber.slice(-10)}%`]);

      if (!candidate) {
        console.log('⚠️ No candidate found for phone:', phoneNumber);
        return { success: false, error: 'Candidate not found' };
      }

      // Find or create conversation
      let conversation = await this.db.get(`
        SELECT id FROM whatsapp_conversations 
        WHERE candidate_id = ?
      `, [candidate.id]);

      if (!conversation) {
        const result = await this.db.run(`
          INSERT INTO whatsapp_conversations (
            candidate_id, 
            phone_number, 
            last_message_time
          ) VALUES (?, ?, ?)
        `, [candidate.id, phoneNumber, timestamp]);

        conversation = { id: result.lastID };
      } else {
        // Update last message time
        await this.db.run(`
          UPDATE whatsapp_conversations 
          SET last_message_time = ? 
          WHERE id = ?
        `, [timestamp, conversation.id]);
      }

      // Store message in database
      const result = await this.db.run(`
        INSERT INTO whatsapp_messages (
          conversation_id,
          sender_type,
          content,
          message_type,
          status,
          timestamp,
          is_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        conversation.id,
        'candidate',
        content,
        'text',
        'received',
        timestamp,
        0
      ]);

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

      console.log('✅ Message stored and sent to UI');

      return { success: true, message };
    } catch (error) {
      console.error('Error handling incoming message:', error);
      return { success: false, error: error.message };
    }
  }

  async getStatus() {
    return {
      isReady: this.isReady,
      hasCredentials: !!(this.accountSid && this.authToken && this.whatsappNumber),
      whatsappNumber: this.whatsappNumber
    };
  }

  async disconnect() {
    this.isReady = false;
    this.mainWindow.webContents.send('whatsapp:disconnected', 'Manual disconnect');
    console.log('✅ Twilio WhatsApp disconnected');
  }

  async destroy() {
    this.client = null;
    this.isReady = false;
    console.log('✅ Twilio WhatsApp service destroyed');
  }
}

module.exports = TwilioWhatsAppService;
