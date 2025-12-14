const { getDatabase } = require('../database.cjs');
const { dbRun, dbGet, dbAll } = require('./dbHelpers.cjs');

async function getRequiredDocuments() {
    const db = getDatabase();
    try {
        const rows = await dbAll(db, 'SELECT * FROM required_documents WHERE isDeleted = 0 ORDER BY name ASC', []);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addRequiredDocument(name) {
    const db = getDatabase();
    if (!name || name.trim() === '') {
        return { success: false, error: 'Document name is required.' };
    }
    try {
        const result = await dbRun(db, 'INSERT INTO required_documents (name) VALUES (?)', [name]);
        const row = await dbGet(db, 'SELECT * FROM required_documents WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return { success: false, error: 'Document name already exists.' };
        }
        return { success: false, error: err.message };
    }
}

async function deleteRequiredDocument(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'UPDATE required_documents SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
}

async function getActivationStatus() {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'license_status'", []);
        if (row && row.value) {
            return { success: true, status: JSON.parse(row.value) };
        }
        return { success: true, status: { activated: false, machineId: null } }; 
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function setActivationStatus(statusData) {
    const db = getDatabase();
    const statusJson = JSON.stringify(statusData);
    return new Promise((resolve, reject) => {
        db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', ?)", [statusJson], (err) => {
            if (err) reject(err);
            else resolve({ success: true });
        });
    });
}

/**
 * Fetches the global feature flags set by the Super Admin.
 */
async function getFeatureFlagsFromDb() {
    const defaultFlags = {
        isEmployersEnabled: true,
        isJobsEnabled: true,
        isVisaKanbanEnabled: true, 
        isDocumentsEnabled: true,
        isVisaTrackingEnabled: true,
        isFinanceTrackingEnabled: true,
        isMedicalEnabled: true,
        isInterviewEnabled: true,
        isTravelEnabled: true,
        isHistoryEnabled: true,
        isBulkImportEnabled: true,           
        isMobileAccessEnabled: true,             
        canViewReports: true,
        canAccessSettings: true,
        canAccessRecycleBin: true,
        canDeletePermanently: true,
    };
    
    try {
        const db = getDatabase();
        const row = await dbGet(db, "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1", []);
        if (!row || !row.features) {
            return { success: true, data: defaultFlags };
        }
        const storedFlags = JSON.parse(row.features);
        const mergedFlags = { ...defaultFlags, ...storedFlags };
        return { success: true, data: mergedFlags };
    } catch (e) {
        console.error('Failed to parse stored feature flags data:', e.message);
        return { success: false, error: 'Failed to parse stored feature flags data.' };
    }
}

/**
 * Saves the global feature flags, only applicable for Super Admin.
 * @param {object} flags The feature flags object to save.
 */
async function saveFeatureFlagsToDb(flags) {
    const featuresJson = JSON.stringify(flags);
    try {
        const db = getDatabase();
        await dbRun(db, "UPDATE users SET features = ? WHERE role = 'super_admin'", [featuresJson]);
        return { success: true };
    } catch (err) {
        console.error('Failed to save feature flags:', err.message);
        return { success: false, error: err.message };
    }
}


module.exports = {
    getRequiredDocuments,
    addRequiredDocument,
    deleteRequiredDocument,
    getActivationStatus,
    setActivationStatus,
    getFeatureFlagsFromDb, // NEW: Export the new function
    saveFeatureFlagsToDb,   // NEW: Export the new function
};
