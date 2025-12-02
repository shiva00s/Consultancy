const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER INTERVIEW TRACKING HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerInterviewHandlers() {

    // =======================================================================
    // 1️⃣ GET INTERVIEW RECORDS FOR CANDIDATE
    // =======================================================================
    ipcMain.handle("get-interview-tracking", (event, { candidateId }) => {
        return queries.getInterviewTracking(candidateId);
    });

    // =======================================================================
    // 2️⃣ ADD INTERVIEW ENTRY
    // =======================================================================
    ipcMain.handle("add-interview-entry", async (event, { user, data }) => {
        const result = await queries.addInterviewEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_interview",
                "candidates",
                data.candidate_id,
                `Round: ${data.round}, Status: ${data.status}, Date: ${data.interview_date}`
            );
        }

        return result;
    });

    // =======================================================================
    // 3️⃣ UPDATE INTERVIEW ENTRY
    // =======================================================================
    ipcMain.handle("update-interview-entry", async (event, { user, id, data }) => {
        const result = await queries.updateInterviewEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_interview",
                "candidates",
                data.candidate_id,
                `Interview ID ${id} updated`
            );
        }

        return result;
    });

    // =======================================================================
    // 4️⃣ DELETE INTERVIEW ENTRY
    // =======================================================================
    ipcMain.handle("delete-interview-entry", async (event, { user, id }) => {
        const result = await queries.deleteInterviewEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_interview",
                "candidates",
                result.candidateId || 0,
                `Deleted Interview Entry ID: ${id}`
            );
        }

        return result;
    });

};
