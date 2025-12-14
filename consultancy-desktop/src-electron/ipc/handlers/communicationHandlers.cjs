const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");

// ---------------------------------------------------------------------------
// REGISTER COMMUNICATION LOG HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerCommunicationHandlers() {

    // =======================================================================
    // 1️⃣ LOG COMMUNICATION (Call, Email, WhatsApp, SMS, Notes, etc.)
    // =======================================================================
    ipcMain.handle("log-communication", async (event, { user, candidateId, type, details }) => {
        if (!user || !candidateId || !type) {
            return { success: false, error: "Invalid communication log request." };
        }

        try {
            const result = await queries.logCommunication(
                user,
                candidateId,
                type,
                details
            );

            return result;

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ GET COMMUNICATION LOGS FOR A CANDIDATE
    // =======================================================================
    ipcMain.handle("get-comm-logs", async (event, { candidateId }) => {
        if (!candidateId) {
            return { success: false, error: "Candidate ID missing." };
        }

        try {
            const result = await queries.getCommLogs(candidateId);
            return result;

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
