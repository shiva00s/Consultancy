const { getDatabase } = require('../database.cjs');
const { dbRun, dbAll } = require('./dbHelpers.cjs');

async function getDeletedCandidates() {
    const db = getDatabase();
    const sql = 'SELECT id, name, Position, createdAt, isDeleted FROM candidates WHERE isDeleted = 1 ORDER BY createdAt DESC';
    try {
        const rows = await dbAll(db, sql, []);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function restoreCandidate(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'BEGIN TRANSACTION');
        await dbRun(db, 'UPDATE candidates SET isDeleted = 0 WHERE id = ?', [id]);
        await dbRun(db, 'UPDATE documents SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE placements SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE visa_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE payments SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE medical_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE interview_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'UPDATE travel_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'COMMIT');
        return { success: true };
    } catch (err) {
        await dbRun(db, 'ROLLBACK');
        return { success: false, error: err.message };
    }
}

async function getDeletedEmployers() {
    const db = getDatabase();
    const sql = 'SELECT * FROM employers WHERE isDeleted = 1 ORDER BY companyName ASC';
    try {
        const rows = await dbAll(db, sql, []);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function restoreEmployer(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'BEGIN TRANSACTION');
        await dbRun(db, 'UPDATE employers SET isDeleted = 0 WHERE id = ?', [id]);
        await dbRun(db, 'UPDATE job_orders SET isDeleted = 0 WHERE employer_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'COMMIT');
        return { success: true };
    } catch (err) {
        await dbRun(db, 'ROLLBACK');
        return { success: false, error: err.message };
    }
}

async function getDeletedJobOrders() {
    const db = getDatabase();
    const sql = `
        SELECT j.*, e.companyName 
        FROM job_orders j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.isDeleted = 1 
        ORDER BY j.positionTitle ASC
    `;
    try {
        const rows = await dbAll(db, sql, []);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function restoreJobOrder(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'BEGIN TRANSACTION');
        await dbRun(db, 'UPDATE job_orders SET isDeleted = 0 WHERE id = ?', [id]);
        await dbRun(db, 'UPDATE placements SET isDeleted = 0 WHERE job_order_id = ? AND isDeleted = 1', [id]);
        await dbRun(db, 'COMMIT');
        return { success: true };
    } catch (err) {
        await dbRun(db, 'ROLLBACK');
        return { success: false, error: err.message };
    }
}

async function deletePermanently(id, targetType) {
    const db = getDatabase();
    let sql;
    let identifier;

    switch (targetType) {
        case 'candidates':
            sql = 'DELETE FROM candidates WHERE id = ?';
            identifier = 'candidate';
            break;
        case 'employers':
            sql = 'DELETE FROM employers WHERE id = ?';
            identifier = 'employer';
            break;
        case 'job_orders':
            sql = 'DELETE FROM job_orders WHERE id = ?';
            identifier = 'job order';
            break;
        default:
            return { success: false, error: 'Invalid target type for permanent deletion.' };
    }

    try {
        const result = await dbRun(db, sql, [id]);
        if (result.changes === 0) {
            return { success: false, error: `${identifier} not found.` };
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    getDeletedCandidates,
    restoreCandidate,
    getDeletedEmployers,
    restoreEmployer,
    getDeletedJobOrders,
    restoreJobOrder,
    deletePermanently,
};
