// src/services/queries/medicalQueries.js
// 🩺 Medical Tracking for CandidateMedical.jsx
// CRUD + certificatepath (documents) + Status (Pending/Fit/Unfit/Cancelled)

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Get candidate medical records (CandidateMedical.jsx → getMedicalTracking)
 * ORDER BY testdate DESC
 */
async function getMedicalTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT * FROM medicaltracking 
    WHERE candidateid = ? AND isDeleted = 0
    ORDER BY testdate DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getMedicalTracking error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add medical entry (CandidateMedical.jsx → addMedicalEntry)
 * testdate + certificatepath (from documents) required
 */
async function addMedicalEntry(user, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.testdate, 'Test Date')) {
    errors.testdate = validateRequired(data.testdate, 'Test Date');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    INSERT INTO medicaltracking (
      candidateid, testdate, certificatepath, status, notes
    ) VALUES (?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.candidateid,
    data.testdate,
    data.certificatepath || null,
    data.status || 'Pending',
    data.notes || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, 'SELECT * FROM medicaltracking WHERE id = ?', [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addMedicalEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update medical entry (CandidateMedical.jsx → updateMedicalEntry)
 * Via MedicalEditModal - partial updates
 */
async function updateMedicalEntry(id, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.testdate, 'Test Date')) {
    errors.testdate = validateRequired(data.testdate, 'Test Date');
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
      SELECT candidateid 
      FROM medicaltracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Medical entry not found or already deleted.')
      };
    }
    
    const sql = `
      UPDATE medicaltracking 
      SET testdate = COALESCE(?, testdate),
          certificatepath = COALESCE(?, certificatepath),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes)
      WHERE id = ? AND isDeleted = 0
    `;
    
    const params = [
      data.testdate,
      data.certificatepath,
      data.status,
      data.notes,
      id
    ];
    
    await dbRun(db, sql, params);
    
    const updatedRow = await dbGet(db, 'SELECT * FROM medicaltracking WHERE id = ?', [id]);
    
    return {
      success: true,
      data: updatedRow
    };
  } catch (err) {
    console.error('updateMedicalEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete medical entry (CandidateMedical.jsx → deleteMedicalEntry)
 * Moves to Recycle Bin
 */
async function deleteMedicalEntry(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, testdate, status 
      FROM medicaltracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Medical entry not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE medicaltracking 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      testdate: row.testdate,
      status: row.status
    };
  } catch (err) {
    console.error('deleteMedicalEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateMedical.jsx
module.exports = {
  getMedicalTracking,
  addMedicalEntry,
  updateMedicalEntry,
  deleteMedicalEntry
};
