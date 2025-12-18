/**
 * logAction.cjs
 * Centralized audit logging utility for tracking all user actions
 */

const { getDatabase } = require('./database.cjs');

/**
 * Log user action to audit trail
 * @param {Object} user - User object with id, username, role
 * @param {String} action - Action performed (e.g., 'create', 'update', 'delete', 'view')
 * @param {String} targetType - Type of target (e.g., 'candidates', 'employers', 'joborders')
 * @param {Number} targetId - ID of the affected record
 * @param {String} details - Additional details about the action
 * @param {String} ipAddress - Optional IP address
 */
function logAction(user, action, targetType, targetId, details = '', ipAddress = null) {
  if (!user || !user.id) {
    console.warn('⚠️ logAction: No user provided, skipping audit log');
    return;
  }

  const db = getDatabase();
  
  const sql = `
    INSERT INTO auditlog (
      userid, 
      username, 
      userrole, 
      action, 
      targettype, 
      targetid, 
      details, 
      ipaddress, 
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `;

  const params = [
    user.id,
    user.username || user.fullName || 'Unknown',
    user.role || 'user',
    action,
    targetType,
    targetId || null,
    details || '',
    ipAddress || null
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error('❌ Audit log error:', err);
    } else {
      console.log(`📝 Audit: [${user.username}] ${action} ${targetType}#${targetId} - ${details}`);
    }
  });
}

/**
 * Log authentication events (login, logout, failed attempts)
 * @param {String} username - Username attempting action
 * @param {String} action - Action performed ('login_success', 'login_failed', 'logout')
 * @param {String} details - Additional details
 * @param {String} ipAddress - Optional IP address
 */
function logAuthAction(username, action, details = '', ipAddress = null) {
  const db = getDatabase();
  
  const sql = `
    INSERT INTO auditlog (
      userid, 
      username, 
      userrole, 
      action, 
      targettype, 
      targetid, 
      details, 
      ipaddress, 
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `;

  const params = [
    null, // No user ID for failed login attempts
    username || 'Unknown',
    'system',
    action,
    'auth',
    null,
    details || '',
    ipAddress || null
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error('❌ Auth log error:', err);
    } else {
      console.log(`🔐 Auth: ${username} - ${action}`);
    }
  });
}

/**
 * Log system events (startup, shutdown, errors)
 * @param {String} action - System action
 * @param {String} details - Event details
 */
function logSystemAction(action, details = '') {
  const db = getDatabase();
  
  const sql = `
    INSERT INTO auditlog (
      userid, 
      username, 
      userrole, 
      action, 
      targettype, 
      targetid, 
      details, 
      ipaddress, 
      timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `;

  const params = [
    null,
    'SYSTEM',
    'system',
    action,
    'system',
    null,
    details || '',
    null
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error('❌ System log error:', err);
    } else {
      console.log(`⚙️ System: ${action} - ${details}`);
    }
  });
}

/**
 * Get audit logs with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Array of audit log entries
 */
function getAuditLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    let sql = `
      SELECT 
        id,
        userid,
        username,
        userrole,
        action,
        targettype,
        targetid,
        details,
        ipaddress,
        timestamp
      FROM auditlog
      WHERE 1=1
    `;
    
    const params = [];
    
    // Apply filters
    if (filters.userId) {
      sql += ` AND userid = ?`;
      params.push(filters.userId);
    }
    
    if (filters.username) {
      sql += ` AND username LIKE ?`;
      params.push(`%${filters.username}%`);
    }
    
    if (filters.action) {
      sql += ` AND action = ?`;
      params.push(filters.action);
    }
    
    if (filters.targetType) {
      sql += ` AND targettype = ?`;
      params.push(filters.targetType);
    }
    
    if (filters.targetId) {
      sql += ` AND targetid = ?`;
      params.push(filters.targetId);
    }
    
    if (filters.startDate) {
      sql += ` AND timestamp >= ?`;
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      sql += ` AND timestamp <= ?`;
      params.push(filters.endDate);
    }
    
    // Order and limit
    sql += ` ORDER BY timestamp DESC`;
    
    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      sql += ` OFFSET ?`;
      params.push(filters.offset);
    }
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Get audit logs error:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * Get recent activity for a specific user
 * @param {Number} userId - User ID
 * @param {Number} limit - Number of records to return
 * @returns {Promise<Array>} Array of recent activities
 */
function getUserActivity(userId, limit = 50) {
  return getAuditLogs({ userId, limit });
}

/**
 * Get recent activity for a specific target
 * @param {String} targetType - Type of target
 * @param {Number} targetId - Target ID
 * @param {Number} limit - Number of records to return
 * @returns {Promise<Array>} Array of activities
 */
function getTargetActivity(targetType, targetId, limit = 50) {
  return getAuditLogs({ targetType, targetId, limit });
}

/**
 * Clear old audit logs (for maintenance)
 * @param {Number} daysToKeep - Number of days of logs to keep
 * @returns {Promise<Object>} Result with count of deleted records
 */
function clearOldLogs(daysToKeep = 90) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      DELETE FROM auditlog 
      WHERE timestamp < datetime('now', '-${daysToKeep} days', 'localtime')
    `;
    
    db.run(sql, function(err) {
      if (err) {
        console.error('❌ Clear old logs error:', err);
        reject(err);
      } else {
        console.log(`🗑️ Cleared ${this.changes} old audit log entries`);
        resolve({ success: true, deleted: this.changes });
      }
    });
  });
}

module.exports = {
  logAction,
  logAuthAction,
  logSystemAction,
  getAuditLogs,
  getUserActivity,
  getTargetActivity,
  clearOldLogs
};
