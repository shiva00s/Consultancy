const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerAuthHandlers() {

    // -------------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------------
    ipcMain.handle("login", async (event, creds) => {
        try {
            const result = await queries.login(creds);

            if (result.success) {
                logAction(result.user, "login", "users", result.user.id);
            }

            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // REGISTER NEW USER
    // -------------------------------------------------------------
    ipcMain.handle("register-new-user", async (event, { user, newUser }) => {
        const result = await queries.registerUser(newUser);

        if (result.success) {
            logAction(user, "register_user", "users", result.id, `Created new user ${newUser.username}`);
        }

        return result;
    });

    // -------------------------------------------------------------
    // GET ALL USERS
    // -------------------------------------------------------------
    ipcMain.handle("get-all-users", () => {
        return queries.getAllUsers();
    });

    // -------------------------------------------------------------
    // ADD USER
    // -------------------------------------------------------------
    ipcMain.handle("add-user", async (event, { user, data }) => {
        const result = await queries.addUser(data);

        if (result.success) {
            logAction(user, "add_user", "users", result.id, `Added user ${data.username}`);
        }

        return result;
    });

    // -------------------------------------------------------------
    // UPDATE USER
    // -------------------------------------------------------------
    ipcMain.handle("update-user", async (event, { user, id, data }) => {
        const result = await queries.updateUser(id, data);

        if (result.success) {
            logAction(user, "update_user", "users", id, `Updated user ${data.username}`);
        }

        return result;
    });

    // -------------------------------------------------------------
    // DELETE USER
    // -------------------------------------------------------------
    ipcMain.handle("delete-user", async (event, { user, id }) => {
        const result = await queries.deleteUser(id);

        if (result.success) {
            logAction(user, "delete_user", "users", id);
        }

        return result;
    });

    // -------------------------------------------------------------
    // RESET PASSWORD (Admin)
    // -------------------------------------------------------------
    ipcMain.handle("reset-user-password", async (event, { user, userId }) => {
        const result = await queries.resetUserPassword(userId);

        if (result.success) {
            logAction(user, "reset_user_password", "users", userId);
        }

        return result;
    });

    // -------------------------------------------------------------
    // CHANGE OWN PASSWORD
    // -------------------------------------------------------------
    ipcMain.handle("change-my-password", async (event, { userId, oldPass, newPass }) => {
        return queries.changeMyPassword(userId, oldPass, newPass);
    });

    // -------------------------------------------------------------
    // GET USER PERMISSIONS
    // -------------------------------------------------------------
    ipcMain.handle("get-user-permissions", async (event, userId) => {
        return queries.getUserPermissions(userId);
    });

    // -------------------------------------------------------------
    // SAVE USER PERMISSIONS
    // -------------------------------------------------------------
    ipcMain.handle("save-user-permissions", async (event, { user, targetId, permissions }) => {
        const result = await queries.saveUserPermissions(targetId, permissions);

        if (result.success) {
            logAction(user, "modify_permissions", "users", targetId, `Updated permissions`);
        }

        return result;
    });

    // -------------------------------------------------------------
    // GET FEATURE FLAGS (SuperAdmin)
    // -------------------------------------------------------------
    ipcMain.handle("get-feature-flags", async () => {
        return queries.getFeatureFlags();
    });

    // -------------------------------------------------------------
    // SAVE FEATURE FLAGS (SuperAdmin)
    // -------------------------------------------------------------
    ipcMain.handle("save-feature-flags", async (event, { user, flags }) => {
        const result = await queries.saveFeatureFlags(flags);

        if (result.success) {
            logAction(user, "update_feature_flags", "system", 0);
        }

        return result;
    });

    // -------------------------------------------------------------
    // GET USER ROLE (quick check)
    // -------------------------------------------------------------
    ipcMain.handle("get-user-role", async (event, { userId }) => {
        return queries.getUserRole(userId);
    });

};
