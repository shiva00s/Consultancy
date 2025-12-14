// src-electron/ipc/modules/travelHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');

function registerTravelHandlers(app) {
    console.log('✈️ Registering Travel Handlers...');

    ipcMain.handle('get-travel-tracking', async (event, { user, candidateId }) => {
        return queries.getTravelTracking(candidateId);
    });

    ipcMain.handle('add-travel-entry', async (event, { user, data }) => {
        const result = await queries.addTravelEntry(data);
        if (result.success) {
            logAction(
                user, 
                'add_travel', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`
            );
        }
        return result;
    });

    ipcMain.handle('update-travel-entry', async (event, { user, id, data }) => {
        const result = await queries.updateTravelEntry(id, data);
        if (result.success) {
            logAction(
                user, 
                'update_travel', 
                'candidates', 
                data.candidate_id, 
                `Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`
            );
        }
        return result;
    });

    ipcMain.handle('delete-travel-entry', async (event, { user, id }) => {
        const result = await queries.deleteTravelEntry(id);
        if (result.success) {
            logAction(
                user, 
                'delete_travel', 
                'candidates', 
                result.candidateId, 
                `Date: ${result.travel_date}`
            );
        }
        return result;
    });

    console.log('✅ Travel Handlers Registered');
}

module.exports = { registerTravelHandlers };
