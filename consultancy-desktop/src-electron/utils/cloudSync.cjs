const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const { google } = require('googleapis');
const { Dropbox } = require('dropbox');
const axios = require('axios');

class CloudSync {
  constructor() {
    this.provider = null; // 'google', 'dropbox', 'custom'
    this.config = null;
    this.lastSyncTime = null;
  }

  /**
   * Initialize cloud sync with provider
   */
  async initialize(provider, config) {
    this.provider = provider;
    this.config = config;

    switch (provider) {
      case 'google':
        return this.initGoogleDrive(config);
      case 'dropbox':
        return this.initDropbox(config);
      case 'custom':
        return this.initCustomServer(config);
      default:
        throw new Error('Invalid cloud provider');
    }
  }

  /**
   * Initialize Google Drive
   */
  async initGoogleDrive(config) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );

      if (config.refreshToken) {
        oauth2Client.setCredentials({
          refresh_token: config.refreshToken
        });
      }

      this.driveClient = google.drive({ version: 'v3', auth: oauth2Client });
      
      console.log('✅ Google Drive initialized');
      return { success: true, message: 'Google Drive connected' };
    } catch (error) {
      console.error('Google Drive init failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Dropbox
   */
  async initDropbox(config) {
    try {
      this.dropboxClient = new Dropbox({ accessToken: config.accessToken });
      
      console.log('✅ Dropbox initialized');
      return { success: true, message: 'Dropbox connected' };
    } catch (error) {
      console.error('Dropbox init failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Custom Server
   */
  async initCustomServer(config) {
    try {
      // Test connection
      const response = await axios.get(`${config.serverUrl}/api/health`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 5000
      });

      if (response.status === 200) {
        this.customServerUrl = config.serverUrl;
        this.customServerApiKey = config.apiKey;
        
        console.log('✅ Custom server connected');
        return { success: true, message: 'Custom server connected' };
      }
    } catch (error) {
      console.error('Custom server init failed:', error);
      throw error;
    }
  }

  /**
   * Create backup archive
   */
  async createBackup(dbPath, uploadsPath) {
    const backupPath = path.join(path.dirname(dbPath), `backup-${Date.now()}.zip`);
    
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`Backup created: ${archive.pointer()} bytes`);
        resolve(backupPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add database file
      archive.file(dbPath, { name: 'consultancy.db' });

      // Add uploads directory
      if (uploadsPath) {
        archive.directory(uploadsPath, 'uploads');
      }

      archive.finalize();
    });
  }

  /**
   * Upload backup to cloud
   */
  async uploadBackup(backupPath) {
    switch (this.provider) {
      case 'google':
        return this.uploadToGoogleDrive(backupPath);
      case 'dropbox':
        return this.uploadToDropbox(backupPath);
      case 'custom':
        return this.uploadToCustomServer(backupPath);
      default:
        throw new Error('No cloud provider configured');
    }
  }

  /**
   * Upload to Google Drive
   */
  async uploadToGoogleDrive(backupPath) {
    try {
      const fileName = path.basename(backupPath);
      const fileMetadata = {
        name: fileName,
        parents: this.config.folderId ? [this.config.folderId] : []
      };

      const media = {
        mimeType: 'application/zip',
        body: require('fs').createReadStream(backupPath)
      };

      const response = await this.driveClient.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, createdTime'
      });

      this.lastSyncTime = new Date().toISOString();

      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        size: response.data.size,
        uploadedAt: response.data.createdTime
      };
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload to Dropbox
   */
  async uploadToDropbox(backupPath) {
    try {
      const fileContent = await fs.readFile(backupPath);
      const fileName = path.basename(backupPath);

      const response = await this.dropboxClient.filesUpload({
        path: `/consultancy-backups/${fileName}`,
        contents: fileContent,
        mode: 'add',
        autorename: true
      });

      this.lastSyncTime = new Date().toISOString();

      return {
        success: true,
        fileId: response.result.id,
        fileName: response.result.name,
        size: response.result.size,
        uploadedAt: response.result.server_modified
      };
    } catch (error) {
      console.error('Dropbox upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload to Custom Server
   */
  async uploadToCustomServer(backupPath) {
    try {
      const fileContent = await fs.readFile(backupPath);
      const fileName = path.basename(backupPath);

      const formData = new FormData();
      formData.append('file', new Blob([fileContent]), fileName);

      const response = await axios.post(
        `${this.customServerUrl}/api/backup/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.customServerApiKey}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      this.lastSyncTime = new Date().toISOString();

      return {
        success: true,
        fileId: response.data.fileId,
        fileName: fileName,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Custom server upload failed:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    switch (this.provider) {
      case 'google':
        return this.listGoogleDriveBackups();
      case 'dropbox':
        return this.listDropboxBackups();
      case 'custom':
        return this.listCustomServerBackups();
      default:
        throw new Error('No cloud provider configured');
    }
  }

  /**
   * List Google Drive backups
   */
  async listGoogleDriveBackups() {
    try {
      const response = await this.driveClient.files.list({
        q: "mimeType='application/zip' and trashed=false",
        fields: 'files(id, name, size, createdTime, modifiedTime)',
        orderBy: 'createdTime desc',
        pageSize: 20
      });

      return {
        success: true,
        backups: response.data.files
      };
    } catch (error) {
      console.error('Failed to list Google Drive backups:', error);
      throw error;
    }
  }

  /**
   * Download backup from cloud
   */
  async downloadBackup(fileId, destinationPath) {
    switch (this.provider) {
      case 'google':
        return this.downloadFromGoogleDrive(fileId, destinationPath);
      case 'dropbox':
        return this.downloadFromDropbox(fileId, destinationPath);
      case 'custom':
        return this.downloadFromCustomServer(fileId, destinationPath);
      default:
        throw new Error('No cloud provider configured');
    }
  }

  /**
   * Download from Google Drive
   */
  async downloadFromGoogleDrive(fileId, destinationPath) {
    try {
      const response = await this.driveClient.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      const dest = require('fs').createWriteStream(destinationPath);

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            console.log('Download complete');
            resolve(destinationPath);
          })
          .on('error', (err) => {
            console.error('Download error:', err);
            reject(err);
          })
          .pipe(dest);
      });
    } catch (error) {
      console.error('Google Drive download failed:', error);
      throw error;
    }
  }

  /**
   * Restore backup
   */
  async restoreBackup(backupPath, dbPath, uploadsPath) {
    try {
      // Extract backup
      const extractPath = path.join(path.dirname(backupPath), 'temp-restore');
      await extractZip(backupPath, { dir: extractPath });

      // Restore database
      const backupDbPath = path.join(extractPath, 'consultancy.db');
      if (await this.fileExists(backupDbPath)) {
        await fs.copyFile(backupDbPath, dbPath);
      }

      // Restore uploads
      const backupUploadsPath = path.join(extractPath, 'uploads');
      if (await this.fileExists(backupUploadsPath)) {
        await this.copyDirectory(backupUploadsPath, uploadsPath);
      }

      // Cleanup
      await fs.rm(extractPath, { recursive: true, force: true });

      return { success: true, message: 'Backup restored successfully' };
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Auto-sync backup
   */
  async autoSync(dbPath, uploadsPath, schedule = 'daily') {
    try {
      // Create backup
      const backupPath = await this.createBackup(dbPath, uploadsPath);

      // Upload to cloud
      const uploadResult = await this.uploadBackup(backupPath);

      // Cleanup local backup
      await fs.unlink(backupPath);

      return {
        success: true,
        message: 'Auto-sync completed',
        uploadResult
      };
    } catch (error) {
      console.error('Auto-sync failed:', error);
      throw error;
    }
  }

  /**
   * Helper: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Copy directory recursively
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      provider: this.provider,
      lastSyncTime: this.lastSyncTime,
      isConfigured: !!this.provider
    };
  }
}

// Singleton instance
const cloudSync = new CloudSync();

module.exports = { cloudSync, CloudSync };
