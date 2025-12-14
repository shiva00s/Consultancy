// src-electron/ipc/modules/auditHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerAuditHandlers(app) {
    console.log('📜 Registering Audit Handlers...');

    const db = getDatabase();

    ipcMain.handle('log-audit-event', async (event, payload) => {
    try {
        const userId = payload.userId || payload.user?.id;
        const username = payload.username || payload.user?.username || 'Unknown';
        const action = payload.action;
        const candidateId = payload.candidateId;
        
        const targetType = payload.target_type || 
                          payload.table || 
                          (candidateId ? 'candidates' : 'system');
        
        const targetId = payload.target_id || 
                        payload.rowId || 
                        candidateId || 
                        null;
        
        const details = payload.details || 
                       payload.description || 
                       null;

        if (!userId) {
            return { success: false, error: 'User ID required' };
        }

        if (!action) {
            return { success: false, error: 'Action required' };
        }

        return await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO audit_log (user_id, username, action, target_type, target_id, details, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [userId, username, action, targetType, targetId, details],
                (err) => {
                    if (err) {
                        console.error("Audit Log insert error:", err);
                        return resolve({ success: false, error: err.message });
                    }
                    console.log(`✅ Audit logged: ${action} by user ${userId}`);
                    resolve({ success: true });
                }
            );
        });
    } catch (error) {
        console.error('Audit Log handler error:', error);
        return { success: false, error: error.message };
    }
});


    ipcMain.handle("get-system-audit-log", async (event, { user, userFilter, actionFilter, limit, offset }) => {
        try {
            if (!user) {
                return { 
                    success: false, 
                    error: "Authentication required. Please log in again." 
                };
            }
            
            const normalizedRole = user.role?.toLowerCase().replace(/_/g, '');
            
            if (!['admin', 'superadmin'].includes(normalizedRole)) {
                return {
                    success: false,
                    error: `Access Denied: Only admins can access audit logs. Your role: ${user.role}`
                };
            }
            
            return await queries.getSystemAuditLog({
                userFilter: userFilter || '',
                actionFilter: actionFilter || '',
                limit: limit || 30,
                offset: offset || 0
            });
            
        } catch (error) {
            console.error('Audit log handler error:', error);
            return {
                success: false,
                error: error.message || "Failed to fetch audit logs"
            };
        }
    });

    console.log('✅ Audit Handlers Registered');
}

module.exports = { registerAuditHandlers };
