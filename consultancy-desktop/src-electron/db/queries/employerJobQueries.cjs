const { getDatabase } = require('../database.cjs');
const { dbRun, dbGet, dbAll } = require('./dbHelpers.cjs');
const { validateRequired, validateEmail } = require('./validationHelpers.cjs');
const { checkAdminFeatureAccess } = require('./userAuthQueries.cjs');

async function getEmployers() {
    const db = getDatabase();
    try {
        const rows = await dbAll(db, 'SELECT * FROM employers WHERE isDeleted = 0 ORDER BY companyName ASC', []);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function addEmployer(user, data) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const errors = {};
    if (validateRequired(data.companyName, 'Company Name')) errors.companyName = validateRequired(data.companyName, 'Company Name');
    if (data.contactEmail && !validateEmail(data.contactEmail)) errors.contactEmail = 'Contact Email must be valid.';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO employers (companyName, country, contactPerson, contactEmail, notes) 
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [
        data.companyName, data.country, data.contactPerson,
        data.contactEmail, data.notes,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const newId = result.lastID;
        return { success: true, id: newId, data: { ...data, id: newId } };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function updateEmployer(user, id, data) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const errors = {};
    if (validateRequired(data.companyName, 'Company Name')) errors.companyName = validateRequired(data.companyName, 'Company Name');
    if (data.contactEmail && !validateEmail(data.contactEmail)) errors.contactEmail = 'Contact Email must be valid.';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `UPDATE employers SET 
                 companyName = ?, country = ?, contactPerson = ?, contactEmail = ?, notes = ?
                 WHERE id = ?`;
    const params = [
        data.companyName, data.country, data.contactPerson,
        data.contactEmail, data.notes, id,
    ];
    try {
        await dbRun(db, sql, params);
        return { success: true, id: id, data: data };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function deleteEmployer(user, id) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
    if (!accessCheck.success) return accessCheck;

    const db = getDatabase();
    try {
        await dbRun(db, 'BEGIN TRANSACTION');
        await dbRun(db, 'UPDATE employers SET isDeleted = 1 WHERE id = ?', [id]);
        await dbRun(db, 'UPDATE job_orders SET isDeleted = 1 WHERE employer_id = ?', [id]);
        await dbRun(db, 'COMMIT');
        return { success: true };
    } catch (err) {
        await dbRun(db, 'ROLLBACK');
        return { success: false, error: err.message };
    }
}

async function getJobOrders() {
    const db = getDatabase();
    try {
        const sql = `
            SELECT 
                j.*, 
                e.companyName 
            FROM job_orders j
            LEFT JOIN employers e ON j.employer_id = e.id
            WHERE j.isDeleted = 0
            ORDER BY j.createdAt DESC
        `;
        const rows = await dbAll(db, sql, []);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function addJobOrder(user, data) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
    if (!accessCheck.success) return accessCheck;

    const errors = {};
    if (validateRequired(data.employer_id, 'Employer ID')) errors.employer_id = 'Employer is required.';
    if (validateRequired(data.positionTitle, 'Position Title')) errors.positionTitle = 'Position Title is required.';
    const openings = parseInt(data.openingsCount, 10);
    if (isNaN(openings) || openings < 1) errors.openingsCount = 'Openings must be at least 1.';

    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO job_orders (employer_id, positionTitle, country, openingsCount, status, requirements) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [
        data.employer_id, data.positionTitle, data.country,
        data.openingsCount, data.status, data.requirements,
    ];

    try {
        const result = await dbRun(db, sql, params);
        const newJobId = result.lastID;
        
        const getSql = `
            SELECT j.*, e.companyName 
            FROM job_orders j
            LEFT JOIN employers e ON j.employer_id = e.id
            WHERE j.id = ?
        `;
        const row = await dbGet(db, getSql, [newJobId]);
        return { success: true, id: newJobId, data: row };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function updateJobOrder(user, id, data) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
    if (!accessCheck.success) return accessCheck;

    const errors = {};
    if (!data.employer_id) errors.employer_id = 'Employer is required.';
    if (!data.positionTitle) errors.positionTitle = 'Position Title is required.';
    
    const openings = parseInt(data.openingsCount, 10);
    if (isNaN(openings) || openings < 1) errors.openingsCount = 'Openings must be at least 1.';

    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    
    const sql = `UPDATE job_orders SET 
                 employer_id = ?, positionTitle = ?, country = ?, openingsCount = ?, status = ?, requirements = ?
                 WHERE id = ?`;
                   
    const params = [
        data.employer_id, 
        data.positionTitle, 
        data.country,
        data.openingsCount, 
        data.status, 
        data.requirements, 
        id,
    ];

    try {
        await dbRun(db, sql, params);
        
        const getSql = `
            SELECT j.*, e.companyName 
            FROM job_orders j
            LEFT JOIN employers e ON j.employer_id = e.id
            WHERE j.id = ?
        `;
        const row = await dbGet(db, getSql, [id]);
        return { success: true, id: id, data: row };
    } catch (err) {
        console.error("Update Job Error:", err.message);
        return { success: false, error: err.message };
    }
}

async function deleteJobOrder(user, id) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
    if (!accessCheck.success) return accessCheck;

    const db = getDatabase();

    try {
        await dbRun(db, 'BEGIN TRANSACTION');
        
        await dbRun(db, 'UPDATE job_orders SET isDeleted = 1 WHERE id = ?', [id]);
        
        await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE job_order_id = ?', [id]);
        
        await dbRun(db, 'COMMIT');
        return { success: true };
    } catch (err) {
        await dbRun(db, 'ROLLBACK');
        console.error("Delete Job Error:", err.message);
        return { success: false, error: err.message };
    }
}

async function getCandidatePlacements(candidateId) {
    const db = getDatabase();
    const sql = `
        SELECT 
            p.id as placementId, p.status as placementStatus,
            j.id as jobId, j.positionTitle, 
            e.companyName, e.country
        FROM placements p
        JOIN job_orders j ON p.job_order_id = j.id
        JOIN employers e ON j.employer_id = e.id
        WHERE p.candidate_id = ? AND p.isDeleted = 0
    `;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function getUnassignedJobs(candidateId) {
    const db = getDatabase();
    const sql = `
        SELECT 
            j.id, j.positionTitle, 
            e.companyName, e.country
        FROM job_orders j
        JOIN employers e ON j.employer_id = e.id
        WHERE j.isDeleted = 0 AND j.id NOT IN (
            SELECT job_order_id FROM placements WHERE candidate_id = ? AND isDeleted = 0
        )
        ORDER BY e.companyName, j.positionTitle
    `;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function assignCandidateToJob(candidateId, jobId) {
    const db = getDatabase();
    const sql = `INSERT INTO placements (candidate_id, job_order_id) VALUES (?, ?)`;
    try {
        const result = await dbRun(db, sql, [candidateId, jobId]);
        const newPlacementId = result.lastID;
        const getSql = `
            SELECT 
                p.id as placementId, p.status as placementStatus,
                j.id as jobId, j.positionTitle, 
                e.companyName, e.country
            FROM placements p
            JOIN job_orders j ON p.job_order_id = j.id
            JOIN employers e ON j.employer_id = e.id
            WHERE p.id = ?
        `;
        const row = await dbGet(db, getSql, [newPlacementId]);
        return { success: true, data: row };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return { success: false, error: 'Candidate already assigned to this job.' };
        }
        return { success: false, error: err.message };
    }
}

async function removeCandidateFromJob(placementId) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, job_order_id FROM placements WHERE id = ?', [placementId]);
        if (!row) {
            return { success: false, error: 'Placement not found.' };
        }
        await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE id = ?', [placementId]);
        return { success: true, candidateId: row.candidate_id, jobId: row.job_order_id };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    getEmployers,
    addEmployer,
    updateEmployer,
    deleteEmployer,
    getJobOrders,
    addJobOrder,
    updateJobOrder,
    deleteJobOrder,
    getCandidatePlacements,
    getUnassignedJobs,
    assignCandidateToJob,
    removeCandidateFromJob,
};
