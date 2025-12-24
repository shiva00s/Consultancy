// FILE: src-electron/services/catboxUploader.cjs
// Catbox.moe Free File Hosting Service - Supports ALL file types

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class CatboxUploader {
  constructor() {
    this.baseUrl = 'https://catbox.moe/user/api.php';
  }

  /**
   * Upload any file to Catbox and get public URL
   * @param {string} filePath - Local file path
   * @returns {Promise<Object>} - Upload result with URL
   */
  async upload(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }

      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      console.log('📤 Uploading to Catbox.moe:', path.basename(filePath));
      console.log('📊 File size:', fileSizeMB.toFixed(2), 'MB');

      // Check file size (200MB limit)
      if (fileSizeMB > 200) {
        throw new Error('File too large. Maximum size is 200MB');
      }

      // Prepare form data
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', fs.createReadStream(filePath), {
        filename: path.basename(filePath)
      });

      // Upload to Catbox
      const response = await axios.post(this.baseUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'User-Agent': 'WhatsAppIntegration/1.0'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120000 // 2 minutes for large files
      });

      const publicUrl = response.data.trim();
      
      // Validate URL
      if (!publicUrl || !publicUrl.startsWith('https://files.catbox.moe/')) {
        throw new Error('Invalid response from Catbox: ' + response.data);
      }

      console.log('✅ Catbox upload successful:', publicUrl);
      
      return {
        success: true,
        url: publicUrl,
        size: stats.size,
        filename: path.basename(filePath)
      };
      
    } catch (error) {
      console.error('❌ Catbox upload error:', error.message);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file is supported (all files up to 200MB)
   */
  isSupported(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      return fileSizeMB <= 200;
    } catch {
      return false;
    }
  }

  /**
   * Get supported file types info
   */
  getSupportedInfo() {
    return {
      maxSize: '200MB',
      retention: '1 year',
      types: 'All file types (images, PDFs, videos, documents, etc.)',
      cost: 'FREE'
    };
  }
}

module.exports = CatboxUploader;
