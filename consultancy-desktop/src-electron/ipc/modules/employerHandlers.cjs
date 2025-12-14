// src-electron/ipc/modules/employerHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerEmployerHandlers(app) {
    console.log('🏢 Registering Employer Handlers...');

    ipcMain.handle('get-employers', async (event) => {
        return queries.getEmployers();
    });

    ipcMain.handle('add-employer', async (event, { user, data }) => {
        const result = await queries.addEmployer(user, data);
        if (result.success) {
            logAction(user, 'create_employer', 'employers', result.id, `Name: ${data.companyName}`);
        }
        return result;
    });

    ipcMain.handle('update-employer', async (event, { user, id, data }) => {
        const result = await queries.updateEmployer(user, id, data);
        if (result.success) {
            logAction(user, 'update_employer', 'employers', id, `Name: ${data.companyName}`);
        }
        return result;
    });

    ipcMain.handle('delete-employer', async (event, { user, id }) => {
        const result = await queries.deleteEmployer(user, id);
        if (result.success) {
            logAction(user, 'delete_employer', 'employers', id);
        }
        return result;
    });

    console.log('✅ Employer Handlers Registered');
}

module.exports = { registerEmployerHandlers };
