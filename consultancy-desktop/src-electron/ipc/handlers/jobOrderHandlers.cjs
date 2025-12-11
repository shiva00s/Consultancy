const { ipcMain } = require("electron");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerJobOrderHandlers() {

    // -------------------------------------------------------------
    // GET JOB ORDERS
    // -------------------------------------------------------------
    ipcMain.handle("get-job-orders", () => {
        return queries.getJobOrders();
    });

    // -------------------------------------------------------------
    // ADD JOB ORDER
    // -------------------------------------------------------------
    ipcMain.handle("add-job-order", async (event, { user, data }) => {
        const result = await queries.addJobOrder(user, data);

        if (result.success) {
            logAction(
                user,
                "create_job",
                "job_orders",
                result.id,
                `Position: ${data.positionTitle}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // UPDATE JOB ORDER
    // -------------------------------------------------------------
    ipcMain.handle("update-job-order", async (event, { user, id, data }) => {
        const result = await queries.updateJobOrder(user, id, data);

        if (result.success) {
            logAction(
                user,
                "update_job",
                "job_orders",
                id,
                `Updated Job ID ${id}, Position: ${data.positionTitle}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // DELETE JOB ORDER
    // -------------------------------------------------------------
    ipcMain.handle("delete-job-order", async (event, { user, id }) => {
        const result = await queries.deleteJobOrder(user, id);

        if (result.success) {
            logAction(
                user,
                "delete_job",
                "job_orders",
                id,
                `Deleted job order ID ${id}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // RECYCLE BIN — GET DELETED JOB ORDERS
    // -------------------------------------------------------------
    ipcMain.handle("get-deleted-job-orders", () => {
        return queries.getDeletedJobOrders();
    });

    // -------------------------------------------------------------
    // RECYCLE BIN — RESTORE JOB ORDER
    // -------------------------------------------------------------
    ipcMain.handle("restore-job-order", async (event, { user, id }) => {
        const result = await queries.restoreJobOrder(id);

        if (result.success) {
            logAction(
                user,
                "restore_job",
                "job_orders",
                id,
                `Restored job order ID ${id}`
            );
        }

        return result;
    });

};
