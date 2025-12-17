// src/services/queries/whatsappBulkQueries.js
// 📱 WhatsApp Bulk Messaging for WhatsAppBulkPage.jsx
// Candidate list + single/bulk WhatsApp integration

const getDatabase = require('../database.cjs');
const { dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get candidates for WhatsApp bulk (WhatsAppBulkPage.jsx → getDetailedReportList)
 * Filters: name/position/status/employer + JOINs for full data
 */
async function getDetailedReportList(user, filters = {}) {
  // Admin permission check (uses existing checkAdminFeatureAccess)
  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    const accessCheck = await require('./userQueries.cjs').checkAdminFeatureAccess(user, 'canViewReports');
    if (!accessCheck.success) {
      return {
        success: false,
        error: mapErrorToFriendly(accessCheck.error)
      };
    }
  }

  const db = getDatabase();
  const { searchTerm = '', position = '', status = '', employer = '' } = filters;
  
  let sql = `
    SELECT 
      c.id, c.name, c.passportNo, c.Position, c.status, c.contact,
      COALESCE(e.companyName, 'Unassigned') as companyName
    FROM candidates c 
    LEFT JOIN placements pl ON pl.candidateid = c.id AND pl.isDeleted = 0
    LEFT JOIN joborders j ON pl.joborderid = j.id 
    LEFT JOIN employers e ON j.employerid = e.id 
    WHERE c.isDeleted = 0
  `;
  
  const params = [];
  
  // Dynamic filters
  if (searchTerm) {
    sql += ` AND (c.name LIKE ? OR c.passportNo LIKE ? OR c.contact LIKE ?)`;
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }
  
  if (position && position !== 'All Positions') {
    sql += ` AND c.Position LIKE ?`;
    params.push(`%${position}%`);
  }
  
  if (status && status !== 'All Statuses') {
    sql += ` AND c.status = ?`;
    params.push(status);
  }
  
  if (employer && employer !== 'All Employers') {
    sql += ` AND e.companyName = ?`;
    params.push(employer);
  }
  
  sql += ` GROUP BY c.id ORDER BY c.name ASC`;
  
  try {
    const rows = await dbAll(db, sql, params);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('Detailed Report Query Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get all job orders for position dropdown (WhatsAppBulkPage.jsx → getJobOrders)
 */
async function getJobOrders() {
  const db = getDatabase();
  try {
    const sql = `
      SELECT DISTINCT positionTitle 
      FROM joborders 
      WHERE isDeleted = 0 
      ORDER BY positionTitle ASC
    `;
    
    const rows = await dbAll(db, sql);
    return {
      success: true,
      data: rows.map(row => row.positionTitle).filter(Boolean)
    };
  } catch (err) {
    console.error('getJobOrders error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from WhatsAppBulkPage.jsx
module.exports = {
  getDetailedReportList,
  getJobOrders
};
