const { ipcMain } = require("electron");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerFeatureFlagHandlers() {
    const db = getDatabase();

    // =========================================================================
    // 🔹 GET FEATURE FLAGS (Super Admin Global Toggles)
    // =========================================================================
    ipcMain.handle("get-feature-flags", async () => {
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
            canDeletePermanently: true
        };

        try {
            const row = await queries.dbGet(
                db,
                "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1",
                []
            );

            if (!row || !row.features) {
                return { success: true, data: defaultFlags };
            }

            const merged = { ...defaultFlags, ...JSON.parse(row.features) };
            return { success: true, data: merged };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 SAVE FEATURE FLAGS (Super Admin ONLY)
    // =========================================================================
    ipcMain.handle("save-feature-flags", async (event, { user, flags }) => {
        if (!user || user.role !== "super_admin") {
            return { success: false, error: "Access Denied." };
        }

        try {
            const json = JSON.stringify(flags);
            await queries.dbRun(
                db,
                "UPDATE users SET features = ? WHERE role = 'super_admin'",
                [json]
            );

            logAction(user, "update_feature_flags", "settings", 1, "System features updated");

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 GET USER PERMISSIONS (Delegated)
    // =========================================================================
    ipcMain.handle("get-user-permissions", (event, { userId }) => {
        return queries.getUserPermissions(userId);
    });

    // =========================================================================
    // 🔹 SAVE USER PERMISSIONS (Admin → Staff)
    // =========================================================================
    ipcMain.handle("save-user-permissions", async (event, { user, userId, flags }) => {
        const result = await queries.saveUserPermissions(userId, flags);

        if (result.success) {
            logAction(
                user,
                "update_user_permissions",
                "users",
                userId,
                `Updated delegated flags`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 GET ADMIN-ASSIGNED FEATURES (For Staff)
    // =========================================================================
    ipcMain.handle("get-admin-assigned-features", async (event, { userId }) => {
        try {
            const features = await queries.getAdminAssignedFeatures(userId);
            return { success: true, features };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 GET USER ROLE (Quick lookup)
    // =========================================================================
    ipcMain.handle("get-user-role", async (event, { userId }) => {
        try {
            const row = await queries.dbGet(db, "SELECT role FROM users WHERE id = ?", [userId]);

            if (!row) return { success: false, error: "User not found" };

            return { success: true, role: row.role };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
