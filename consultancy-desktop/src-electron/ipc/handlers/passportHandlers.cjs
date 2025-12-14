const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER PASSPORT TRACKING HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerPassportHandlers() {

    // =======================================================================
    // 1️⃣ GET PASSPORT TRACKING LIST FOR CANDIDATE
    // =======================================================================
    ipcMain.handle("get-passport-tracking", (event, { candidateId }) => {
        return queries.getPassportTracking(candidateId);
    });

    // =======================================================================
    // 2️⃣ ADD PASSPORT ENTRY
    // =======================================================================
    ipcMain.handle("add-passport-entry", async (event, { user, data }) => {
        const result = await queries.addPassportEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_passport_entry",
                "candidates",
                data.candidate_id,
                `Passport Status: ${data.passport_status}, Docket: ${data.docket_number}`
            );
        }

        return result;
    });

    // =======================================================================
    // 3️⃣ UPDATE PASSPORT ENTRY
    // =======================================================================
    ipcMain.handle("update-passport-entry", async (event, { user, id, data }) => {
        const result = await queries.updatePassportEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_passport_entry",
                "candidates",
                data.candidate_id,
                `Updated Passport Entry ID: ${id}`
            );
        }

        return result;
    });

    // =======================================================================
    // 4️⃣ DELETE PASSPORT ENTRY
    // =======================================================================
    ipcMain.handle("delete-passport-entry", async (event, { user, id }) => {
        const result = await queries.deletePassportEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_passport_entry",
                "candidates",
                result.candidateId || 0,
                `Deleted Passport Entry ID: ${id}`
            );
        }

        return result;
    });

};
