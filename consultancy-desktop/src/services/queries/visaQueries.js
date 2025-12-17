// src/services/queries/visaQueries.js
// 🛂 Visa Tracking for CandidateVisa.jsx
// Auto-fill + 8 statuses + Agent tracking + VisaEditModal

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Get candidate visa records (CandidateVisa.jsx → getVisaTracking)
 * ORDER BY applicationdate DESC
 */
async function getVisaTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT * FROM visatracking 
    WHERE candidateid = ? AND isDeleted = 0
    ORDER BY applicationdate DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getVisaTracking error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add visa entry (CandidateVisa.jsx → addVisaEntry)
 * country + applicationdate required + auto-fill support
 */
async function addVisaEntry(user, data) {
  const errors = {};
  
  // Validation - REQUIRED fields
  if (validateRequired(data.country, 'Country')) {
    errors.country = validateRequired(data.country, 'Country');
  }
  
  if (validateRequired(data.applicationdate, 'Application Date')) {
    errors.applicationdate = validateRequired(data.applicationdate, 'Application Date');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    INSERT INTO visatracking (
      candidateid, country, visatype, applicationdate, status, notes, 
      position, passportnumber, traveldate, contacttype, agentcontact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.candidateid,
    data.country,
    data.visatype || null,
    data.applicationdate,
    data.status || 'Pending',
    data.notes || null,
    data.position || null,
    data.passportnumber || null,
    data.traveldate || null,
    data.contacttype || 'Direct Candidate',
    data.agentcontact || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, 'SELECT * FROM visatracking WHERE id = ?', [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addVisaEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update visa entry (VisaEditModal → updateVisaEntry)
 * Partial updates + status changes
 */
async function updateVisaEntry(id, data) {
  const errors = {};
  
  // Validation - REQUIRED fields
  if (validateRequired(data.country, 'Country')) {
    errors.country = validateRequired(data.country, 'Country');
  }
  
  if (validateRequired(data.applicationdate, 'Application Date')) {
    errors.applicationdate = validateRequired(data.applicationdate, 'Application Date');
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
      FROM visatracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Visa entry not found or already deleted.')
      };
    }
    
    const sql = `
      UPDATE visatracking 
      SET country = ?,
          visatype = COALESCE(?, visatype),
          applicationdate = ?,
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          position = COALESCE(?, position),
          passportnumber = COALESCE(?, passportnumber),
          traveldate = COALESCE(?, traveldate),
          contacttype = COALESCE(?, contacttype),
          agentcontact = COALESCE(?, agentcontact)
      WHERE id = ? AND isDeleted = 0
    `;
    
    const params = [
      data.country,
      data.visatype,
      data.applicationdate,
      data.status,
      data.notes,
      data.position,
      data.passportnumber,
      data.traveldate,
      data.contacttype,
      data.agentcontact,
      id
    ];
    
    await dbRun(db, sql, params);
    
    const updatedRow = await dbGet(db, 'SELECT * FROM visatracking WHERE id = ?', [id]);
    
    return {
      success: true,
      data: updatedRow
    };
  } catch (err) {
    console.error('updateVisaEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete visa entry (CandidateVisa.jsx → deleteVisaEntry)
 * Moves to Recycle Bin
 */
async function deleteVisaEntry(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, country 
      FROM visatracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Visa entry not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE visatracking 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      country: row.country
    };
  } catch (err) {
    console.error('deleteVisaEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateVisa.jsx
module.exports = {
  getVisaTracking,
  addVisaEntry,
  updateVisaEntry,
  deleteVisaEntry
};
