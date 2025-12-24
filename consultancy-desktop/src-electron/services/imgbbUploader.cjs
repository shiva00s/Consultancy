// FILE: src-electron/services/imgbbUploader.cjs
// ImgBB Free Image Hosting Service

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class ImgBBUploader {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.imgbb.com/1/upload';
  }

  /**
   * Upload image to ImgBB and get public URL
   * @param {string} filePath - Local file path
   * @returns {Promise<string>} - Public URL
   */
  async upload(filePath) {
    try {
      if (!this.apiKey) {
        throw new Error('ImgBB API key not configured');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }

      console.log('📤 Uploading to ImgBB:', path.basename(filePath));

      // Read file as base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64Image = fileBuffer.toString('base64');
      
      // Prepare form data
      const formData = new FormData();
      formData.append('key', this.apiKey);
      formData.append('image', base64Image);
      formData.append('name', path.basename(filePath, path.extname(filePath)));

      // Upload to ImgBB
      const response = await axios.post(this.baseUrl, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000
      });

      if (response.data && response.data.success && response.data.data) {
        const publicUrl = response.data.data.url;
        console.log('✅ ImgBB upload successful:', publicUrl);
        
        return {
          success: true,
          url: publicUrl,
          display_url: response.data.data.display_url,
          delete_url: response.data.data.delete_url,
          size: response.data.data.size
        };
      } else {
        throw new Error('ImgBB upload failed: Invalid response');
      }
    } catch (error) {
      console.error('❌ ImgBB upload error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file type is supported
   */
  isSupported(filePath) {
    const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(filePath).toLowerCase();
    return supportedExts.includes(ext);
  }
}

module.exports = ImgBBUploader;
