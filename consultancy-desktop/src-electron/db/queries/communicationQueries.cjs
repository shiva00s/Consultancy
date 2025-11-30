const { getDatabase } = require('../database.cjs');
const { dbRun, dbAll } = require('./dbHelpers.cjs');

async function logCommunication(user, candidateId, type, details) {
    const db = getDatabase();
    try {
        await dbRun(db, 'INSERT INTO communication_logs (candidate_id, user_id, type, details) VALUES (?, ?, ?, ?)', 
            [candidateId, user.id, type, details]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message };
    }
}

async function getCommLogs(candidateId) {
    const db = getDatabase();
    try {
        const rows = await dbAll(db, `
            SELECT c.*, u.username 
            FROM communication_logs c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.candidate_id = ? ORDER BY c.timestamp DESC`, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message };
    }
}

module.exports = {
    logCommunication,
    getCommLogs,
};
