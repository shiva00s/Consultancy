// src-electron/utils/rbacHelpers.cjs
const { getDatabase } = require('../db/database.cjs');

// Load granular permissions for a user from DB
async function getUserGranularPermissions(userId) {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT permission_key, enabled 
       FROM user_granular_permissions 
       WHERE user_id = ?`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        const map = {};
        rows.forEach(r => {
          map[r.permission_key] = r.enabled === 1;
        });
        resolve(map);
      }
    );
  });
}

// Check if a user has a given granular permission
async function hasPermission(user, permissionKey) {
  if (!user) return false;

  // SuperAdmin bypasses all checks
  if (user.role === 'super_admin') return true;

  // Admin or Staff: check granular table
  const granular = await getUserGranularPermissions(user.id);
  return granular[permissionKey] === true;
}

/**
 * Helper for handlers:
 * - If unauthorized, returns { success:false, error:'...' }
 * - If authorized, returns null (so handler continues).
 */
async function enforcePermissionOrDeny(user, permissionKey, actionLabel = '') {
  const allowed = await hasPermission(user, permissionKey);
  if (!allowed) {
    return {
      success: false,
      error: `Access denied${actionLabel ? `: ${actionLabel}` : ''}`,
      code: 'PERMISSION_DENIED'
    };
  }
  return null;
}

module.exports = {
  getUserGranularPermissions,
  hasPermission,
  enforcePermissionOrDeny,
};
