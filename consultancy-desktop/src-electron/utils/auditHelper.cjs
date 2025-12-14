const { getDatabase } = require('../db/database.cjs');

/**
 * Writes an audit log entry.
 * Used by all handlers globally.
 *
 * @param {Object} user - Logged-in user object
 * @param {String} action - Action keyword
 * @param {String} targetType - Table/entity name
 * @param {Number} targetId - ID of target entity
 * @param {String|null} details - Optional JSON/text details
 */
async function logAction(user, action, targetType, targetId, details = null) {
    try {
        const db = getDatabase();
        if (!db) {
            console.error('Audit Log: Database not initialized.');
            return;
        }

        if (!user || !user.id) {
            console.warn('Audit Log Skipped: Invalid user object.', {
                action,
                targetType,
                targetId,
            });
            return;
        }

        const username = user.username || `User_${user.id}`;

        return new Promise((resolve) => {
            const sql = `
                INSERT INTO audit_log (user_id, username, action, target_type, target_id, details)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            db.run(
                sql,
                [user.id, username, action, targetType, targetId, details],
                (err) => {
                    if (err) {
                        console.error('Audit Log Failed:', err.message, {
                            user_id: user.id,
                            action,
                            targetType,
                            targetId,
                        });
                    }
                    resolve(true);
                }
            );
        });
    } catch (err) {
        console.error('Audit Log Exception:', err.message);
    }
}


async function addAuditEvent({ userId, action, details }) {
    try {
        const db = getDatabase();
        if (!db) return;

        if (!userId || !action) {
            console.warn('Audit Event Skipped: Missing userId or action');
            return;
        }

        return new Promise((resolve) => {
            const sql = `
                INSERT INTO audit_log (user_id, action, details)
                VALUES (?, ?, ?)
            `;
            db.run(sql, [userId, action, details || null], (err) => {
                if (err) {
                    console.error('Audit Event Insert Error:', err.message);
                }
                resolve(true);
            });
        });
    } catch (err) {
        console.error('Audit Event Exception:', err.message);
    }
}

module.exports = {
    logAction,
    addAuditEvent,
};
