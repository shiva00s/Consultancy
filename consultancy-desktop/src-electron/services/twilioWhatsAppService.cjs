const twilio = require('twilio');
const { dbAll, dbGet, dbRun } = require('../db/database.cjs');
const TwilioWebhookServer = require('./twilioWebhookServer.cjs');
const keyManager = require('./keyManager.cjs');

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
        await this.webhookServer.initialize(this.authToken, this.accountSid);
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
      `SELECT key, value FROM system_settings 
       WHERE key IN ('twilioaccountsid', 'twilioauthtoken', 'twiliowhatsappnumber')`
    );

    const settingsArray = Array.isArray(settings) ? settings : [settings];
    
    if (settingsArray.length === 0) {
      console.log('⚠️ No Twilio credentials configured yet');
      return;
    }

    settingsArray.forEach(setting => {
      if (setting.key === 'twilioaccountsid') {
        this.accountSid = setting.value;
      } else if (setting.key === 'twilioauthtoken') {
        this.authToken = setting.value;
      } else if (setting.key === 'twiliowhatsappnumber') {
        this.whatsappNumber = setting.value;
      }
    });

    console.log('✅ Loaded Twilio credentials:', {
      accountSid: this.accountSid ? 'SET' : 'MISSING',
      authToken: this.authToken ? 'SET' : 'MISSING',
      whatsappNumber: this.whatsappNumber || 'NOT SET'
    });
  } catch (error) {
    console.error('❌ Error loading Twilio credentials:', error);
  }
}


  // ========================================
// Save credentials
// ========================================
async saveCredentials(accountSid, authToken, whatsappNumber) {
  try {
    const credentials = [
      { key: 'twilioaccountsid', value: accountSid },
      { key: 'twilioauthtoken', value: authToken },
      { key: 'twiliowhatsappnumber', value: whatsappNumber }
    ];

    for (const credential of credentials) {
      await dbRun(this.db,
        `INSERT OR REPLACE INTO system_settings (key, value, updated_at) 
         VALUES (?, ?, datetime('now'))`,
        [credential.key, credential.value]
      );
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
    console.error('❌ Error saving credentials:', error);
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
// SEND MESSAGE WITH MEDIA (ImgBB + Catbox - ALL FILE TYPES)
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
      body: content || ''
    };

    // ✅ HANDLE MEDIA: Auto-upload to ImgBB (images) or Catbox (all files)
    if (Array.isArray(localMediaPaths) && localMediaPaths.length > 0) {
      const fs = require('fs');
      const path = require('path');
      
      console.log('🔍 Checking for media files...');
      console.log('🔍 Media paths:', localMediaPaths);
      
      // Get the first media file (WhatsApp supports 1 per message)
      const localPath = localMediaPaths[0];
      console.log('📂 Processing file:', localPath);
      
      if (!fs.existsSync(localPath)) {
        console.error('❌ File not found:', localPath);
      } else {
        const fileStats = fs.statSync(localPath);
        const fileSizeMB = fileStats.size / (1024 * 1024);
        console.log('📊 File size:', fileSizeMB.toFixed(2), 'MB');
        
        try {
          const ext = path.extname(localPath).toLowerCase();
          console.log('🔍 File extension:', ext);
          
          const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
          const isImage = imageExts.includes(ext);
          
          console.log('🔍 Is image?', isImage);
          
          let uploadSuccess = false;
          
          // Strategy: Try ImgBB first for images, then Catbox for all files
          if (isImage) {
            console.log('📸 Image detected - trying ImgBB first...');
            
            // Get ImgBB API key from database
            let imgbbApiKey = null;
            try {
              const setting = await dbGet(
                this.db,
                `SELECT value FROM system_settings WHERE key = 'imgbbApiKey' LIMIT 1`
              );
              imgbbApiKey = setting ? setting.value : null;
            } catch (err) {
              console.warn('⚠️ Could not load ImgBB API key');
            }
            
            if (imgbbApiKey) {
              const ImgBBUploader = require('./imgbbUploader.cjs');
              console.log('🌐 Uploading image to ImgBB...');
              
              const uploader = new ImgBBUploader(imgbbApiKey);
              const uploadResult = await uploader.upload(localPath);
              
              if (uploadResult.success) {
                messageOptions.mediaUrl = [uploadResult.url];
                console.log('✅ ✅ ImgBB SUCCESS! Media URL:', uploadResult.url);
                uploadSuccess = true;
              } else {
                console.error('❌ ImgBB upload failed:', uploadResult.error);
              }
            } else {
              console.warn('⚠️ ImgBB API key not configured');
            }
          }
          
          // If ImgBB failed or not applicable, try Catbox (works for ALL files)
          if (!uploadSuccess) {
            console.log('🌐 Uploading to Catbox.moe (supports all file types)...');
            
            const CatboxUploader = require('./catboxUploader.cjs');
            const catboxUploader = new CatboxUploader();
            
            const uploadResult = await catboxUploader.upload(localPath);
            
            if (uploadResult.success) {
              messageOptions.mediaUrl = [uploadResult.url];
              console.log('✅ ✅ Catbox SUCCESS! Media URL:', uploadResult.url);
              uploadSuccess = true;
            } else {
              console.error('❌ Catbox upload failed:', uploadResult.error);
            }
          }
          
          // Final fallback: ngrok (if available)
          if (!uploadSuccess) {
            console.warn('⚠️ All upload services failed, trying ngrok fallback...');

            if (ngrokUrl && ngrokUrl !== 'http://127.0.0.1:3001') {
              const jwt = require('jsonwebtoken');
              const secret = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || null;
              const token = jwt.sign({ path: localPath }, secret || 'dev-temporary-secret', { expiresIn: '7d' });
              const filename = path.basename(localPath);
              const cleanNgrokUrl = ngrokUrl.replace(/\/$/, '');
              const publicUrl = `${cleanNgrokUrl}/public/files/${token}/${encodeURIComponent(filename)}`;

              messageOptions.mediaUrl = [publicUrl];
              console.log('📎 Using ngrok fallback:', publicUrl);
            } else {
              console.error('❌ No valid upload method available');
              console.error('💡 Please configure ImgBB API key or ensure Catbox.moe is accessible');
            }
          }
          
        } catch (mediaError) {
          console.error('❌ Media processing error:', mediaError);
          console.error('Stack trace:', mediaError.stack);
        }
      }
    } else {
      console.log('ℹ️ No media files provided');
    }

    // Ensure message has content
    if (!messageOptions.body && !messageOptions.mediaUrl) {
      messageOptions.body = '👋';
    }

    // Status callback for delivery tracking
    try {
      const callbackBase = ngrokUrl || 'http://127.0.0.1:3001';
      messageOptions.statusCallback = `${callbackBase.replace(/\/$/, '')}/whatsapp/status`;
    } catch (cbErr) {
      console.warn('⚠️ Could not set statusCallback:', cbErr?.message);
    }

    // Send message via Twilio
    console.log('🚀 Sending to Twilio API...');
    console.log('📋 Message options:', {
      from: messageOptions.from,
      to: messageOptions.to,
      hasBody: !!messageOptions.body,
      hasMedia: !!messageOptions.mediaUrl,
      mediaUrl: messageOptions.mediaUrl
    });
    
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
    console.error('❌ ❌ ❌ Error sending message:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

/*
// ========================================
// SEND MESSAGE WITH MEDIA imggbb(ENHANCED LOGGING)
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
      body: content || ''
    };

    // ✅ HANDLE MEDIA: Auto-upload to ImgBB (FREE)
    if (Array.isArray(localMediaPaths) && localMediaPaths.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const ImgBBUploader = require('./imgbbUploader.cjs');
      
      console.log('🔍 Checking for media files...');
      console.log('🔍 Media paths:', localMediaPaths);
      
      // Get ImgBB API key from database
      let imgbbApiKey = null;
      try {
        const setting = await dbGet(
          this.db,
          `SELECT value FROM system_settings WHERE key = 'imgbbApiKey' LIMIT 1`
        );
        imgbbApiKey = setting ? setting.value : null;
        
        if (imgbbApiKey) {
          console.log('✅ ImgBB API key found:', imgbbApiKey.substring(0, 10) + '...');
        } else {
          console.log('❌ ImgBB API key NOT found in database');
        }
      } catch (err) {
        console.error('❌ Error loading ImgBB API key:', err);
      }

      // Get the first media file (WhatsApp supports 1 per message)
      const localPath = localMediaPaths[0];
      console.log('📂 Processing file:', localPath);
      
      if (!fs.existsSync(localPath)) {
        console.error('❌ File not found:', localPath);
      } else {
        const fileStats = fs.statSync(localPath);
        console.log('📊 File size:', fileStats.size, 'bytes');
        
        try {
          console.log('📤 Processing media for WhatsApp...');
          
          // Check if it's an image
          const ext = path.extname(localPath).toLowerCase();
          console.log('🔍 File extension:', ext);
          
          const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
          const isImage = imageExts.includes(ext);
          
          console.log('🔍 Is image?', isImage);
          console.log('🔍 Has ImgBB key?', !!imgbbApiKey);
          
          if (isImage && imgbbApiKey) {
            // ✅ Upload to ImgBB (FREE, no ngrok needed)
            console.log('🌐 Starting ImgBB upload...');
            
            const uploader = new ImgBBUploader(imgbbApiKey);
            const uploadResult = await uploader.upload(localPath);
            
            console.log('📊 ImgBB upload result:', uploadResult);
            
            if (uploadResult.success) {
              messageOptions.mediaUrl = [uploadResult.url];
              console.log('✅ ✅ ✅ ImgBB SUCCESS! Media URL:', uploadResult.url);
              console.log('🎉 This URL should work with Twilio!');
            } else {
              console.error('❌ ImgBB upload FAILED:', uploadResult.error);
              console.log('⚠️ Will try ngrok fallback...');
              
              // Fallback to ngrok
              if (ngrokUrl && ngrokUrl !== 'http://127.0.0.1:3001') {
                const jwt = require('jsonwebtoken');
                const SECRET = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || 'dev-temporary-secret';
                
                const token = jwt.sign({ path: localPath }, SECRET, { expiresIn: '7d' });
                const filename = path.basename(localPath);
                const cleanNgrokUrl = ngrokUrl.replace(/\/$/, '');
                const publicUrl = `${cleanNgrokUrl}/public/files/${token}/${encodeURIComponent(filename)}`;
                
                messageOptions.mediaUrl = [publicUrl];
                console.log('📎 Using ngrok fallback:', publicUrl);
              } else {
                console.log('❌ No valid ngrok URL available');
              }
            }
          } else if (!imgbbApiKey) {
            console.warn('⚠️ ⚠️ ⚠️ ImgBB API key NOT configured');
            console.log('💡 Add ImgBB API key to system_settings table');
            console.log('💡 Key: imgbbApiKey');
            console.log('💡 Get free key from: https://api.imgbb.com/');
            
            // Try ngrok fallback
            if (ngrokUrl && ngrokUrl !== 'http://127.0.0.1:3001') {
              const jwt = require('jsonwebtoken');
              const SECRET = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || 'dev-temporary-secret';
              
              const token = jwt.sign({ path: localPath }, SECRET, { expiresIn: '7d' });
              const filename = path.basename(localPath);
              const cleanNgrokUrl = ngrokUrl.replace(/\/$/, '');
              const publicUrl = `${cleanNgrokUrl}/public/files/${token}/${encodeURIComponent(filename)}`;
              
              messageOptions.mediaUrl = [publicUrl];
              console.log('📎 Using ngrok URL (ImgBB not configured):', publicUrl);
            }
          } else {
            console.log('📎 Non-image file, using ngrok URL');
            
            // Non-image files: use ngrok
            if (ngrokUrl && ngrokUrl !== 'http://127.0.0.1:3001') {
              const jwt = require('jsonwebtoken');
              const SECRET = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || 'dev-temporary-secret';
              
              const token = jwt.sign({ path: localPath }, SECRET, { expiresIn: '7d' });
              const filename = path.basename(localPath);
              const cleanNgrokUrl = ngrokUrl.replace(/\/$/, '');
              const publicUrl = `${cleanNgrokUrl}/public/files/${token}/${encodeURIComponent(filename)}`;
              
              messageOptions.mediaUrl = [publicUrl];
              console.log('📎 Media URL:', publicUrl);
            }
          }
          
        } catch (mediaError) {
          console.error('❌ Media processing error:', mediaError);
          console.error('Stack trace:', mediaError.stack);
        }
      }
    } else {
      console.log('ℹ️ No media files provided');
    }

    // Ensure message has content
    if (!messageOptions.body && !messageOptions.mediaUrl) {
      messageOptions.body = '👋';
    }

    // Status callback for delivery tracking
    try {
      const callbackBase = ngrokUrl || 'http://127.0.0.1:3001';
      messageOptions.statusCallback = `${callbackBase.replace(/\/$/, '')}/whatsapp/status`;
    } catch (cbErr) {
      console.warn('⚠️ Could not set statusCallback:', cbErr?.message);
    }

    // Send message via Twilio
    console.log('🚀 Sending to Twilio API...');
    console.log('📋 Message options:', {
      from: messageOptions.from,
      to: messageOptions.to,
      hasBody: !!messageOptions.body,
      hasMedia: !!messageOptions.mediaUrl,
      mediaUrl: messageOptions.mediaUrl
    });
    
    const message = await this.client.messages.create(messageOptions);
    
    console.log('✅ Message sent:', message.sid);
    console.log('Status:', message.status);
    console.log('Error code:', message.errorCode);
    console.log('Error message:', message.errorMessage);

    return {
      success: true,
      messageId: message.sid,
      messagesid: message.sid,
      status: message.status,
      timestamp: new Date(message.dateCreated).toISOString()
    };
  } catch (error) {
    console.error('❌ ❌ ❌ Error sending message:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo
    });
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}


async generatePublicFileUrl(filePath) {
  const jwt = require('jsonwebtoken');
  const path = require('path');
  const { dbGet } = require('../db/whatsappQueries.cjs');
  const { getDatabase } = require('../db/database.cjs');

  try {
    if (!filePath) throw new Error('File path is required');

    // Get ngrok URL from database
    const db = getDatabase();
    const setting = await dbGet(db, 
      `SELECT value FROM systemsettings WHERE key = 'twilioNgrokUrl'`
    );

    // Use ngrok URL if available, otherwise fallback to localhost
    const BASE_URL = setting?.value || 'http://127.0.0.1:3001';
    const SECRET = await keyManager.getKey('twilioJwtSecret') || process.env.TWILIO_JWT_SECRET || 'dev-temporary-secret';

    const normalizedPath = path.resolve(filePath);
    const token = jwt.sign({ path: normalizedPath }, SECRET, { expiresIn: '24h' });
    const filename = path.basename(normalizedPath);
    const publicUrl = `${BASE_URL}/public/files/${token}/${filename}`;

    console.log('✅ Generated public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error generating public URL:', error);
    throw error;
  }
}
*/

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
  // Ensure credentials are loaded before returning status
  if (!this.accountSid && !this.authToken && !this.whatsappNumber) {
    await this.loadCredentials();
  }
  
  return {
    isReady: this.isReady,
    hasCredentials: !!(this.accountSid && this.authToken && this.whatsappNumber),
    whatsappNumber: this.whatsappNumber,
    credentials: {
      accountSid: this.accountSid || '',
      authToken: this.authToken || '',
      whatsappNumber: this.whatsappNumber || ''
    }
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

// ========================================
// 🆕 UPDATE TWILIO WEBHOOK URL
// ========================================
async updateWebhookUrl(ngrokUrl) {
  try {
    if (!this.client || !this.whatsappNumber) {
      console.warn('⚠️ Cannot update webhook: Twilio not initialized');
      return { success: false, error: 'Twilio not initialized' };
    }

    const webhookUrls = {
      incoming: `${ngrokUrl}/whatsapp/webhook`,
      status: `${ngrokUrl}/whatsapp/status`
    };

    console.log('🔄 Updating Twilio webhook URLs...');
    console.log('  Incoming:', webhookUrls.incoming);
    console.log('  Status:', webhookUrls.status);

    // Get the phone number SID
    const phoneNumbers = await this.client
      .incomingPhoneNumbers
      .list({ phoneNumber: this.whatsappNumber.replace('whatsapp:', '') });

    if (phoneNumbers.length === 0) {
      throw new Error('Phone number not found in Twilio account');
    }

    const phoneNumberSid = phoneNumbers[0].sid;

    // Update the webhook URLs
    await this.client
      .incomingPhoneNumbers(phoneNumberSid)
      .update({
        smsUrl: webhookUrls.incoming,
        smsMethod: 'POST',
        statusCallback: webhookUrls.status,
        statusCallbackMethod: 'POST'
      });

    console.log('✅ Webhook URLs updated successfully');
    
    // Save to database
    await dbRun(
      this.db,
      `INSERT OR REPLACE INTO system_settings (key, value) VALUES ('twilioNgrokUrl', ?)`,
      [ngrokUrl]
    );

    // Update webhook server's ngrok URL
    if (this.webhookServer) {
      this.webhookServer.ngrokUrl = ngrokUrl;
    }

    return { 
      success: true, 
      webhookUrls 
    };
  } catch (error) {
    console.error('❌ Failed to update webhook URLs:', error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}


}

module.exports = TwilioWhatsAppService;
