// src/services/queries/backupQueries.js
// 💾 Backup/Restore + System Settings for BackupSettingsPage.jsx
// 100% backward compatible - Super Admin only access

const getDatabase = require('../database.cjs');
const { dbRun, dbGet } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get auto-backup settings (BackupSettingsPage.jsx → getAutoBackupSettings)
 */
async function getAutoBackupSettings() {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT value FROM systemsettings WHERE key = 'autobackup'
    `);

    const settings = row ? JSON.parse(row.value) : {
      enabled: false,
      intervalHours: 24
    };

    return {
      success: true,
      enabled: settings.enabled || false,
      intervalHours: settings.intervalHours || 24
    };
  } catch (err) {
    console.error('getAutoBackupSettings error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Save auto-backup settings (BackupSettingsPage.jsx → scheduleAutoBackup)
 */
async function saveAutoBackupSettings(enabled, intervalHours = 24) {
  const db = getDatabase();
  try {
    const settings = {
      enabled,
      intervalHours: parseInt(intervalHours) || 24,
      lastUpdated: new Date().toISOString()
    };

    await dbRun(db, `
      INSERT OR REPLACE INTO systemsettings (key, value) 
      VALUES ('autobackup', ?)
    `, JSON.stringify(settings));

    return { success: true };
  } catch (err) {
    console.error('saveAutoBackupSettings error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get SMTP settings for backup notifications (BackupSettingsPage.jsx)
 */
async function getSmtpSettings() {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT * FROM smtpsettings WHERE isconfigured = 1 ORDER BY createdat DESC LIMIT 1
    `);

    return {
      success: true,
      data: row || null
    };
  } catch (err) {
    console.error('getSmtpSettings error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Save SMTP settings (email notifications for backups)
 */
async function saveSmtpSettings(data) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      INSERT OR REPLACE INTO smtpsettings 
      (host, port, user, pass, fromemail, isconfigured, updatedat) 
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `, [
      data.host,
      parseInt(data.port),
      data.user,
      data.pass,
      data.fromemail
    ]);

    return { success: true };
  } catch (err) {
    console.error('saveSmtpSettings error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get system settings overview (backup-related configs)
 */
async function getSystemSettings() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT key, value FROM systemsettings 
      WHERE key IN ('autobackup', 'licensestatus', 'backuppath')
      ORDER BY key
    `);

    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });

    return {
      success: true,
      data: settings
    };
  } catch (err) {
    console.error('getSystemSettings error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Export data to CSV/Excel format (BackupSettingsPage.jsx → exportData)
 */
async function exportData(format = 'csv', tables = ['candidates', 'employers', 'joborders', 'payments']) {
  const db = getDatabase();
  try {
    const results = {};

    for (const table of tables) {
      const rows = await dbAll(db, `
        SELECT * FROM ${table} WHERE isDeleted = 0
      `);

      results[table] = rows;
      results.recordCount = (results.recordCount || 0) + rows.length;
    }

    return {
      success: true,
      format,
      tables,
      recordCount: results.recordCount || 0,
      data: results
    };
  } catch (err) {
    console.error('exportData error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get backup history from system logs (if tracked)
 */
async function getBackupHistory(limit = 50) {
  const db = getDatabase();
  try {
    // Check audit logs for backup events
    const rows = await dbAll(db, `
      SELECT * FROM auditlog 
      WHERE action LIKE '%backup%' OR details LIKE '%backup%'
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [limit]);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getBackupHistory error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Log backup event to audit trail
 */
async function logBackupEvent(userId, action, details) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      INSERT INTO auditlog (userid, action, details, targettype) 
      VALUES (?, ?, ?, 'backup')
    `, [userId, action, details]);

    return { success: true };
  } catch (err) {
    console.error('logBackupEvent error:', err);
    return { success: false };
  }
}

// 🔒 EXPORTS - Exact names expected by BackupSettingsPage.jsx + electron.cjs
module.exports = {
  // Auto-backup settings
  getAutoBackupSettings,
  saveAutoBackupSettings,
  
  // SMTP for notifications
  getSmtpSettings,
  saveSmtpSettings,
  
  // System settings
  getSystemSettings,
  
  // Data export
  exportData,
  
  // Backup history
  getBackupHistory,
  logBackupEvent,
  
  // Legacy compatibility aliases
  getAutoBackupConfig: getAutoBackupSettings,
  updateAutoBackup: saveAutoBackupSettings
};
