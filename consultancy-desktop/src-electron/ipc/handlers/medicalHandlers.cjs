const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER MEDICAL TRACKING HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerMedicalHandlers() {

    // =======================================================================
    // 1️⃣ GET MEDICAL RECORDS FOR CANDIDATE
    // =======================================================================
    ipcMain.handle("get-medical-tracking", (event, { candidateId }) => {
        return queries.getMedicalTracking(candidateId);
    });

    // =======================================================================
    // 2️⃣ ADD MEDICAL ENTRY
    // =======================================================================
    ipcMain.handle("add-medical-entry", async (event, { user, data }) => {
        const result = await queries.addMedicalEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_medical",
                "candidates",
                data.candidate_id,
                `Medical: ${data.status}, Test Date: ${data.test_date}`
            );
        }

        return result;
    });

    // =======================================================================
    // 3️⃣ UPDATE MEDICAL ENTRY
    // =======================================================================
    ipcMain.handle("update-medical-entry", async (event, { user, id, data }) => {
        const result = await queries.updateMedicalEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_medical",
                "candidates",
                data.candidate_id,
                `Updated Medical ID: ${id}`
            );
        }

        return result;
    });

    // =======================================================================
    // 4️⃣ DELETE MEDICAL ENTRY
    // =======================================================================
    ipcMain.handle("delete-medical-entry", async (event, { user, id }) => {
        const result = await queries.deleteMedicalEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_medical",
                "candidates",
                result.candidateId || 0,
                `Deleted Medical Entry ID: ${id}`
            );
        }

        return result;
    });

};
