const { getDatabase } = require('../db/database.cjs');

const logAction = (user, action, target_type, target_id, details = null) => {
    try {
        const db = getDatabase();
        if (!db) {
            console.error('Audit Log: Database is not initialized.');
            return;
        }
        
        if (!user || !user.id) {
            console.warn('Audit Log: User ID missing. Skipping log for action:', action);
            return;
        }

        const safeUsername = user.username || `User_${user.id}`;

        const sql = `INSERT INTO audit_log (user_id, username, action, target_type, target_id, details)
                     VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [user.id, safeUsername, action, target_type, target_id, details], (err) => {
            if (err) {
                console.error('Failed to write to audit_log:', err.message);
            }
        });
    } catch (e) {
        console.error('Critical error in logAction:', e.message);
    }
};

module.exports = { logAction };
