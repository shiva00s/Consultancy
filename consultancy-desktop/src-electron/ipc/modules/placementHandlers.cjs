// src-electron/ipc/modules/placementHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerPlacementHandlers(app) {
    console.log('🔗 Registering Placement Handlers...');

    ipcMain.handle('get-candidate-placements', async (event, { user, candidateId }) => {
        return queries.getCandidatePlacements(candidateId);
    });

    ipcMain.handle('get-unassigned-jobs', async (event, { user, candidateId }) => {
        return queries.getUnassignedJobs(candidateId);
    });

    ipcMain.handle('assign-candidate-to-job', async (event, { user, candidateId, jobId }) => {
        const result = await queries.assignCandidateToJob(candidateId, jobId);
        if (result.success) {
            logAction(user, 'assign_job', 'candidates', candidateId, `Job ID: ${jobId}`);
        }
        return result;
    });

    ipcMain.handle('remove-candidate-from-job', async (event, { user, placementId }) => {
        const result = await queries.removeCandidateFromJob(placementId);
        if (result.success) {
            logAction(user, 'remove_placement', 'candidates', result.candidateId, `Job ID: ${result.jobId}`);
        }
        return result;
    });

    console.log('✅ Placement Handlers Registered');
}

module.exports = { registerPlacementHandlers };
