const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER TRAVEL TRACKING HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerTravelHandlers() {

    // =======================================================================
    // 1️⃣ GET TRAVEL RECORDS FOR CANDIDATE
    // =======================================================================
    ipcMain.handle("get-travel-tracking", (event, { candidateId }) => {
        return queries.getTravelTracking(candidateId);
    });

    // =======================================================================
    // 2️⃣ ADD TRAVEL ENTRY
    // =======================================================================
    ipcMain.handle("add-travel-entry", async (event, { user, data }) => {
        const result = await queries.addTravelEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_travel",
                "candidates",
                data.candidate_id,
                `Travel: ${data.departure_city} → ${data.arrival_city}, Date: ${data.travel_date}`
            );
        }

        return result;
    });

    // =======================================================================
    // 3️⃣ UPDATE TRAVEL ENTRY
    // =======================================================================
    ipcMain.handle("update-travel-entry", async (event, { user, id, data }) => {
        const result = await queries.updateTravelEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_travel",
                "candidates",
                data.candidate_id,
                `Updated Travel ID: ${id}`
            );
        }

        return result;
    });

    // =======================================================================
    // 4️⃣ DELETE TRAVEL ENTRY
    // =======================================================================
    ipcMain.handle("delete-travel-entry", async (event, { user, id }) => {
        const result = await queries.deleteTravelEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_travel",
                "candidates",
                result.candidateId || 0,
                `Deleted Travel Entry ID: ${id}`
            );
        }

        return result;
    });

};
