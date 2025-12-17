// src/services/queries/visaKanbanQueries.js
// 🛂 Visa Kanban Board for VisaKanbanPage.jsx
// Drag-drop status updates + active visas only

const getDatabase = require('../database.cjs');
const { dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get all active visas (VisaKanbanPage.jsx → getAllActiveVisas)
 * JOIN candidates + isDeleted=0 only + drag-drop ready
 */
async function getAllActiveVisas() {
  const db = getDatabase();
  try {
    const sql = `
      SELECT 
        v.id, v.candidateid, v.country, v.visatype, v.status, 
        v.applicationdate, c.name as candidateName, c.passportNo
      FROM visatracking v 
      JOIN candidates c ON v.candidateid = c.id 
      WHERE v.isDeleted = 0 AND c.isDeleted = 0 
      ORDER BY v.applicationdate DESC
    `;
    
    const rows = await dbAll(db, sql);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getAllActiveVisas error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update visa status on drag-drop (VisaKanbanPage.jsx → updateVisaStatus)
 * 7 statuses: Pending/Submitted/Biometrics Done/In Progress/Approved/Rejected/Cancelled
 */
async function updateVisaStatus(id, status) {
  const db = getDatabase();
  
  // Validate status
  const validStatuses = [
    'Pending', 'Submitted', 'Biometrics Done', 
    'In Progress', 'Approved', 'Rejected', 'Cancelled'
  ];
  
  if (!validStatuses.includes(status)) {
    return {
      success: false,
      error: mapErrorToFriendly('Invalid visa status.')
    };
  }
  
  try {
    const result = await dbRun(db, `
      UPDATE visatracking 
      SET status = ? 
      WHERE id = ? AND isDeleted = 0
    `, [status, id]);
    
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly('Visa entry not found.')
      };
    }
    
    return { success: true };
  } catch (err) {
    console.error('updateVisaStatus error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from VisaKanbanPage.jsx
module.exports = {
  getAllActiveVisas,
  updateVisaStatus
};
