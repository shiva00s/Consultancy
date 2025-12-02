const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { getDatabase } = require("../db/database.cjs");
const { dbGet, dbRun } = require("../db/queries.cjs");

// Shared audit logger imported from main file
const { logAction } = require("../utils/auditHelper.cjs"); // you will receive this helper next

module.exports = function registerUserAuthHandlers() {

    const db = getDatabase();

    // -------------------
    // LOGIN / REGISTER
    // -------------------

    ipcMain.handle('login', (event, { username, password }) => {
        return queries.login(username, password);
    });

    ipcMain.handle('register-new-user', (event, { username, password, role }) => {
        return queries.registerNewUser(username, password, role);
    });

    ipcMain.handle('get-all-users', () => {
        return queries.getAllUsers();
    });

    ipcMain.handle('add-user', async (event, { user, username, password, role }) => {
        const result = await queries.addUser(username, password, role);
        if (result.success) {
            logAction(user, 'create_user', 'users', result.data.id, `Username: ${username}, Role: ${role}`);
        }
        return result;
    });

    // -------------------
    // PERMISSIONS
    // -------------------

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

    // -------------------
    // PASSWORD
    // -------------------

    ipcMain.handle('reset-user-password', async (event, { user, id, newPassword }) => {
        const db = getDatabase();
        const targetUser = await queries.dbGet(db, 'SELECT role FROM users WHERE id = ?', [id]);

        if (user.role === "staff") {
            return { success: false, error: 'Access Denied: Staff cannot reset passwords.' };
        }

        if (!targetUser) return { success: false, error: "User not found." };

        if (user.role === "admin") {
            if (targetUser.role === "admin" || targetUser.role === "super_admin") {
                return { success: false, error: "Admins cannot reset admin/super-admin passwords." };
            }
        }

        const result = await queries.resetUserPassword(id, newPassword);

        if (result.success) {
            logAction(user, "reset_password", "users", id);
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

    // -------------------
    // DELETE USER
    // -------------------

    ipcMain.handle('delete-user', async (event, { user, idToDelete }) => {
        if (user.role !== "super_admin") {
            return { success: false, error: "Only Super Admin can delete users." };
        }

        if (user.id === idToDelete) {
            return { success: false, error: "You cannot delete your own account." };
        }

        const result = await queries.deleteUser(idToDelete, user.id);

        if (result.success) {
            logAction(user, "delete_user", "users", idToDelete);
        }

        return result;
    });

    // -------------------
    // FEATURE FLAGS
    // -------------------

    ipcMain.handle('get-feature-flags', async () => {
        try {
            const row = await queries.dbGet(getDatabase(), "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1", []);

            const defaults = {
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

            if (!row || !row.features) return { success: true, data: defaults };

            return { success: true, data: { ...defaults, ...JSON.parse(row.features) } };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('save-feature-flags', async (event, { user, flags }) => {
        if (user.role !== "super_admin") {
            return { success: false, error: "Only Super Admin may modify system features." };
        }

        const json = JSON.stringify(flags);

        try {
            await queries.dbRun(db, "UPDATE users SET features = ? WHERE role = 'super_admin'", [json]);
            logAction(user, 'update_feature_flags', 'settings', 1);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------
    // GET USER ROLE
    // -------------------

    ipcMain.handle('get-user-role', async (event, { userId }) => {
        try {
            const row = await queries.dbGet(db, "SELECT role FROM users WHERE id = ?", [userId]);
            if (!row) return { success: false, error: 'User not found' };
            return { success: true, role: row.role };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------
    // ACTIVATION & LICENSE
    // -------------------

    ipcMain.handle('get-activation-status', async () => {
        return new Promise(resolve => {
            db.get(
                "SELECT value FROM system_settings WHERE key = 'license_status'",
                [],
                (err, row) => {
                    if (err) return resolve({ success: false });
                    resolve({ success: true, data: { activated: row?.value === "activated" } });
                }
            );
        });
    });

    ipcMain.handle('activate-application', async (event, code) => {
        const trimmed = typeof code === "string" ? code.trim() : "";

        if (trimmed.length !== 6)
            return { success: false, error: "Invalid activation code." };

        return new Promise(resolve => {
            db.run(
                "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', 'activated')",
                [],
                err => {
                    if (err) return resolve({ success: false, error: "Failed to save license." });
                    resolve({ success: true, data: { activated: true } });
                }
            );
        });
    });

};
