// src-electron/ipc/modules/jobOrderHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerJobOrderHandlers(app) {
    console.log('💼 Registering Job Order Handlers...');

    ipcMain.handle('get-job-orders', async (event) => {
        return queries.getJobOrders();
    });

    ipcMain.handle('add-job-order', async (event, { user, data }) => {
        const result = await queries.addJobOrder(user, data);
        if (result.success) {
            logAction(user, 'create_job', 'job_orders', result.id, `Position: ${data.positionTitle}`);
        }
        return result;
    });

    ipcMain.handle('update-job-order', async (event, { user, id, data }) => {
        const result = await queries.updateJobOrder(user, id, data);
        if (result.success) {
            logAction(user, 'update_job', 'job_orders', id, `Position: ${data.positionTitle}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('delete-job-order', async (event, { user, id }) => {
        const result = await queries.deleteJobOrder(user, id);
        if (result.success) {
            logAction(user, 'delete_job', 'job_orders', id);
        }
        return result;
    });

    console.log('✅ Job Order Handlers Registered');
}

module.exports = { registerJobOrderHandlers };
