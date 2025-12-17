// src/services/queries/auditQueries.js
// 🔍 Audit Trail - System + Candidate History
// getSystemAuditLog (admin) + getAuditLogForCandidate (all roles)

const getDatabase = require('../database.cjs');
const { dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Main audit log query (SystemAuditLogPage.jsx → getSystemAuditLog)
 * Admin/SuperAdmin only + username/action filters + pagination
 */
async function getSystemAuditLog({ user, userFilter = '', actionFilter = '', limit = 30, offset = 0 }) {
  // Step 1: Authentication check
  if (!user) {
    return {
      success: false,
      error: mapErrorToFriendly('Authentication required. No user session found.')
    };
  }

  // Step 2: Validate user object
  if (!user.role || !user.username) {
    return {
      success: false,
      error: mapErrorToFriendly('Invalid user session. Please log in again.')
    };
  }

  // Step 3: Role permissions (admin, superadmin only)
  const allowedRoles = ['admin', 'superadmin'];
  if (!allowedRoles.includes(user.role)) {
    return {
      success: false,
      error: mapErrorToFriendly(`Access Denied. Only Admins can access audit logs. Your role: ${user.role}`)
    };
  }

  const db = getDatabase();
  let baseQuery = 'FROM auditlog';
  const dynamicParams = [];
  let conditions = [];

  // Step 4: Dynamic filters
  if (userFilter?.trim()) {
    conditions.push('username LIKE ?');
    dynamicParams.push(`%${userFilter.trim()}%`);
  }
  
  if (actionFilter?.trim()) {
    conditions.push('action LIKE ? OR targettype LIKE ? OR details LIKE ?');
    dynamicParams.push(
      `%${actionFilter.trim()}%`,
      `%${actionFilter.trim()}%`,
      `%${actionFilter.trim()}%`
    );
  }

  if (conditions.length > 0) {
    baseQuery = `WHERE ${conditions.join(' AND ')} ${baseQuery}`;
  }

  // Step 5: Execute query
  try {
    // Get total count
    const countRow = await dbAll(db, `
      SELECT COUNT(*) as totalCount ${baseQuery}
    `, dynamicParams);
    const totalCount = countRow[0]?.totalCount || 0;

    // Get paginated data
    let fetchQuery = `
      SELECT * ${baseQuery} 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    const finalParams = [...dynamicParams, limit, offset];

    const rows = await dbAll(db, fetchQuery, finalParams);

    return {
      success: true,
      data: rows,
      totalCount,
      user: { username: user.username, role: user.role }
    };
  } catch (err) {
    console.error('getSystemAuditLog error:', err);
    return {
      success: false,
      error: mapErrorToFriendly('Database error')
    };
  }
}

/**
 * Candidate-specific audit logs (CandidateHistory.jsx → getAuditLogForCandidate)
 * All roles can view candidate's own history
 */
async function getAuditLogForCandidate(candidateId) {
  const db = getDatabase();
  try {
    const likeQuery = `%Candidate ${candidateId}%`;
    const sql = `
      SELECT * FROM auditlog 
      WHERE (targettype = 'candidates' AND targetid = ?) 
         OR details LIKE ?
      ORDER BY timestamp DESC
    `;
    
    const rows = await dbAll(db, sql, [candidateId, likeQuery]);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getAuditLogForCandidate error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names
module.exports = {
  getSystemAuditLog,
  getAuditLogForCandidate
};
