// src/services/queries/travelQueries.js
// ✈️ Travel Tracking for CandidateTravel.jsx
// PNR + ticketfilepath (documents) + cities + TravelEditModal

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Get candidate travel records (CandidateTravel.jsx → getTravelTracking)
 * ORDER BY traveldate DESC
 */
async function getTravelTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT * FROM traveltracking 
    WHERE candidateid = ? AND isDeleted = 0
    ORDER BY traveldate DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getTravelTracking error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add travel entry (CandidateTravel.jsx → addTravelEntry)
 * traveldate + departurecity + arrivalcity required + ticket from documents
 */
async function addTravelEntry(user, data) {
  const errors = {};
  
  // Validation - REQUIRED fields
  if (validateRequired(data.traveldate, 'Travel Date')) {
    errors.traveldate = validateRequired(data.traveldate, 'Travel Date');
  }
  
  if (validateRequired(data.departurecity, 'Departure City')) {
    errors.departurecity = validateRequired(data.departurecity, 'Departure City');
  }
  
  if (validateRequired(data.arrivalcity, 'Arrival City')) {
    errors.arrivalcity = validateRequired(data.arrivalcity, 'Arrival City');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    INSERT INTO traveltracking (
      candidateid, pnr, traveldate, ticketfilepath, 
      departurecity, arrivalcity, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.candidateid,
    data.pnr || null,
    data.traveldate,
    data.ticketfilepath || null,
    data.departurecity,
    data.arrivalcity,
    data.notes || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, 'SELECT * FROM traveltracking WHERE id = ?', [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addTravelEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update travel entry (TravelEditModal → updateTravelEntry)
 * Partial updates via modal
 */
async function updateTravelEntry(id, data) {
  const errors = {};
  
  // Validation - REQUIRED fields
  if (validateRequired(data.traveldate, 'Travel Date')) {
    errors.traveldate = validateRequired(data.traveldate, 'Travel Date');
  }
  
  if (validateRequired(data.departurecity, 'Departure City')) {
    errors.departurecity = validateRequired(data.departurecity, 'Departure City');
  }
  
  if (validateRequired(data.arrivalcity, 'Arrival City')) {
    errors.arrivalcity = validateRequired(data.arrivalcity, 'Arrival City');
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
      FROM traveltracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Travel entry not found or already deleted.')
      };
    }
    
    const sql = `
      UPDATE traveltracking 
      SET pnr = COALESCE(?, pnr),
          traveldate = ?, 
          ticketfilepath = COALESCE(?, ticketfilepath),
          departurecity = ?,
          arrivalcity = ?,
          notes = COALESCE(?, notes)
      WHERE id = ? AND isDeleted = 0
    `;
    
    const params = [
      data.pnr,
      data.traveldate,
      data.ticketfilepath,
      data.departurecity,
      data.arrivalcity,
      data.notes,
      id
    ];
    
    await dbRun(db, sql, params);
    
    const updatedRow = await dbGet(db, 'SELECT * FROM traveltracking WHERE id = ?', [id]);
    
    return {
      success: true,
      data: updatedRow
    };
  } catch (err) {
    console.error('updateTravelEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete travel entry (CandidateTravel.jsx → deleteTravelEntry)
 * Moves to Recycle Bin
 */
async function deleteTravelEntry(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, traveldate 
      FROM traveltracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Travel entry not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE traveltracking 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      traveldate: row.traveldate
    };
  } catch (err) {
    console.error('deleteTravelEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateTravel.jsx
module.exports = {
  getTravelTracking,
  addTravelEntry,
  updateTravelEntry,
  deleteTravelEntry
};
