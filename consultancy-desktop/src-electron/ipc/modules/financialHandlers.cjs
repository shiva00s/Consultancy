// src-electron/ipc/modules/financialHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { guard, FEATURES } = require('../security/ipcPermissionGuard.cjs');

function registerFinancialHandlers(app) {
    console.log('💰 Registering Financial Handlers...');

    ipcMain.handle('get-candidate-payments', async (event, { user, candidateId }) => {
        if (user) {
            logAction(user, 'view_candidate_finance', 'candidates', candidateId);
        }
        return queries.getCandidatePayments(candidateId);
    });

    ipcMain.handle('add-payment', async (event, { user, data }) => {
        try {
            guard(user).enforce(FEATURES.BILLING);

            if (user.role === 'staff') {
                return { success: false, error: 'Access Denied: Staff cannot add payments.' };
            }

            const result = await queries.addPayment(user, data);

            if (result.success) {
                logAction(
                    user, 
                    'add_payment', 
                    'candidates', 
                    data.candidate_id, 
                    `Amount: ${data.amount_paid}, Status: ${data.status}`
                );
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('update-payment', async (event, { user, id, data }) => {
        try {
            guard(user).enforce(FEATURES.BILLING);

            if (user.role === 'staff') {
                return { success: false, error: 'Access Denied: Staff cannot modify payments.' };
            }

            const result = await queries.updatePayment(user, id, data);

            if (result.success) {
                logAction(
                    user, 
                    'update_payment', 
                    'candidates', 
                    result.candidateId, 
                    `Amount: ${data.amount_paid}, Status: ${data.status}`
                );
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('delete-payment', async (event, { user, id }) => {
        try {
            guard(user).enforce(FEATURES.BILLING);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Super Admin only.' };
            }

            const result = await queries.deletePayment(user, id);

            if (result.success) {
                logAction(
                    user, 
                    'delete_payment', 
                    'candidates', 
                    result.candidateId, 
                    `Deleted payment ID: ${id}`
                );
            }
            return result;
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    console.log('✅ Financial Handlers Registered');
}

module.exports = { registerFinancialHandlers };
