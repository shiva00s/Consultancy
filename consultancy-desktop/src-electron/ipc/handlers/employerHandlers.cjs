const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerEmployerHandlers() {

    // =========================================================================
    // 🔹 GET ALL EMPLOYERS
    // =========================================================================
    ipcMain.handle("get-employers", async () => {
        return queries.getEmployers();
    });

    // =========================================================================
    // 🔹 ADD EMPLOYER
    // =========================================================================
    ipcMain.handle("add-employer", async (event, { user, data }) => {
        const result = await queries.addEmployer(user, data);

        if (result.success) {
            logAction(
                user,
                "create_employer",
                "employers",
                result.id,
                `Created employer: ${data.companyName}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 UPDATE EMPLOYER
    // =========================================================================
    ipcMain.handle("update-employer", async (event, { user, id, data }) => {
        const result = await queries.updateEmployer(user, id, data);

        if (result.success) {
            logAction(
                user,
                "update_employer",
                "employers",
                id,
                `Updated employer: ${data.companyName}`
            );
        }

        return result;
    });

    // =========================================================================
    // 🔹 DELETE EMPLOYER
    // =========================================================================
    ipcMain.handle("delete-employer", async (event, { user, id }) => {
        const result = await queries.deleteEmployer(user, id);

        if (result.success) {
            logAction(user, "delete_employer", "employers", id);
        }

        return result;
    });

    // =========================================================================
    // 🔹 GET DELETED EMPLOYERS (RECYCLE BIN)
    // =========================================================================
    ipcMain.handle("get-deleted-employers", async () => {
        return queries.getDeletedEmployers();
    });

    // =========================================================================
    // 🔹 RESTORE EMPLOYER FROM RECYCLE BIN
    // =========================================================================
    ipcMain.handle("restore-employer", async (event, { user, id }) => {
        const result = await queries.restoreEmployer(id);

        if (result.success) {
            logAction(user, "restore_employer", "employers", id);
        }

        return result;
    });

};
