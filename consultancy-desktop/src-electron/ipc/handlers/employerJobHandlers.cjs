const registerEmployerJobHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-employers', (event) => {
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

    ipcMain.handle('get-job-orders', (event) => {
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

    ipcMain.handle('get-unassigned-jobs', (event, { candidateId }) => {
        return queries.getUnassignedJobs(candidateId);
    });

    ipcMain.handle('assign-candidate-to-job', async (event, { user, candidateId, jobId }) => {
        const result = await queries.assignCandidateToJob(candidateId, jobId);
        if (result.success) {
            logAction(user, 'assign_job', 'candidates', candidateId, `Candidate: ${candidateId}, Job ID: ${jobId}`);
        }
        return result;
    });

    ipcMain.handle('remove-candidate-from-job', async (event, { user, placementId }) => {
        const result = await queries.removeCandidateFromJob(placementId);
        if (result.success) {
            logAction(user, 'remove_placement', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Job ID: ${result.jobId}`);
        }
        return result;
    });
};

module.exports = { registerEmployerJobHandlers };
