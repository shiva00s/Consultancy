const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class FileManager {
  constructor() {
    this.uploadsDir = null;
  }

  /**
   * Initialize uploads directory
   */
  async initialize() {
    const userDataPath = app.getPath('userData');
    this.uploadsDir = path.join(userDataPath, 'uploads');
    
    // Create directory structure
    const folders = ['resumes', 'photos', 'documents', 'certificates', 'temp'];
    
    for (const folder of folders) {
      const folderPath = path.join(this.uploadsDir, folder);
      await fs.mkdir(folderPath, { recursive: true });
    }
    
    console.log('File manager initialized at:', this.uploadsDir);
    return this.uploadsDir;
  }

  /**
   * Save uploaded file
   */
  async saveFile(fileBuffer, originalName, category = 'documents') {
    if (!this.uploadsDir) {
      await this.initialize();
    }

    // Generate unique filename
    const ext = path.extname(originalName);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const categoryPath = path.join(this.uploadsDir, category);
    const filePath = path.join(categoryPath, uniqueName);

    // Save file
    await fs.writeFile(filePath, fileBuffer);

    return {
      filename: uniqueName,
      originalName,
      path: filePath,
      category,
      size: fileBuffer.length,
      uploadedAt: new Date().toISOString()
    };
  }

  /**
   * Get file
   */
  async getFile(filename, category = 'documents') {
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('File not found:', filePath);
      throw new Error('File not found');
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filename, category = 'documents') {
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(filename, category = 'documents') {
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      const stats = await fs.stat(filePath);
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List files in category
   */
  async listFiles(category = 'documents') {
    const categoryPath = path.join(this.uploadsDir, category);
    
    try {
      const files = await fs.readdir(categoryPath);
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const stats = await fs.stat(path.join(categoryPath, file));
          return {
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
      );
      return fileInfos;
    } catch (error) {
      console.error('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Get uploads directory path
   */
  getUploadsPath() {
    return this.uploadsDir;
  }
}

// Singleton instance
const fileManager = new FileManager();

module.exports = { fileManager, FileManager };
