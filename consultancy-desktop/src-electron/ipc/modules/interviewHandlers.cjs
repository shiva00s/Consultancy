// src-electron/ipc/modules/interviewHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerInterviewHandlers(app) {
    console.log('🎤 Registering Interview Handlers...');

    ipcMain.handle('get-interview-tracking', async (event, { user, candidateId }) => {
        return queries.getInterviewTracking(candidateId);
    });

    ipcMain.handle('add-interview-entry', async (event, { user, data }) => {
        const result = await queries.addInterviewEntry(data);
        if (result.success) {
            logAction(
                user, 
                'add_interview', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('update-interview-entry', async (event, { user, id, data }) => {
        const result = await queries.updateInterviewEntry(id, data);
        if (result.success) {
            logAction(
                user, 
                'update_interview', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`
            );
        }
        return result;
    });

    ipcMain.handle('delete-interview-entry', async (event, { user, id }) => {
        const result = await queries.deleteInterviewEntry(id);
        if (result.success) {
            logAction(
                user, 
                'delete_interview', 
                'candidates', 
                result.candidateId, 
                `Date: ${result.interview_date}, Round: ${result.round}`
            );
        }
        return result;
    });

    console.log('✅ Interview Handlers Registered');
}

module.exports = { registerInterviewHandlers };
