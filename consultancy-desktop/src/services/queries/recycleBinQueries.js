// src/services/queries/recycleBinQueries.js
// 🗑️ Recycle Bin Management for RecycleBinPage.jsx
// getDeleted* + restore* + permanent delete (SuperAdmin only)

const getDatabase = require('../database.cjs');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get deleted candidates (RecycleBinPage.jsx → getDeletedCandidates)
 */
async function getDeletedCandidates() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT id, name, Position, createdAt 
      FROM candidates 
      WHERE isDeleted = 1 
      ORDER BY createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedCandidates error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore candidate + cascade (RecycleBinPage.jsx → restoreCandidate)
 */
async function restoreCandidate(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Restore candidate
    await dbRun(db, `
      UPDATE candidates SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    // Cascade restore related records
    await dbRun(db, `
      UPDATE documents SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE placements SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE visatracking SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE passporttracking SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE payments SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE medicaltracking SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE interviewtracking SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    await dbRun(db, `
      UPDATE traveltracking SET isDeleted = 0 WHERE candidateid = ? AND isDeleted = 1
    `, [id]);
    
    await dbRun(db, 'COMMIT');
    
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error('restoreCandidate error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted employers (RecycleBinPage.jsx → getDeletedEmployers)
 */
async function getDeletedEmployers() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM employers 
      WHERE isDeleted = 1 
      ORDER BY companyName ASC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedEmployers error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore employer + cascade jobs (RecycleBinPage.jsx → restoreEmployer)
 */
async function restoreEmployer(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Restore employer
    await dbRun(db, `
      UPDATE employers SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    // Cascade restore job orders
    await dbRun(db, `
      UPDATE joborders SET isDeleted = 0 WHERE employerid = ? AND isDeleted = 1
    `, [id]);
    
    await dbRun(db, 'COMMIT');
    
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error('restoreEmployer error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted job orders (RecycleBinPage.jsx → getDeletedJobOrders)
 */
async function getDeletedJobOrders() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT j.*, e.companyName 
      FROM joborders j 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE j.isDeleted = 1 
      ORDER BY j.positionTitle ASC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedJobOrders error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore job order + cascade placements (RecycleBinPage.jsx → restoreJobOrder)
 */
async function restoreJobOrder(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Restore job order
    await dbRun(db, `
      UPDATE joborders SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    // Cascade restore placements
    await dbRun(db, `
      UPDATE placements SET isDeleted = 0 WHERE joborderid = ? AND isDeleted = 1
    `, [id]);
    
    await dbRun(db, 'COMMIT');
    
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error('restoreJobOrder error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted placements (RecycleBinPage.jsx → getDeletedPlacements)
 */
async function getDeletedPlacements() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT p.id, c.name as candidateName, j.positionTitle as jobTitle, 
             e.companyName, p.assignedAt, p.status 
      FROM placements p 
      LEFT JOIN candidates c ON p.candidateid = c.id 
      LEFT JOIN joborders j ON p.joborderid = j.id 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE p.isDeleted = 1 
      ORDER BY p.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedPlacements error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore placement (RecycleBinPage.jsx → restorePlacement)
 */
async function restorePlacement(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE placements SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restorePlacement error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted passports (RecycleBinPage.jsx → getDeletedPassports)
 */
async function getDeletedPassports() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT pt.id, c.name as candidateName, pt.passportstatus, pt.createdAt 
      FROM passporttracking pt 
      LEFT JOIN candidates c ON pt.candidateid = c.id 
      WHERE pt.isDeleted = 1 
      ORDER BY pt.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedPassports error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore passport (RecycleBinPage.jsx → restorePassport)
 */
async function restorePassport(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE passporttracking SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restorePassport error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted visas (RecycleBinPage.jsx → getDeletedVisas)
 */
async function getDeletedVisas() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT vt.id, c.name as candidateName, vt.status, vt.createdAt 
      FROM visatracking vt 
      LEFT JOIN candidates c ON vt.candidateid = c.id 
      WHERE vt.isDeleted = 1 
      ORDER BY vt.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedVisas error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore visa (RecycleBinPage.jsx → restoreVisa)
 */
async function restoreVisa(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE visatracking SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restoreVisa error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted medical records (RecycleBinPage.jsx → getDeletedMedical)
 */
async function getDeletedMedical() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT m.id, c.name as candidateName, m.status, m.createdAt 
      FROM medicaltracking m 
      LEFT JOIN candidates c ON m.candidateid = c.id 
      WHERE m.isDeleted = 1 
      ORDER BY m.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedMedical error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore medical record (RecycleBinPage.jsx → restoreMedical)
 */
async function restoreMedical(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE medicaltracking SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restoreMedical error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted interviews (RecycleBinPage.jsx → getDeletedInterviews)
 */
async function getDeletedInterviews() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT i.id, c.name as candidateName, i.status, i.createdAt 
      FROM interviewtracking i 
      LEFT JOIN candidates c ON i.candidateid = c.id 
      WHERE i.isDeleted = 1 
      ORDER BY i.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedInterviews error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore interview (RecycleBinPage.jsx → restoreInterview)
 */
async function restoreInterview(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE interviewtracking SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restoreInterview error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted travel records (RecycleBinPage.jsx → getDeletedTravel)
 */
async function getDeletedTravel() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT t.id, c.name as candidateName, t.createdAt 
      FROM traveltracking t 
      LEFT JOIN candidates c ON t.candidateid = c.id 
      WHERE t.isDeleted = 1 
      ORDER BY t.createdAt DESC
    `);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getDeletedTravel error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Restore travel record (RecycleBinPage.jsx → restoreTravel)
 */
async function restoreTravel(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, `
      UPDATE traveltracking SET isDeleted = 0 WHERE id = ?
    `, [id]);
    
    return { success: true };
  } catch (err) {
    console.error('restoreTravel error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Permanent delete (SuperAdmin → handlePermanentDelete)
 */
async function permanentDelete(id, targetType) {
  const db = getDatabase();
  let sql;
  
  switch (targetType) {
    case 'candidates': sql = 'DELETE FROM candidates WHERE id = ?'; break;
    case 'employers': sql = 'DELETE FROM employers WHERE id = ?'; break;
    case 'joborders': sql = 'DELETE FROM joborders WHERE id = ?'; break;
    case 'placements': sql = 'DELETE FROM placements WHERE id = ?'; break;
    case 'passports': sql = 'DELETE FROM passporttracking WHERE id = ?'; break;
    case 'visas': sql = 'DELETE FROM visatracking WHERE id = ?'; break;
    case 'medical': sql = 'DELETE FROM medicaltracking WHERE id = ?'; break;
    case 'interviews': sql = 'DELETE FROM interviewtracking WHERE id = ?'; break;
    case 'travel': sql = 'DELETE FROM traveltracking WHERE id = ?'; break;
    default: return { success: false, error: 'Invalid target type' };
  }
  
  try {
    const result = await dbRun(db, sql, [id]);
    if (result.changes === 0) {
      return { success: false, error: `${targetType} not found.` };
    }
    
    return { success: true };
  } catch (err) {
    console.error('permanentDelete error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from RecycleBinPage.jsx
module.exports = {
  // Core entities
  getDeletedCandidates, restoreCandidate,
  getDeletedEmployers, restoreEmployer,
  getDeletedJobOrders, restoreJobOrder,
  
  // Placements
  getDeletedPlacements, restorePlacement,
  
  // Tracking modules
  getDeletedPassports, restorePassport,
  getDeletedVisas, restoreVisa,
  getDeletedMedical, restoreMedical,
  getDeletedInterviews, restoreInterview,
  getDeletedTravel, restoreTravel,
  
  // SuperAdmin
  permanentDelete
};
