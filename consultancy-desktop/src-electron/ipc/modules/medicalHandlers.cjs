// src-electron/ipc/modules/medicalHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerMedicalHandlers(app) {
    console.log('🏥 Registering Medical Handlers...');

    ipcMain.handle('get-medical-tracking', async (event, { user, candidateId }) => {
        return queries.getMedicalTracking(candidateId);
    });

    ipcMain.handle('add-medical-entry', async (event, { user, data }) => {
        const result = await queries.addMedicalEntry(data);
        if (result.success) {
            logAction(
                user, 
                'add_medical', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.test_date}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('update-medical-entry', async (event, { user, id, data }) => {
        const result = await queries.updateMedicalEntry(id, data);
        if (result.success) {
            logAction(
                user, 
                'update_medical', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.test_date}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('delete-medical-entry', async (event, { user, id }) => {
        const result = await queries.deleteMedicalEntry(id);
        if (result.success) {
            logAction(
                user, 
                'delete_medical', 
                'candidates', 
                result.candidateId, 
                `Date: ${result.test_date}`
            );
        }
        return result;
    });

    console.log('✅ Medical Handlers Registered');
}

module.exports = { registerMedicalHandlers };
