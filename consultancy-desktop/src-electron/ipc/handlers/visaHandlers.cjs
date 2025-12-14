const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerVisaHandlers() {

    // =========================================================================
    // 🔹 GET VISA TRACKING FOR A CANDIDATE
    // =========================================================================
    ipcMain.handle("get-visa-tracking", async (event, { candidateId }) => {
        return queries.getVisaTracking(candidateId);
    });

    // =========================================================================
    // 🔹 ADD VISA ENTRY
    // =========================================================================
    ipcMain.handle("add-visa-entry", async (event, { user, data }) => {
        const result = await queries.addVisaEntry(data);

        if (result.success) {
            logAction(
                user,
                "add_visa_entry",
                "visa_tracking",
                data.candidate_id,
                `Country: ${data.country}, Status: ${data.status}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 UPDATE VISA ENTRY
    // =========================================================================
    ipcMain.handle("update-visa-entry", async (event, { user, id, data }) => {
        const result = await queries.updateVisaEntry(id, data);

        if (result.success) {
            logAction(
                user,
                "update_visa_entry",
                "visa_tracking",
                data.candidate_id,
                `Visa ID ${id} updated`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 DELETE VISA ENTRY
    // =========================================================================
    ipcMain.handle("delete-visa-entry", async (event, { user, id }) => {
        const result = await queries.deleteVisaEntry(id);

        if (result.success) {
            logAction(
                user,
                "delete_visa_entry",
                "visa_tracking",
                result.candidateId,
                `Visa ID ${id} deleted`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 RECYCLE BIN: GET DELETED VISAS
    // =========================================================================
    ipcMain.handle("get-deleted-visas", async () => {
        return queries.getDeletedVisas();
    });

    // =========================================================================
    // 🔹 RESTORE VISA ENTRY
    // =========================================================================
    ipcMain.handle("restore-visa", async (event, { user, id }) => {
        const result = await queries.restoreVisa(id);

        if (result.success) {
            logAction(user, "restore_visa_entry", "visa_tracking", id);
        }

        return result;
    });

    // =========================================================================
    // 🔹 GET ACTIVE VISAS (KANBAN VIEW)
    // =========================================================================
    ipcMain.handle("get-all-active-visas", async () => {
        return queries.getAllActiveVisas();
    });

    // =========================================================================
    // 🔹 UPDATE VISA STATUS (KANBAN COLUMN MOVE)
    // =========================================================================
    ipcMain.handle("update-visa-status", async (event, { id, status }) => {
        return queries.updateVisaStatus(id, status);
    });

};
