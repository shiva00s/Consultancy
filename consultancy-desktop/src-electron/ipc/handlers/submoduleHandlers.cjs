const registerSubmoduleHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    // Passport Tracking
    ipcMain.handle('get-passport-tracking', (event, { candidateId }) => {
        return queries.getPassportTracking(candidateId);
    });

    ipcMain.handle('add-passport-entry', async (event, { user, data }) => {
        const result = await queries.addPassportEntry(data);
        if (result.success) {
            logAction(user, 'add_passport_entry', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Status: ${data.passport_status}, Docket: ${data.docket_number}`);
        }
        return result;
    });

    ipcMain.handle('update-passport-entry', async (event, { user, id, data }) => {
        const result = await queries.updatePassportEntry(id, data);
        if (result.success) {
            logAction(user, 'update_passport_entry', 'candidates', data.candidate_id, `Updated Passport ID: ${id}`);
        }
        return result;
    });

    ipcMain.handle('delete-passport-entry', async (event, { user, id }) => {
        const result = await queries.deletePassportEntry(id);
        if (result.success) {
            logAction(user, 'delete_passport_entry', 'candidates', 0, `Deleted Passport ID: ${id}`);
        }
        return result;
    });

    // Visa Tracking & Kanban
    ipcMain.handle('get-visa-tracking', (event, { candidateId }) => {
        return queries.getVisaTracking(candidateId);
    });

    ipcMain.handle('add-visa-entry', async (event, { user, data }) => {
        const result = await queries.addVisaEntry(data);
        if (result.success) {
            logAction(user, 'add_visa', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Country: ${data.country}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('update-visa-entry', async (event, { user, id, data }) => {
        const result = await queries.updateVisaEntry(id, data);
        if (result.success) {
            logAction(user, 'update_visa', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Country: ${data.country}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('delete-visa-entry', async (event, { user, id }) => {
        const result = await queries.deleteVisaEntry(id);
        if (result.success) {
            logAction(user, 'delete_visa', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Country: ${result.country}`);
        }
        return result;
    });

    ipcMain.handle('get-all-active-visas', async () => {
        return queries.getAllActiveVisas();
    });

    ipcMain.handle('update-visa-status', async (event, { id, status }) => {
        return queries.updateVisaStatus(id, status);
    });

    // Medical Tracking
    ipcMain.handle('get-medical-tracking', (event, { candidateId }) => {
        return queries.getMedicalTracking(candidateId);
    });

    ipcMain.handle('add-medical-entry', async (event, { user, data }) => {
        const result = await queries.addMedicalEntry(data);
        if(result.success) {
            logAction(user, 'add_medical', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.test_date}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('update-medical-entry', async (event, { user, id, data }) => {
        const result = await queries.updateMedicalEntry(id, data);
        if(result.success) {
            logAction(user, 'update_medical', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.test_date}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('delete-medical-entry', async (event, { user, id }) => {
        const result = await queries.deleteMedicalEntry(id);
        if(result.success) {
            logAction(user, 'delete_medical', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.test_date}, Status: ${result.status}`);
        }
        return result;
    });

    // Travel Tracking
    ipcMain.handle('get-travel-tracking', (event, { candidateId }) => {
        return queries.getTravelTracking(candidateId);
    });

    ipcMain.handle('add-travel-entry', async (event, { user, data }) => {
        const result = await queries.addTravelEntry(data);
        if(result.success) {
            logAction(user, 'add_travel', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`);
        }
        return result;
    });

    ipcMain.handle('update-travel-entry', async (event, { user, id, data }) => {
        const result = await queries.updateTravelEntry(id, data);
        if(result.success) {
            logAction(user, 'update_travel', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`);
        }
        return result;
    });

    ipcMain.handle('delete-travel-entry', async (event, { user, id }) => {
        const result = await queries.deleteTravelEntry(id);
        if(result.success) {
            logAction(user, 'delete_travel', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.travel_date}`);
        }
        return result;
    });

    // Interview Tracking
    ipcMain.handle('get-interview-tracking', (event, { candidateId }) => {
        return queries.getInterviewTracking(candidateId);
    });

    ipcMain.handle('add-interview-entry', async (event, { user, data }) => {
        const result = await queries.addInterviewEntry(data);
        if(result.success) {
            logAction(user, 'add_interview', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('update-interview-entry', async (event, { user, id, data }) => {
        const result = await queries.updateInterviewEntry(id, data);
        if(result.success) {
            logAction(user, 'update_interview', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('delete-interview-entry', async (event, { user, id }) => {
        const result = await queries.deleteInterviewEntry(id);
        if(result.success) {
            logAction(user, 'delete_interview', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.interview_date}, Round: ${result.round}`);
        }
        return result;
    });

    // Placement Handlers (moved here from employerJobHandlers for logical grouping with candidate sub-modules)
    ipcMain.handle('get-candidate-placements', (event, { candidateId }) => {
        return queries.getCandidatePlacements(candidateId);
    });
};

module.exports = { registerSubmoduleHandlers };
