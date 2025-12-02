const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerTravelHandlers() {

    // -------------------------------------------------------------
    // GET TRAVEL TRACKING FOR CANDIDATE
    // -------------------------------------------------------------
    ipcMain.handle("get-travel-tracking", (event, { candidateId }) => {
        return queries.getTravelTracking(candidateId);
    });

    // -------------------------------------------------------------
    // ADD TRAVEL ENTRY
    // -------------------------------------------------------------
    ipcMain.handle("add-travel-entry", async (event, { user, data }) => {
        const result = await queries.addTravelEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_travel",
                "travel_tracking",
                data.candidate_id,
                `Travel: ${data.travel_date}, ${data.departure_city} → ${data.arrival_city}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // UPDATE TRAVEL ENTRY
    // -------------------------------------------------------------
    ipcMain.handle("update-travel-entry", async (event, { user, id, data }) => {
        const result = await queries.updateTravelEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_travel",
                "travel_tracking",
                data.candidate_id,
                `Updated travel entry ID ${id}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // DELETE TRAVEL ENTRY
    // -------------------------------------------------------------
    ipcMain.handle("delete-travel-entry", async (event, { user, id }) => {
        const result = await queries.deleteTravelEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_travel",
                "travel_tracking",
                result.candidateId,
                `Deleted travel entry ID ${id}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // RECYCLE BIN — GET DELETED TRAVEL ENTRIES
    // -------------------------------------------------------------
    ipcMain.handle("get-deleted-travel", () => {
        return queries.getDeletedTravel();
    });

    // -------------------------------------------------------------
    // RECYCLE BIN — RESTORE TRAVEL ENTRY
    // -------------------------------------------------------------
    ipcMain.handle("restore-travel", async (event, { user, id }) => {
        const result = await queries.restoreTravel(id);

        if (result.success) {
            logAction(
                user,
                "restore_travel",
                "travel_tracking",
                id,
                `Restored travel entry ID ${id}`
            );
        }

        return result;
    });

};
