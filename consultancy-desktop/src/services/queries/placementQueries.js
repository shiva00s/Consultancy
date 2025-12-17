// src/services/queries/placementQueries.js
// 👥 Candidate-Job Placement Management for CandidateJobs.jsx
// getCandidatePlacements + getUnassignedJobs + assign/remove

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get candidate's active placements (CandidateJobs.jsx → getCandidatePlacements)
 * JOIN joborders + employers for full job details
 */
async function getCandidatePlacements(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      p.id as placementId,
      p.status as placementStatus,
      p.assignedAt as assignedDate,
      j.id as jobId,
      j.positionTitle,
      e.companyName,
      e.country
    FROM placements p
    LEFT JOIN joborders j ON p.joborderid = j.id
    LEFT JOIN employers e ON j.employerid = e.id
    WHERE p.candidateid = ? AND p.isDeleted = 0
    ORDER BY p.assignedAt DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getCandidatePlacements error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get unassigned jobs for candidate (CandidateJobs.jsx → getUnassignedJobs)
 * Jobs NOT already assigned to this candidate
 */
async function getUnassignedJobs(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      j.id,
      j.positionTitle,
      e.companyName,
      e.country
    FROM joborders j
    JOIN employers e ON j.employerid = e.id
    WHERE j.isDeleted = 0 
      AND j.id NOT IN (
        SELECT joborderid 
        FROM placements 
        WHERE candidateid = ? AND isDeleted = 0
      )
    ORDER BY e.companyName, j.positionTitle
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getUnassignedJobs error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Assign candidate to job (CandidateJobs.jsx → assignCandidateToJob)
 * Prevents duplicate assignments + auto-status "Assigned"
 */
async function assignCandidateToJob(user, candidateId, jobOrderId) {
  const db = getDatabase();
  
  // Check for existing assignment
  const checkSql = `
    SELECT id FROM placements 
    WHERE candidateid = ? AND joborderid = ? AND isDeleted = 0
  `;
  
  try {
    const existing = await dbGet(db, checkSql, [candidateId, jobOrderId]);
    if (existing) {
      return {
        success: false,
        error: mapErrorToFriendly('Candidate already assigned to this job.')
      };
    }
    
    const insertSql = `
      INSERT INTO placements (candidateid, joborderid, assignedAt, status)
      VALUES (?, ?, datetime('now'), 'Assigned')
    `;
    
    await dbRun(db, insertSql, [candidateId, jobOrderId]);
    
    return {
      success: true
    };
  } catch (err) {
    console.error('assignCandidateToJob error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Remove candidate from job (CandidateJobs.jsx → removeCandidateFromJob)
 * Soft delete → Recycle Bin
 */
async function removeCandidateFromJob(user, placementId) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, joborderid 
      FROM placements 
      WHERE id = ? AND isDeleted = 0
    `, [placementId]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Placement not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE placements 
      SET isDeleted = 1 
      WHERE id = ?
    `, [placementId]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      jobId: row.joborderid
    };
  } catch (err) {
    console.error('removeCandidateFromJob error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateJobs.jsx
module.exports = {
  getCandidatePlacements,
  getUnassignedJobs,
  assignCandidateToJob,
  removeCandidateFromJob
};
