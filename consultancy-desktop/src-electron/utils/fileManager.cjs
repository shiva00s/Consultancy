const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class FileManager {
  constructor() {
    this.uploadsDir = null;
    this.initialized = false;
  }

  /**
   * Initialize uploads directory
   */
  async initialize() {
    try {
      const userDataPath = app.getPath('userData');
      this.uploadsDir = path.join(userDataPath, 'uploads');
      
      // Create directory structure
      const folders = ['resumes', 'photos', 'documents', 'certificates', 'temp'];
      
      for (const folder of folders) {
        const folderPath = path.join(this.uploadsDir, folder);
        await fs.mkdir(folderPath, { recursive: true });
      }
      
      this.initialized = true;
      console.log('✅ File manager initialized at:', this.uploadsDir);
      return this.uploadsDir;
    } catch (error) {
      console.error('Failed to initialize file manager:', error);
      throw error;
    }
  }

  /**
   * Ensure file manager is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Save uploaded file
   */
  async saveFile(fileBuffer, originalName, category = 'documents') {
    await this.ensureInitialized();

    try {
      // Generate unique filename
      const ext = path.extname(originalName);
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const uniqueName = `${timestamp}-${randomString}${ext}`;
      
      const categoryPath = path.join(this.uploadsDir, category);
      const filePath = path.join(categoryPath, uniqueName);

      // Ensure category directory exists
      await fs.mkdir(categoryPath, { recursive: true });

      // Save file
      await fs.writeFile(filePath, fileBuffer);

      console.log(`✅ File saved: ${uniqueName} (${fileBuffer.length} bytes)`);

      return {
        filename: uniqueName,
        originalName,
        path: filePath,
        category,
        size: fileBuffer.length,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }

  /**
   * Get file buffer
   */
  async getFile(filename, category = 'documents') {
    await this.ensureInitialized();
    
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
   * Get file as base64
   */
  async getFileBase64(filename, category = 'documents') {
    const buffer = await this.getFile(filename, category);
    return buffer.toString('base64');
  }

  /**
   * Check if file exists
   */
  async fileExists(filename, category = 'documents') {
    await this.ensureInitialized();
    
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filename, category = 'documents') {
    await this.ensureInitialized();
    
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      await fs.unlink(filePath);
      console.log(`✅ File deleted: ${filename}`);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Get file info/stats
   */
  async getFileInfo(filename, category = 'documents') {
    await this.ensureInitialized();
    
    const filePath = path.join(this.uploadsDir, category, filename);
    
    try {
      const stats = await fs.stat(filePath);
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * List all files in a category
   */
  async listFiles(category = 'documents') {
    await this.ensureInitialized();
    
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
   * Copy file to another location
   */
  async copyFile(sourceFilename, destFilename, sourceCategory = 'documents', destCategory = 'documents') {
    await this.ensureInitialized();
    
    const sourcePath = path.join(this.uploadsDir, sourceCategory, sourceFilename);
    const destPath = path.join(this.uploadsDir, destCategory, destFilename);
    
    try {
      await fs.copyFile(sourcePath, destPath);
      console.log(`✅ File copied: ${sourceFilename} → ${destFilename}`);
      return true;
    } catch (error) {
      console.error('Failed to copy file:', error);
      return false;
    }
  }

  /**
   * Move file to another category
   */
  async moveFile(filename, fromCategory, toCategory) {
    await this.ensureInitialized();
    
    const sourcePath = path.join(this.uploadsDir, fromCategory, filename);
    const destPath = path.join(this.uploadsDir, toCategory, filename);
    
    try {
      // Ensure destination directory exists
      await fs.mkdir(path.join(this.uploadsDir, toCategory), { recursive: true });
      
      await fs.rename(sourcePath, destPath);
      console.log(`✅ File moved: ${filename} (${fromCategory} → ${toCategory})`);
      return true;
    } catch (error) {
      console.error('Failed to move file:', error);
      return false;
    }
  }

  /**
   * Get uploads directory path
   */
  getUploadsPath() {
    return this.uploadsDir;
  }

  /**
   * Get full file path
   */
  getFilePath(filename, category = 'documents') {
    if (!this.uploadsDir) {
      return null;
    }
    return path.join(this.uploadsDir, category, filename);
  }

  /**
   * Get file MIME type
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Clean up old temp files (older than 24 hours)
   */
  async cleanupTempFiles() {
    await this.ensureInitialized();
    
    const tempPath = path.join(this.uploadsDir, 'temp');
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    try {
      const files = await fs.readdir(tempPath);
      
      for (const file of files) {
        const filePath = path.join(tempPath, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    await this.ensureInitialized();
    
    const categories = ['resumes', 'photos', 'documents', 'certificates', 'temp'];
    const stats = {
      total: 0,
      byCategory: {}
    };
    
    for (const category of categories) {
      const categoryPath = path.join(this.uploadsDir, category);
      
      try {
        const files = await fs.readdir(categoryPath);
        let categorySize = 0;
        
        for (const file of files) {
          const filePath = path.join(categoryPath, file);
          const fileStats = await fs.stat(filePath);
          categorySize += fileStats.size;
        }
        
        stats.byCategory[category] = {
          fileCount: files.length,
          totalSize: categorySize
        };
        
        stats.total += categorySize;
      } catch (error) {
        stats.byCategory[category] = {
          fileCount: 0,
          totalSize: 0
        };
      }
    }
    
    return stats;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Singleton instance
const fileManager = new FileManager();

module.exports = { fileManager, FileManager };
