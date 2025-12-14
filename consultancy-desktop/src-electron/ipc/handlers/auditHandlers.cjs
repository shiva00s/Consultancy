const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");

module.exports = function registerAuditHandlers() {

    // =========================================================================
    // 🔹 MANUAL LOG EVENT (RARELY USED — UI-triggered logs)
    // =========================================================================
    ipcMain.handle("log-audit-event", async (event, { user, action, table, rowId, description }) => {
        if (!user || !action) {
            return { success: false, error: "Invalid audit request." };
        }

        return queries.logAuditEvent({
            userId: user.id,
            username: user.username,
            action,
            table,
            rowId,
            description,
        });
    });

    // =========================================================================
    // 🔹 GET COMPLETE SYSTEM AUDIT LOG (Admin / Super Admin)
    // =========================================================================
    ipcMain.handle("get-system-audit-log", async (event, { user }) => {
        if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
            return { success: false, error: "Access denied." };
        }

        return queries.getSystemAuditLog();
    });

    // =========================================================================
    // 🔹 GET AUDIT LOG FOR A SPECIFIC CANDIDATE
    // =========================================================================
    ipcMain.handle("get-audit-log-for-candidate", async (event, { user, candidateId }) => {
        if (!user) {
            return { success: false, error: "Unauthorized." };
        }

        return queries.getAuditLogForCandidate(candidateId);
    });

};
