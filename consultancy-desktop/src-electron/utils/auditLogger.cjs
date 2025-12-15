const { getDb } = require('../db/database.cjs');

function logAction(user, action, entityType, entityId, details = null) {
  try {
    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT INTO audit_logs (userId, action, entityType, entityId, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      user?.id || null,
      action,
      entityType,
      entityId,
      details ? JSON.stringify(details) : null,
      new Date().toISOString()
    );
    
  } catch (error) {
    console.warn('Audit log failed:', error.message);
    // Don't throw - logging should never break the app
  }
}

module.exports = { logAction };
