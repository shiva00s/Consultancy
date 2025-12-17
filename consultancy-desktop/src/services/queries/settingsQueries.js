// src/services/queries/settingsQueries.js
// ⚙️ Granular Settings Permissions for SettingsPage.jsx
// getUserGranularPermissions → 6 tab permissions

const getDatabase = require('../database.cjs');
const { dbGet } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const { getSuperAdminFeatureFlags } = require('./authQueries.cjs');

/**
 * Get user granular permissions (SettingsPage.jsx → getUserGranularPermissions)
 * SuperAdmin: All tabs enabled
 * Admin/Staff: Delegated flags from userpermissions table
 */
async function getUserGranularPermissions({ userId }) {
  if (!userId) {
    return {
      success: false,
      error: mapErrorToFriendly('User ID is required.')
    };
  }

  const db = getDatabase();

  try {
    // SuperAdmin gets everything
    const userRow = await dbGet(db, `
      SELECT role FROM users WHERE id = ?
    `, [userId]);

    if (!userRow) {
      return {
        success: false,
        error: mapErrorToFriendly('User not found.')
      };
    }

    if (userRow.role === 'superadmin') {
      return {
        success: true,
        data: {
          settingsusers: true,
          settingsrequireddocs: true,
          settingsemail: true,
          settingstemplates: true,
          settingsmobileapp: true,
          settingsbackup: true
        }
      };
    }

    // Admin/Staff get delegated permissions
    const row = await dbGet(db, `
      SELECT flags FROM userpermissions WHERE userid = ?
    `, [userId]);

    const flags = row && row.flags ? JSON.parse(row.flags) : {};

    // Default empty flags if none exist
    const permissions = {
      settingsusers: flags.settingsusers || false,
      settingsrequireddocs: flags.settingsrequireddocs || false,
      settingsemail: flags.settingsemail || false,
      settingstemplates: flags.settingstemplates || false,
      settingsmobileapp: flags.settingsmobileapp || false,
      settingsbackup: flags.settingsbackup || false
    };

    return {
      success: true,
      data: permissions
    };
  } catch (err) {
    console.error('getUserGranularPermissions DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to retrieve user permissions.')
    };
  }
}

/**
 * Save granular permissions (Admin panel → delegate settings access)
 */
async function saveUserGranularPermissions(userId, permissions) {
  const db = getDatabase();

  try {
    const flagsJson = JSON.stringify(permissions);
    const sql = `
      INSERT OR REPLACE INTO userpermissions (userid, flags) 
      VALUES (?, ?)
    `;
    
    await dbRun(db, sql, [userId, flagsJson]);
    
    return { success: true };
  } catch (err) {
    console.error('saveUserGranularPermissions DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to save user permissions.')
    };
  }
}

/**
 * Check settings access (SettingsPage.jsx permission gating)
 */
async function checkSettingsAccess(user, featureKey) {
  if (!user || !user.role) {
    return {
      success: false,
      error: mapErrorToFriendly('Access Denied: Invalid user role.')
    };
  }

  // SuperAdmin bypass
  if (user.role === 'superadmin') {
    return { success: true };
  }

  // Check delegated access via existing auth system
  const accessCheck = await checkAdminFeatureAccess(user, 'canAccessSettings');
  if (!accessCheck.success) {
    return {
      success: false,
      error: mapErrorToFriendly(accessCheck.error)
    };
  }

  return { success: true };
}

// 🔒 EXPORTS - Exact IPC handler names from SettingsPage.jsx
module.exports = {
  getUserGranularPermissions,
  saveUserGranularPermissions,
  checkSettingsAccess
};
