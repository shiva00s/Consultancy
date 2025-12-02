const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");

// ---------------------------------------------------------------------------
// REGISTER VISA KANBAN BOARD HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerVisaKanbanHandlers() {

    // =======================================================================
    // 1️⃣ GET ALL ACTIVE VISAS (for Kanban Board)
    // =======================================================================
    ipcMain.handle("get-all-active-visas", async () => {
        try {
            const data = await queries.getAllActiveVisas();
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ UPDATE VISA STATUS (columns: New → Processing → Approved → Rejected)
    // =======================================================================
    ipcMain.handle("update-visa-status", async (event, { id, status }) => {
        if (!id || !status) {
            return { success: false, error: "Visa ID and Status required." };
        }

        try {
            const result = await queries.updateVisaStatus(id, status);
            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
