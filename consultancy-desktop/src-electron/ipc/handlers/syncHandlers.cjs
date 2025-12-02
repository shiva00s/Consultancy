const { ipcMain } = require('electron');
const { cloudSync } = require('../utils/cloudSync.cjs');
const { getDatabasePath } = require('../db/database.cjs');
const { fileManager } = require('../utils/fileManager.cjs');
const fs = require('fs').promises;
const path = require('path');

function registerSyncHandlers() {
  /**
   * Initialize cloud sync
   */
  ipcMain.handle('init-cloud-sync', async (event, provider, config) => {
    try {
      const result = await cloudSync.initialize(provider, config);
      console.log(`✅ Cloud sync initialized: ${provider}`);
      return result;
    } catch (error) {
      console.error('Failed to initialize cloud sync:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Create and upload backup
   */
  ipcMain.handle('create-backup', async (event) => {
    try {
      const dbPath = getDatabasePath();
      const uploadsPath = fileManager.getUploadsPath();

      console.log('Creating backup...');
      console.log('DB Path:', dbPath);
      console.log('Uploads Path:', uploadsPath);

      // Create backup archive
      const backupPath = await cloudSync.createBackup(dbPath, uploadsPath);
      console.log('Backup created:', backupPath);

      // Upload to cloud
      const uploadResult = await cloudSync.uploadBackup(backupPath);
      console.log('Backup uploaded:', uploadResult);

      // Cleanup local backup file
      await fs.unlink(backupPath);
      console.log('Local backup cleaned up');

      return {
        success: true,
        message: 'Backup created and uploaded successfully',
        ...uploadResult
      };
    } catch (error) {
      console.error('Backup failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Create local backup only (no cloud upload)
   */
  ipcMain.handle('create-local-backup', async (event, destinationPath) => {
    try {
      const dbPath = getDatabasePath();
      const uploadsPath = fileManager.getUploadsPath();

      const backupPath = await cloudSync.createBackup(dbPath, uploadsPath);

      // Move to destination
      if (destinationPath) {
        await fs.copyFile(backupPath, destinationPath);
        await fs.unlink(backupPath);
        
        return {
          success: true,
          message: 'Local backup created successfully',
          path: destinationPath
        };
      }

      return {
        success: true,
        message: 'Backup created successfully',
        path: backupPath
      };
    } catch (error) {
      console.error('Local backup failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * List available backups from cloud
   */
  ipcMain.handle('list-backups', async (event) => {
    try {
      const result = await cloudSync.listBackups();
      return result;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Download and restore backup
   */
  ipcMain.handle('restore-backup', async (event, fileId) => {
    try {
      const dbPath = getDatabasePath();
      const uploadsPath = fileManager.getUploadsPath();
      
      const tempBackupPath = path.join(path.dirname(dbPath), `temp-backup-${Date.now()}.zip`);

      console.log('Downloading backup...');
      
      // Download backup from cloud
      await cloudSync.downloadBackup(fileId, tempBackupPath);
      console.log('Backup downloaded:', tempBackupPath);

      // Close database connection before restore
      const { closeDatabase } = require('../db/database.cjs');
      closeDatabase();

      // Restore backup
      const result = await cloudSync.restoreBackup(tempBackupPath, dbPath, uploadsPath);
      console.log('Backup restored:', result);

      // Cleanup temporary backup file
      try {
        await fs.unlink(tempBackupPath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp backup:', cleanupError);
      }

      return {
        ...result,
        message: 'Backup restored successfully! Please restart the application.'
      };
    } catch (error) {
      console.error('Restore failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Restore from local backup file
   */
  ipcMain.handle('restore-local-backup', async (event, backupPath) => {
    try {
      const dbPath = getDatabasePath();
      const uploadsPath = fileManager.getUploadsPath();

      // Close database connection
      const { closeDatabase } = require('../db/database.cjs');
      closeDatabase();

      // Restore
      const result = await cloudSync.restoreBackup(backupPath, dbPath, uploadsPath);

      return {
        ...result,
        message: 'Backup restored successfully! Please restart the application.'
      };
    } catch (error) {
      console.error('Local restore failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Enable auto-sync
   */
  ipcMain.handle('enable-auto-sync', async (event, schedule) => {
    try {
      const dbPath = getDatabasePath();
      const uploadsPath = fileManager.getUploadsPath();

      // Clear existing interval if any
      if (global.autoSyncInterval) {
        clearInterval(global.autoSyncInterval);
      }

      // Setup auto-sync interval
      const intervals = {
        'hourly': 60 * 60 * 1000,        // 1 hour
        'daily': 24 * 60 * 60 * 1000,    // 24 hours
        'weekly': 7 * 24 * 60 * 60 * 1000 // 7 days
      };

      const interval = intervals[schedule] || intervals['daily'];

      global.autoSyncInterval = setInterval(async () => {
        try {
          console.log(`🔄 Auto-sync starting (${schedule})...`);
          await cloudSync.autoSync(dbPath, uploadsPath, schedule);
          console.log('✅ Auto-sync completed');
        } catch (error) {
          console.error('❌ Auto-sync failed:', error);
        }
      }, interval);

      // Run first sync immediately
      console.log('Running initial sync...');
      await cloudSync.autoSync(dbPath, uploadsPath, schedule);

      return {
        success: true,
        message: `Auto-sync enabled (${schedule})`,
        interval: interval
      };
    } catch (error) {
      console.error('Failed to enable auto-sync:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Disable auto-sync
   */
  ipcMain.handle('disable-auto-sync', async (event) => {
    try {
      if (global.autoSyncInterval) {
        clearInterval(global.autoSyncInterval);
        global.autoSyncInterval = null;
        console.log('✅ Auto-sync disabled');
      }

      return {
        success: true,
        message: 'Auto-sync disabled'
      };
    } catch (error) {
      console.error('Failed to disable auto-sync:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get sync status
   */
  ipcMain.handle('get-sync-status', async (event) => {
    try {
      const status = cloudSync.getSyncStatus();
      
      return {
        success: true,
        ...status,
        autoSyncEnabled: !!global.autoSyncInterval
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        success: false,
        error: error.message,
        isConfigured: false,
        autoSyncEnabled: false
      };
    }
  });

  /**
   * Test cloud connection
   */
  ipcMain.handle('test-cloud-connection', async (event, provider, config) => {
    try {
      // Create temporary instance to test
      const { CloudSync } = require('../utils/cloudSync.cjs');
      const testSync = new CloudSync();
      
      const result = await testSync.initialize(provider, config);
      
      return {
        success: true,
        message: 'Connection successful',
        provider
      };
    } catch (error) {
      console.error('Cloud connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete backup from cloud
   */
  ipcMain.handle('delete-backup', async (event, fileId) => {
    try {
      const result = await cloudSync.deleteBackup(fileId);
      return result;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get backup details
   */
  ipcMain.handle('get-backup-details', async (event, fileId) => {
    try {
      const details = await cloudSync.getBackupDetails(fileId);
      return { success: true, details };
    } catch (error) {
      console.error('Failed to get backup details:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Export database only (no files)
   */
  ipcMain.handle('export-database', async (event, destinationPath) => {
    try {
      const dbPath = getDatabasePath();
      
      await fs.copyFile(dbPath, destinationPath);
      
      return {
        success: true,
        message: 'Database exported successfully',
        path: destinationPath
      };
    } catch (error) {
      console.error('Database export failed:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Import database only
   */
  ipcMain.handle('import-database', async (event, sourcePath) => {
    try {
      const dbPath = getDatabasePath();
      
      // Close database connection
      const { closeDatabase } = require('../db/database.cjs');
      closeDatabase();
      
      // Backup current database
      const backupPath = `${dbPath}.backup-${Date.now()}`;
      await fs.copyFile(dbPath, backupPath);
      
      // Import new database
      await fs.copyFile(sourcePath, dbPath);
      
      return {
        success: true,
        message: 'Database imported successfully! Please restart the application.',
        backupPath
      };
    } catch (error) {
      console.error('Database import failed:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Cloud Sync handlers registered');
}

module.exports = { registerSyncHandlers };
