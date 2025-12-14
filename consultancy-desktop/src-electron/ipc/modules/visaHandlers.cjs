// src-electron/ipc/modules/visaHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerVisaHandlers(app) {
    console.log('🛂 Registering Visa Handlers...');

    // Passport Tracking
    ipcMain.handle('add-passport-entry', async (event, { user, data }) => {
        const result = await queries.addPassportEntry(data);
        if (result.success) {
            logAction(
                user, 
                'add_passport_entry', 
                'candidates', 
                data.candidate_id, 
                `Status: ${data.passport_status}, Docket: ${data.docket_number}`
            );
        }
        return result;
    });

    // Visa Tracking
    ipcMain.handle('get-visa-tracking', async (event, { user, candidateId }) => {
        return queries.getVisaTracking(candidateId);
    });

    ipcMain.handle('add-visa-entry', async (event, { user, data }) => {
        const result = await queries.addVisaEntry(data);
        if (result.success) {
            logAction(
                user, 
                'add_visa', 
                'candidates', 
                data.candidate_id, 
                `Country: ${data.country}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('update-visa-entry', async (event, { user, id, data }) => {
        const result = await queries.updateVisaEntry(id, data);
        if (result.success) {
            logAction(
                user, 
                'update_visa', 
                'candidates', 
                data.candidate_id, 
                `Country: ${data.country}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('delete-visa-entry', async (event, { user, id }) => {
        const result = await queries.deleteVisaEntry(id);
        if (result.success) {
            logAction(
                user, 
                'delete_visa', 
                'candidates', 
                result.candidateId, 
                `Country: ${result.country}`
            );
        }
        return result;
    });

    console.log('✅ Visa Handlers Registered');
}

module.exports = { registerVisaHandlers };
