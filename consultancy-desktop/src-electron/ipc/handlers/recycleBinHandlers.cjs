const registerRecycleBinHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-deleted-candidates', (event) => {
        return queries.getDeletedCandidates();
    });

    ipcMain.handle('restore-candidate', async (event, { user, id }) => {
        const result = await queries.restoreCandidate(id);
        if (result.success) {
            logAction(user, 'restore_candidate', 'candidates', id);
        }
        return result;
    });

    ipcMain.handle('get-deleted-employers', (event) => {
        return queries.getDeletedEmployers();
    });

    ipcMain.handle('restore-employer', async (event, { user, id }) => {
        const result = await queries.restoreEmployer(id);
        if (result.success) {
            logAction(user, 'restore_employer', 'employers', id);
        }
        return result;
    });

    ipcMain.handle('get-deleted-job-orders', (event) => {
        return queries.getDeletedJobOrders();
    });

    ipcMain.handle('restore-job-order', async (event, { user, id }) => {
        const result = await queries.restoreJobOrder(id);
        if (result.success) {
            logAction(user, 'restore_job', 'job_orders', id);
        }
        return result;
    });

    ipcMain.handle('delete-permanently', async (event, { user, id, targetType }) => {
        if (user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Only Super Admins can perform permanent deletion.' };
        }
        
        const flagRes = await queries.getFeatureFlags(); // Assumes getFeatureFlags is in queries
        if (flagRes.success && !flagRes.data.canDeletePermanently) {
            console.warn(`SA attempted permanent delete while flag is disabled.`);
        }

        const result = await queries.deletePermanently(id, targetType);
        if (result.success) {
            logAction(user, 'delete_permanently', targetType, id, `Permanently deleted ${targetType} ID: ${id}`);
        }
        return result;
    });
};

module.exports = { registerRecycleBinHandlers };
