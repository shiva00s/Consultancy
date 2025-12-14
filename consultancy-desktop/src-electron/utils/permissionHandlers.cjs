// FILE: src-electron/ipc/permissionHandlers.cjs
// REPLACE ENTIRE FILE

const { ipcMain } = require('electron');
const { getDatabase } = require('../db/database.cjs');
const permissionService = require('../services/permissionService.cjs');

function registerPermissionHandlers() {
    const db = getDatabase();

    // ==========================================
    // GET USER GRANULAR PERMISSIONS
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
                        if (err) reject(err);
                        else {
                            const permMap = {};
                            rows.forEach(row => {
                                permMap[row.permission_key] = row.enabled === 1;
                            });
                            resolve(permMap);
                        }
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
    // SET USER GRANULAR PERMISSIONS (Admin/Super Admin only)
    // ==========================================
    ipcMain.handle('set-user-granular-permissions', async (event, { granterId, targetUserId, permissions }) => {
        try {
            // Verify granter has permission to grant
            const granter = await new Promise((resolve, reject) => {
                db.get('SELECT role FROM users WHERE id = ?', [granterId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!granter || (granter.role !== 'admin' && granter.role !== 'super_admin')) {
                return { success: false, error: 'Unauthorized: Only Admin or Super Admin can grant permissions' };
            }

            // Verify target user exists and is not super_admin
            const targetUser = await new Promise((resolve, reject) => {
                db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!targetUser) {
                return { success: false, error: 'Target user not found' };
            }

            if (targetUser.role === 'super_admin') {
                return { success: false, error: 'Cannot modify Super Admin permissions' };
            }

            // If granter is Admin, they can only grant to Staff
            if (granter.role === 'admin' && targetUser.role !== 'staff') {
                return { success: false, error: 'Admins can only grant permissions to Staff users' };
            }

            // Delete existing permissions for this user
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM user_granular_permissions WHERE user_id = ?', [targetUserId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Insert new permissions
            const stmt = db.prepare(`
                INSERT INTO user_granular_permissions (user_id, permission_key, enabled, granted_by)
                VALUES (?, ?, ?, ?)
            `);

            for (const [permKey, enabled] of Object.entries(permissions)) {
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
    // GET GRANTER'S OWN PERMISSIONS (For Admin)
    // ==========================================
    ipcMain.handle('get-granter-permissions', async (event, { granterId }) => {
        try {
            const granter = await new Promise((resolve, reject) => {
                db.get('SELECT role FROM users WHERE id = ?', [granterId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!granter) {
                return { success: false, error: 'Granter not found' };
            }

            // Super Admin has all permissions
            if (granter.role === 'super_admin') {
                return { success: true, data: null, isSuperAdmin: true };
            }

            // Get Admin's permissions granted by Super Admin
            const permissions = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT permission_key, enabled 
                     FROM user_granular_permissions 
                     WHERE user_id = ?`,
                    [granterId],
                    (err, rows) => {
                        if (err) reject(err);
                        else {
                            const permMap = {};
                            rows.forEach(row => {
                                permMap[row.permission_key] = row.enabled === 1;
                            });
                            resolve(permMap);
                        }
                    }
                );
            });

            return { success: true, data: permissions, isSuperAdmin: false };
        } catch (error) {
            console.error('Error fetching granter permissions:', error);
            return { success: false, error: error.message };
        }
    });

    // ==========================================
    // LOG AUDIT EVENT (FIXED - Now inside registerPermissionHandlers)
    // ==========================================
    ipcMain.handle('log-audit-event', async (event, payload) => {
        try {
            const { userId, action, candidateId, details } = payload || {};

            // Validate required fields
            if (!userId) {
                console.warn(`Audit Log: User ID missing. Skipping log for action: ${action}`);
                return { success: false, error: 'User ID required' };
            }

            if (!action) {
                console.warn('Audit Log: Action missing. Skipping log entry.');
                return { success: false, error: 'Action required' };
            }

            // Insert audit log entry
            return await new Promise((resolve) => {
                db.run(
                    `INSERT INTO audit_log (user_id, action, candidate_id, details, timestamp)
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [userId, action, candidateId || null, details || null],
                    (err) => {
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

    // ==========================================
    // GET AUDIT LOGS (For viewing in SystemAuditLogPage)
    // ==========================================
    ipcMain.handle('get-audit-logs', async (event, { limit = 100, offset = 0, userId = null }) => {
        try {
            let query = `
                SELECT 
                    al.*,
                    u.username as user_name,
                    u.role as user_role
                FROM audit_log al
                LEFT JOIN users u ON al.user_id = u.id
            `;
            
            const params = [];
            
            // Optional: Filter by specific user
            if (userId) {
                query += ' WHERE al.user_id = ?';
                params.push(userId);
            }
            
            query += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const logs = await new Promise((resolve, reject) => {
                db.all(query, params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // Get total count
            let countQuery = 'SELECT COUNT(*) as total FROM audit_log';
            if (userId) {
                countQuery += ' WHERE user_id = ?';
            }

            const countResult = await new Promise((resolve, reject) => {
                db.get(
                    countQuery, 
                    userId ? [userId] : [], 
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            return {
                success: true,
                data: logs,
                total: countResult?.total || 0
            };
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('✅ Permission handlers registered');
}

module.exports = { registerPermissionHandlers };
