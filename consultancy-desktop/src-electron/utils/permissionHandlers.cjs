const { ipcMain } = require('electron');
const { getDatabase } = require('../db/database.cjs');
const permissionService = require('../services/permissionService.cjs');

function registerPermissionHandlers() {
  const db = getDatabase();

  // ==============================
  // EFFECTIVE PERMISSIONS (RBAC)
  // ==============================
  ipcMain.handle('get-effective-permissions', async (event, { userId, userRole }) => {
    try {
      const modules = await permissionService.getEffectivePermissions(userId, userRole);
      // modules should be an array of module objects { module_key, module_type, route, is_enabled, ... }
      return { success: true, data: modules };
    } catch (e) {
      console.error('get-effective-permissions failed', e);
      return { success: false, error: e.message };
    }
  });

  // ==========================================
  // USER GRANULAR PERMISSIONS (per-flag)
  // ==========================================
  ipcMain.handle('get-user-granular-permissions', async (event, { userId }) => {
    try {
      const permissions = await new Promise((resolve, reject) => {
        db.all(
          `SELECT permission_key, enabled
           FROM user_granular_permissions
           WHERE user_id = ?`,
          [userId],
          (err, rows) => {
            if (err) return reject(err);
            const permMap = {};
            rows.forEach(row => {
              permMap[row.permission_key] = row.enabled === 1;
            });
            resolve(permMap);
          }
        );
      });

      return { success: true, data: permissions };
    } catch (error) {
      console.error('Error fetching granular permissions:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // SET USER GRANULAR PERMISSIONS
  // Super Admin -> Admin/Staff
  // Admin -> Staff only
  // ==========================================
  ipcMain.handle('set-user-granular-permissions', async (event, { granterId, targetUserId, permissions }) => {
    try {
      const granter = await new Promise((resolve, reject) => {
        db.get('SELECT role FROM users WHERE id = ?', [granterId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      if (!granter || (granter.role !== 'admin' && granter.role !== 'super_admin')) {
        return { success: false, error: 'Unauthorized: Only Admin or Super Admin can grant permissions' };
      }

      const targetUser = await new Promise((resolve, reject) => {
        db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      if (!targetUser) {
        return { success: false, error: 'Target user not found' };
      }

      if (targetUser.role === 'super_admin') {
        return { success: false, error: 'Cannot modify Super Admin permissions' };
      }

      if (granter.role === 'admin' && targetUser.role !== 'staff') {
        return { success: false, error: 'Admins can only grant permissions to Staff users' };
      }

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM user_granular_permissions WHERE user_id = ?', [targetUserId], err => {
          if (err) return reject(err);
          resolve();
        });
      });

      const stmt = db.prepare(
        `INSERT INTO user_granular_permissions (user_id, permission_key, enabled, granted_by)
         VALUES (?, ?, ?, ?)`
      );

      for (const [permKey, enabled] of Object.entries(permissions || {})) {
        stmt.run(targetUserId, permKey, enabled ? 1 : 0, granterId);
      }

      stmt.finalize();

      return { success: true, message: 'Permissions updated successfully' };
    } catch (error) {
      console.error('Error setting granular permissions:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // GET GRANTER'S PERMISSIONS (for UI limits)
  // Super Admin -> all, Admin -> own map
  // ==========================================
  ipcMain.handle('get-granter-permissions', async (event, { granterId }) => {
    try {
      const granter = await new Promise((resolve, reject) => {
        db.get('SELECT role FROM users WHERE id = ?', [granterId], (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

      if (!granter) {
        return { success: false, error: 'Granter not found' };
      }

      // Super Admin can see/assign everything
      if (granter.role === 'super_admin') {
        return { success: true, data: null, isSuperAdmin: true };
      }

      // Admin: permissions previously granted by Super Admin
      const permissions = await new Promise((resolve, reject) => {
        db.all(
          `SELECT permission_key, enabled
           FROM user_granular_permissions
           WHERE user_id = ?`,
          [granterId],
          (err, rows) => {
            if (err) return reject(err);
            const permMap = {};
            rows.forEach(row => {
              permMap[row.permission_key] = row.enabled === 1;
            });
            resolve(permMap);
          }
        );
      });

      return { success: true, data: permissions, isSuperAdmin: false };
    } catch (error) {
      console.error('Error fetching granter permissions:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Permission handlers registered');

  // ==============================
  // AUDIT LOG EVENTS
  // ==============================
  ipcMain.handle('log-audit-event', async (event, payload) => {
    const db = getDatabase();
    try {
      const { userId, action, candidateId, details } = payload || {};

      if (!userId) {
        console.warn(`Audit Log: User ID missing. Skipping log for action: ${action}`);
        return { success: false, error: 'User ID required' };
      }

      if (!action) {
        console.warn('Audit Log: Action missing. Skipping log entry.');
        return { success: false, error: 'Action required' };
      }

      return await new Promise(resolve => {
        // NOTE: table name aligned with schema: audit_log
        db.run(
          `INSERT INTO audit_log (user_id, action, target_type, target_id, details, timestamp)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [userId, action, 'candidate', candidateId || null, details || null],
          err => {
            if (err) {
              console.error('Audit Log insert error:', err);
              return resolve({ success: false, error: 'Failed to write audit log' });
            }
            resolve({ success: true });
          }
        );
      });
    } catch (error) {
      console.error('Audit Log handler error:', error);
      return { success: false, error: error.message };
    }
  });

  // ==============================
  // ADMIN ASSIGNED FEATURES
  // Super Admin -> Admin
  // ==============================
  ipcMain.handle('get-admin-assigned-features', async (event, { userId }) => {
    try {
      // returns { [featureKey]: boolean } that Super Admin has assigned to this admin
      const flags = await permissionService.getAdminAssignedFeatures(userId);
      return { success: true, data: flags || {} };
    } catch (error) {
      console.error('get-admin-assigned-features error:', error);
      return { success: false, error: error.message };
    }
  });

  // ==============================
  // ADMIN EFFECTIVE FLAGS
  // (global flags ∩ assigned features)
  // ==============================
  ipcMain.handle('get-admin-effective-flags', async (event, { userId, role }) => {
    try {
      const modules = await permissionService.getEffectivePermissions(userId, role);
      // convert modules array -> flat { [module_key]: boolean } map
      const flags = {};
      (modules || []).forEach(m => {
        flags[m.module_key] = m.is_enabled !== 0 && m.is_enabled !== false;
      });
      return { success: true, data: flags };
    } catch (error) {
      console.error('get-admin-effective-flags error:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerPermissionHandlers };
