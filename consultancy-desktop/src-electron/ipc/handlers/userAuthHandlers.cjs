const { BrowserWindow } = require('electron');

const registerUserAuthHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-user-permissions', (event, { userId }) => {
        return queries.getUserPermissions(userId);
    });

    ipcMain.handle('save-user-permissions', async (event, { user, userId, flags }) => {
        const result = await queries.saveUserPermissions(userId, flags);
        if (result.success) {
            logAction(user, 'update_user_permissions', 'users', userId, `Updated flags for user ID: ${userId}`);
        }
        return result;
    });

    ipcMain.handle('get-admin-assigned-features', (event, { adminId }) => {
        return queries.getAdminAssignedFeaturesDb(adminId);
    });

    ipcMain.handle('set-admin-feature-assignment', async (event, { user, adminId, featureKey, enabled }) => {
        if (!user || user.role !== 'super_admin') {
          return { success: false, error: 'Access Denied: Only Super Admin can modify admin feature assignments.' };
        }
        const result = await queries.setAdminFeatureAssignmentDb(adminId, featureKey, enabled);
        if (result.success) {
          logAction(user, 'update_admin_feature', 'users', adminId, `Admin ID: ${adminId}, Feature: ${featureKey}, Enabled: ${enabled}`);
        }
        return result;
    });

    ipcMain.handle('get-admin-effective-flags', (event, { adminId }) => {
        return queries.getAdminEffectiveFlagsDb(adminId);
    });

    ipcMain.handle('login', (event, { username, password }) => {
        return queries.login(username, password);
    });

    ipcMain.handle('register-new-user', (event, { username, password, role }) => {
        return queries.registerNewUser(username, password, role);
    });

    ipcMain.handle('get-all-users', (event) => {
        return queries.getAllUsers();
    });

    ipcMain.handle('add-user', async (event, { user, username, password, role }) => {
        const result = await queries.addUser(username, password, role);
        if (result.success) {
            logAction(user, 'create_user', 'users', result.data.id, `Username: ${username}, Role: ${role}`);
        }
        return result;
    });

    ipcMain.handle('reset-user-password', async (event, { user, id, newPassword }) => {
        const db = dependencies.getDatabase(); // Access getDatabase from dependencies
        
        if (user.role === 'staff') {
            return { success: false, error: 'Access Denied: Staff cannot reset passwords.' };
        }

        const targetUser = await queries.dbGet(db, 'SELECT role FROM users WHERE id = ?', [id]);
        
        if (!targetUser) return { success: false, error: 'User not found.' };

        if (user.role === 'admin') {
            if (targetUser.role === 'super_admin' || targetUser.role === 'admin') {
                return { success: false, error: 'Access Denied: Admins can only manage Staff accounts.' };
            }
        }

        const result = await queries.resetUserPassword(id, newPassword);
        if (result.success) {
            logAction(user, 'reset_password', 'users', id);
        }
        return result;
    });

    ipcMain.handle('change-my-password', async (event, { user, oldPassword, newPassword }) => {
        const result = await queries.changeMyPassword(user.id, oldPassword, newPassword);
        if (result.success) {
            logAction(user, 'change_password_self', 'users', user.id);
        }
        return result;
    });

    ipcMain.handle('delete-user', async (event, { user, idToDelete }) => {
        if (user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Only Super Admin can delete users.' };
        }

        if (user.id === idToDelete) {
             return { success: false, error: 'You cannot delete your own account.' };
        }

        const result = await queries.deleteUser(idToDelete, user.id);
        if (result.success) {
            logAction(user, 'delete_user', 'users', idToDelete, `Deleted user: ${result.deletedUsername}`);
        }
        return result;
    });

    ipcMain.handle('get-user-role', async (event, { userId }) => {
        const db = dependencies.getDatabase();
        try {
            const row = await queries.dbGet(db, 'SELECT role FROM users WHERE id = ?', [userId]);
            if (!row) return { success: false, error: 'User not found' };
            return { success: true, role: row.role };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
};

module.exports = { registerUserAuthHandlers };
