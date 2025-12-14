// src-electron/ipc/modules/authHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { guard, FEATURES } = require('../security/ipcPermissionGuard.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerAuthHandlers(app) {
    console.log('🔐 Registering Auth Handlers...');

    // ====================================================================
    // LOGIN & REGISTRATION
    // ====================================================================
    
    ipcMain.handle('login', async (event, { username, password }) => {
    try {
        const user = await db.get(
            'SELECT id, username, password, role FROM users WHERE username = ? AND deleted = 0',
            [username]
        );

        if (!user) {
            return { success: false, error: 'Invalid username or password' };
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return { success: false, error: 'Invalid username or password' };
        }

        // Fetch user permissions
        let permissions = {};
        try {
            const permResult = await db.get(
                'SELECT permissions FROM user_permissions WHERE user_id = ?',
                [user.id]
            );
            if (permResult && permResult.permissions) {
                permissions = JSON.parse(permResult.permissions);
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
        }

        // Get admin ID if user is staff
        let adminId = null;
        if (user.role === 'staff') {
            try {
                const adminResult = await db.get(
                    'SELECT admin_id FROM staff_admin_mapping WHERE staff_id = ?',
                    [user.id]
                );
                adminId = adminResult?.admin_id || null;
            } catch (err) {
                console.error('Failed to fetch admin ID:', err);
            }
        }

        // Log audit
        await db.run(
            'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)',
            [user.id, 'LOGIN', `User ${username} logged in`]
        );

        return {
            success: true,
            id: user.id,
            username: user.username,
            role: user.role,
            permissions: permissions,
            adminId: adminId,
        };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
});


    // ====================================================================
    // USER MANAGEMENT
    // ====================================================================
    
    ipcMain.handle('get-all-users', async (event) => {
        return queries.getAllUsers();
    });

    ipcMain.handle('add-user', async (event, { user, username, password, role }) => {
        try {
            guard(user).enforce(FEATURES.USERS);

            const result = await queries.addUser(username, password, role);

            if (result.success) {
                logAction(
                    user,
                    'create_user',
                    'users',
                    result.data.id,
                    `Username: ${username}, Role: ${role}`
                );
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('reset-user-password', async (event, { user, id, newPassword }) => {
        try {
            guard(user).enforce(FEATURES.USERS);

            const db = getDatabase();
            const targetUser = await queries.dbGet(
                db,
                'SELECT role FROM users WHERE id = ?',
                [id]
            );

            if (!targetUser) {
                return { success: false, error: 'User not found.' };
            }

            // Admin cannot reset Admin / SuperAdmin
            if (user.role === 'admin' && targetUser.role !== 'staff') {
                return { success: false, error: 'Admins can reset Staff only.' };
            }

            const result = await queries.resetUserPassword(id, newPassword);

            if (result.success) {
                logAction(user, 'reset_password', 'users', id);
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('change-my-password', async (event, { user, oldPassword, newPassword }) => {
        const result = await queries.changeMyPassword(user.id, oldPassword, newPassword);
        if (result.success) {
            logAction(user, 'change_password_self', 'users', user.id);
        }
        return result;
    });

    ipcMain.handle('delete-user', async (event, { user, idToDelete }) => {
        try {
            guard(user).enforce(FEATURES.USERS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Only Super Admin can delete users.' };
            }

            if (user.id === idToDelete) {
                return { success: false, error: 'You cannot delete your own account.' };
            }

            const result = await queries.deleteUser(idToDelete, user.id);

            if (result.success) {
                logAction(user, 'delete_user', 'users', idToDelete);
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    // ====================================================================
    // PERMISSIONS
    // ====================================================================
    
    ipcMain.handle('get-user-permissions', async (event, { userId }) => {
        return queries.getUserPermissions(userId);
    });

    ipcMain.handle('save-user-permissions', async (event, { user, userId, flags }) => {
        try {
            guard(user).enforce(FEATURES.USERS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Only Super Admin can modify permissions.' };
            }

            const result = await queries.saveUserPermissions(userId, flags);

            if (result.success) {
                logAction(
                    user,
                    'update_user_permissions',
                    'users',
                    userId,
                    `Permissions updated`
                );
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    // ====================================================================
    // FEATURE FLAGS
    // ====================================================================
    
    ipcMain.handle('get-feature-flags', async (event, { user } = {}) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Super Admin only.' };
            }

            const defaultFlags = {
                isEmployersEnabled: true,
                isJobsEnabled: true,
                isVisaKanbanEnabled: true,
                isDocumentsEnabled: true,
                isVisaTrackingEnabled: true,
                isFinanceTrackingEnabled: true,
                isMedicalEnabled: true,
                isInterviewEnabled: true,
                isTravelEnabled: true,
                isHistoryEnabled: true,
                isBulkImportEnabled: true,
                isMobileAccessEnabled: true,
                canViewReports: true,
                canAccessSettings: true,
                canAccessRecycleBin: true,
                canDeletePermanently: true,
            };

            const row = await queries.dbGet(
                getDatabase(),
                "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1",
                []
            );

            if (!row || !row.features) {
                return { success: true, data: defaultFlags };
            }

            const storedFlags = JSON.parse(row.features);
            return { success: true, data: { ...defaultFlags, ...storedFlags } };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('save-feature-flags', async (event, { user, flags }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Super Admin only.' };
            }

            const db = getDatabase();
            const featuresJson = JSON.stringify(flags);

            await queries.dbRun(
                db,
                "UPDATE users SET features = ? WHERE role = 'super_admin'",
                [featuresJson]
            );

            logAction(user, 'update_feature_flags', 'settings', 1, 'Feature flags updated');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    console.log('✅ Auth Handlers Registered');
}

module.exports = { registerAuthHandlers };
