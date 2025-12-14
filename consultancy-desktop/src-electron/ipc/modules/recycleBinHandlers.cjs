// src-electron/ipc/modules/recycleBinHandlers.cjs
const { ipcMain } = require('electron');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { guard, FEATURES } = require('../security/ipcPermissionGuard.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerRecycleBinHandlers(app) {
    console.log('🗑️ Registering Recycle Bin Handlers...');

    // ====================================================================
    // CANDIDATES
    // ====================================================================
    
    ipcMain.handle('get-deleted-candidates', async (event) => {
        return queries.getDeletedCandidates();
    });

    ipcMain.handle('restore-candidate', async (event, { user, id }) => {
        const result = await queries.restoreCandidate(id);
        if (result.success) {
            logAction(user, 'restore_candidate', 'candidates', id);
        }
        return result;
    });

    // ====================================================================
    // EMPLOYERS
    // ====================================================================
    
    ipcMain.handle('get-deleted-employers', async (event) => {
        return queries.getDeletedEmployers();
    });

    ipcMain.handle('restore-employer', async (event, { user, id }) => {
        const result = await queries.restoreEmployer(id);
        if (result.success) {
            logAction(user, 'restore_employer', 'employers', id);
        }
        return result;
    });

    // ====================================================================
    // JOB ORDERS
    // ====================================================================
    
    ipcMain.handle('get-deleted-job-orders', async (event) => {
        return queries.getDeletedJobOrders();
    });

    ipcMain.handle('restore-job-order', async (event, { user, id }) => {
        const result = await queries.restoreJobOrder(id);
        if (result.success) {
            logAction(user, 'restore_job', 'job_orders', id);
        }
        return result;
    });

    // ====================================================================
    // PLACEMENTS
    // ====================================================================
    
    ipcMain.handle('get-deleted-placements', async (event) => {
        return queries.getDeletedPlacements();
    });

    ipcMain.handle('restore-placement', async (event, { user, id }) => {
        const result = await queries.restorePlacement(id);
        if (result.success) {
            logAction(user, 'restore_placement', 'placements', id);
        }
        return result;
    });

    // ====================================================================
    // PASSPORTS
    // ====================================================================
    
    ipcMain.handle('get-deleted-passports', async (event) => {
        return queries.getDeletedPassports();
    });

    ipcMain.handle('restore-passport', async (event, { user, id }) => {
        const result = await queries.restorePassport(id);
        if (result.success) {
            logAction(user, 'restore_passport', 'passport_tracking', id);
        }
        return result;
    });

    // ====================================================================
    // VISAS
    // ====================================================================
    
    ipcMain.handle('get-deleted-visas', async (event) => {
        return queries.getDeletedVisas();
    });

    ipcMain.handle('restore-visa', async (event, { user, id }) => {
        const result = await queries.restoreVisa(id);
        if (result.success) {
            logAction(user, 'restore_visa', 'visa_tracking', id);
        }
        return result;
    });

    // ====================================================================
    // MEDICAL
    // ====================================================================
    
    ipcMain.handle('get-deleted-medical', async (event) => {
        return queries.getDeletedMedical();
    });

    ipcMain.handle('restore-medical', async (event, { user, id }) => {
        const result = await queries.restoreMedical(id);
        if (result.success) {
            logAction(user, 'restore_medical', 'medical_tracking', id);
        }
        return result;
    });

    // ====================================================================
    // INTERVIEWS
    // ====================================================================
    
    ipcMain.handle('get-deleted-interviews', async (event) => {
        return queries.getDeletedInterviews();
    });

    ipcMain.handle('restore-interview', async (event, { user, id }) => {
        const result = await queries.restoreInterview(id);
        if (result.success) {
            logAction(user, 'restore_interview', 'interview_tracking', id);
        }
        return result;
    });

    // ====================================================================
    // TRAVEL
    // ====================================================================
    
    ipcMain.handle('get-deleted-travel', async (event) => {
        return queries.getDeletedTravel();
    });

    ipcMain.handle('restore-travel', async (event, { user, id }) => {
        const result = await queries.restoreTravel(id);
        if (result.success) {
            logAction(user, 'restore_travel', 'travel_tracking', id);
        }
        return result;
    });

    // ====================================================================
    // PERMANENT DELETION
    // ====================================================================
    
    ipcMain.handle('delete-permanently', async (event, { user, id, targetType }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Super Admin only.' };
            }

            const db = getDatabase();
            let tableName;

            switch (targetType) {
                case 'required_doc':
                case 'required_docs':
                    tableName = 'required_documents';
                    break;
                case 'candidate':
                case 'candidates':
                    tableName = 'candidates';
                    break;
                case 'employer':
                case 'employers':
                    tableName = 'employers';
                    break;
                case 'job':
                case 'jobs':
                case 'job_orders':
                    tableName = 'job_orders';
                    break;
                case 'placement':
                case 'placements':
                    tableName = 'placements';
                    break;
                case 'passport':
                case 'passports':
                    tableName = 'passport_tracking';
                    break;
                case 'visa':
                case 'visas':
                    tableName = 'visa_tracking';
                    break;
                case 'medical':
                case 'medical_records':
                    tableName = 'medical_tracking';
                    break;
                case 'interview':
                case 'interviews':
                    tableName = 'interview_tracking';
                    break;
                case 'travel':
                case 'travels':
                    tableName = 'travel_tracking';
                    break;
                default:
                    return { success: false, error: `Unknown target type: ${targetType}` };
            }

            await new Promise((resolve, reject) => {
                db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            logAction(user, 'permanent_delete', tableName, id);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    console.log('✅ Recycle Bin Handlers Registered');
}

module.exports = { registerRecycleBinHandlers };
