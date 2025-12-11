import { sanitizeFileName } from './sanitize';

class BackupManager {
  constructor() {
    this.isBackingUp = false;
    this.isRestoring = false;
  }

  /**
   * Create a full database backup
   */
  async createBackup(options = {}) {
    if (this.isBackingUp) {
      throw new Error('A backup operation is already in progress');
    }

    this.isBackingUp = true;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultName = `consultancy_backup_${timestamp}`;
      const backupName = options.name ? sanitizeFileName(options.name) : defaultName;

      const result = await window.electronAPI.createDatabaseBackup({
        backupName,
        includeDocuments: options.includeDocuments !== false, // Default true
        compress: options.compress !== false, // Default true
      });

      if (result.success) {
        return {
          success: true,
          backupPath: result.backupPath,
          backupSize: result.size,
          backupName,
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error(result.error || 'Backup failed');
      }
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(backupPath) {
    if (this.isRestoring) {
      throw new Error('A restore operation is already in progress');
    }

    if (!backupPath) {
      throw new Error('Backup path is required');
    }

    this.isRestoring = true;

    try {
      const result = await window.electronAPI.restoreDatabaseBackup({
        backupPath,
      });

      if (result.success) {
        return {
          success: true,
          message: 'Database restored successfully. Please restart the application.',
          recordsRestored: result.recordsRestored,
        };
      } else {
        throw new Error(result.error || 'Restore failed');
      }
    } finally {
      this.isRestoring = false;
    }
  }

  /**
   * List all available backups
   */
  async listBackups() {
    try {
      const result = await window.electronAPI.listDatabaseBackups();
      
      if (result.success) {
        return result.backups.map(backup => ({
          name: backup.name,
          path: backup.path,
          size: backup.size,
          created: new Date(backup.created),
          sizeFormatted: this.formatBytes(backup.size),
        }));
      } else {
        throw new Error(result.error || 'Failed to list backups');
      }
    } catch (error) {
      console.error('Error listing backups:', error);
      throw error;
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(backupPath) {
    try {
      const result = await window.electronAPI.deleteDatabaseBackup({
        backupPath,
      });

      if (result.success) {
        return { success: true, message: 'Backup deleted successfully' };
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic backup
   */
  async scheduleAutoBackup(intervalHours = 24) {
    try {
      const result = await window.electronAPI.scheduleAutoBackup({
        intervalHours,
        enabled: true,
      });

      return result;
    } catch (error) {
      console.error('Error scheduling auto backup:', error);
      throw error;
    }
  }

  /**
   * Export data to CSV/Excel
   */
  async exportData(options = {}) {
    try {
      const result = await window.electronAPI.exportData({
        format: options.format || 'csv', // csv, excel
        tables: options.tables || ['candidates', 'employers', 'jobs'],
        includeArchived: options.includeArchived || false,
      });

      if (result.success) {
        return {
          success: true,
          exportPath: result.exportPath,
          recordCount: result.recordCount,
        };
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath) {
    try {
      const result = await window.electronAPI.verifyBackupIntegrity({
        backupPath,
      });

      return result;
    } catch (error) {
      console.error('Error verifying backup:', error);
      throw error;
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

export const backupManager = new BackupManager();
// Phone number: E.164 format
// Optional, can be empty string