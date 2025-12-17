// src/services/queries/interviewQueries.js
// 🎯 Interview Tracking for CandidateInterview.jsx
// CRUD + Job Order JOIN + Status (Scheduled/Passed/Failed/Cancelled)

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Get candidate interviews (CandidateInterview.jsx → getInterviewTracking)
 * JOIN joborders + employers for positionTitle/companyName
 */
async function getInterviewTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      i.*,
      j.positionTitle,
      e.companyName
    FROM interviewtracking i
    LEFT JOIN joborders j ON i.joborderid = j.id
    LEFT JOIN employers e ON j.employerid = e.id
    WHERE i.candidateid = ? AND i.isDeleted = 0
    ORDER BY i.interviewdate DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getInterviewTracking error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add interview (CandidateInterview.jsx → addInterviewEntry)
 * Validates joborderid + interviewdate required
 */
async function addInterviewEntry(user, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.joborderid, 'Job Order')) {
    errors.joborderid = validateRequired(data.joborderid, 'Job Order');
  }
  if (validateRequired(data.interviewdate, 'Interview Date')) {
    errors.interviewdate = validateRequired(data.interviewdate, 'Interview Date');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    INSERT INTO interviewtracking (
      candidateid, joborderid, interviewdate, round, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.candidateid,
    data.joborderid,
    data.interviewdate,
    data.round || '1st Round',
    data.status || 'Scheduled',
    data.notes || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const getSql = `
      SELECT i.*, j.positionTitle, e.companyName 
      FROM interviewtracking i
      LEFT JOIN joborders j ON i.joborderid = j.id
      LEFT JOIN employers e ON j.employerid = e.id
      WHERE i.id = ?
    `;
    const row = await dbGet(db, getSql, [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addInterviewEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update interview (CandidateInterview.jsx → updateInterviewEntry)
 * Partial updates via InterviewEditModal
 */
async function updateInterviewEntry(id, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.joborderid, 'Job Order')) {
    errors.joborderid = validateRequired(data.joborderid, 'Job Order');
  }
  if (validateRequired(data.interviewdate, 'Interview Date')) {
    errors.interviewdate = validateRequired(data.interviewdate, 'Interview Date');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  
  try {
    // Verify exists
    const row = await dbGet(db, `
      SELECT candidateid, joborderid 
      FROM interviewtracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Interview entry not found.')
      };
    }
    
    const sql = `
      UPDATE interviewtracking 
      SET joborderid = COALESCE(?, joborderid),
          interviewdate = COALESCE(?, interviewdate),
          round = COALESCE(?, round),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes)
      WHERE id = ? AND isDeleted = 0
    `;
    
    const params = [
      data.joborderid,
      data.interviewdate,
      data.round,
      data.status,
      data.notes,
      id
    ];
    
    await dbRun(db, sql, params);
    
    const getSql = `
      SELECT i.*, j.positionTitle, e.companyName 
      FROM interviewtracking i
      LEFT JOIN joborders j ON i.joborderid = j.id
      LEFT JOIN employers e ON j.employerid = e.id
      WHERE i.id = ?
    `;
    const updatedRow = await dbGet(db, getSql, [id]);
    
    return {
      success: true,
      data: updatedRow
    };
  } catch (err) {
    console.error('updateInterviewEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete interview (CandidateInterview.jsx → deleteInterviewEntry)
 * Moves to Recycle Bin
 */
async function deleteInterviewEntry(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, interviewdate, round 
      FROM interviewtracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Interview entry not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE interviewtracking 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      interviewdate: row.interviewdate,
      round: row.round
    };
  } catch (err) {
    console.error('deleteInterviewEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateInterview.jsx
module.exports = {
  getInterviewTracking,
  addInterviewEntry,
  updateInterviewEntry,
  deleteInterviewEntry
};
