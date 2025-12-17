// src/services/queries/passportQueries.js
// 🛂 Passport Tracking for CandidatePassport.jsx
// Receive/Send movements + history timeline

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Get all passport movements (CandidatePassport.jsx → getPassportMovements)
 * Full history with RECEIVE/SEND fields + ORDER BY date DESC
 */
async function getPassportMovements(candidateId, user) {
  const db = getDatabase();
  const sql = `
    SELECT 
      id, candidateid, movementtype, method, couriernumber, date,
      receivedfrom, receivedby, sendto, sendtoname, sendtocontact, sentby,
      receivednotes, dispatchnotes, passportstatus, sourcetype, agentcontact,
      photos, photocount, createdby, createdAt, updatedAt
    FROM passporttracking 
    WHERE candidateid = ? AND isDeleted = 0
    ORDER BY date DESC, createdAt DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    
    // Map for frontend compatibility
    const mappedRows = rows.map(row => ({
      id: row.id,
      candidateid: row.candidateid,
      type: row.movementtype,
      movementtype: row.movementtype,
      method: row.method,
      couriernumber: row.couriernumber,
      date: row.date,
      receivedfrom: row.receivedfrom,
      receivedby: row.receivedby,
      sendto: row.sendto,
      sendtoname: row.sendtoname,
      sendtocontact: row.sendtocontact,
      sentby: row.sentby,
      notes: row.notes || row.receivednotes || row.dispatchnotes,
      photos: row.photos ? JSON.parse(row.photos) : [],
      photocount: row.photocount || 0,
      hasphotos: (row.photocount || 0) > 0,
      createdby: row.createdby,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
    
    return {
      success: true,
      data: mappedRows
    };
  } catch (err) {
    console.error('getPassportMovements error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add passport movement (PassportReceiveForm/PassportSendForm → addPassportEntry)
 * RECEIVE or SEND + conditional validation
 */
async function addPassportEntry(user, data) {
  const errors = {};
  const candidateId = data.candidateid || data.candidateId;
  
  if (!candidateId) {
    errors.candidateid = 'Candidate ID is required';
  }
  
  if (!data.passportstatus || !['Received', 'Dispatched'].includes(data.passportstatus)) {
    errors.passportstatus = 'Valid passport status (Received/Dispatched) required';
  }
  
  if (data.passportstatus === 'Received' && !data.receiveddate) {
    errors.receiveddate = 'Received Date is required when status is Received';
  }
  
  if (data.passportstatus === 'Dispatched' && !data.dispatchdate) {
    errors.dispatchdate = 'Dispatch Date is required when status is Dispatched';
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    INSERT INTO passporttracking (
      candidateid, receiveddate, receivednotes, dispatchdate, docketnumber,
      dispatchnotes, passportstatus, sourcetype, agentcontact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    candidateId,
    data.receiveddate || null,
    data.receivednotes || null,
    data.dispatchdate || null,
    data.docketnumber || null,
    data.dispatchnotes || null,
    data.passportstatus,
    data.sourcetype || 'Direct',
    data.agentcontact || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, `
      SELECT * FROM passporttracking WHERE id = ?
    `, [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addPassportEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update passport entry (via forms → updatePassportEntry)
 * Partial updates for received/dispatched details
 */
async function updatePassportEntry(id, data) {
  const errors = {};
  
  if (data.passportstatus === 'Received' && !data.receiveddate) {
    errors.receiveddate = 'Received Date is required when status is Received';
  }
  
  if (data.passportstatus === 'Dispatched' && !data.dispatchdate) {
    errors.dispatchdate = 'Dispatch Date is required when status is Dispatched';
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const sql = `
    UPDATE passporttracking 
    SET receiveddate = COALESCE(?, receiveddate),
        receivednotes = COALESCE(?, receivednotes),
        dispatchdate = COALESCE(?, dispatchdate),
        docketnumber = COALESCE(?, docketnumber),
        dispatchnotes = COALESCE(?, dispatchnotes),
        passportstatus = COALESCE(?, passportstatus),
        sourcetype = COALESCE(?, sourcetype),
        agentcontact = COALESCE(?, agentcontact)
    WHERE id = ? AND isDeleted = 0
  `;
  
  const params = [
    data.receiveddate, data.receivednotes, data.dispatchdate,
    data.docketnumber, data.dispatchnotes, data.passportstatus,
    data.sourcetype, data.agentcontact, id
  ];
  
  try {
    await dbRun(db, sql, params);
    const updatedRow = await dbGet(db, `
      SELECT * FROM passporttracking WHERE id = ?
    `, [id]);
    
    if (!updatedRow) {
      return {
        success: false,
        error: mapErrorToFriendly('Passport entry not found or already deleted.')
      };
    }
    
    return {
      success: true,
      data: updatedRow
    };
  } catch (err) {
    console.error('updatePassportEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete passport entry (timeline → deletePassportEntry)
 */
async function deletePassportEntry(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, passportstatus 
      FROM passporttracking 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Passport entry not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE passporttracking 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      passportstatus: row.passportstatus
    };
  } catch (err) {
    console.error('deletePassportEntry error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names
module.exports = {
  getPassportMovements,
  addPassportEntry,
  updatePassportEntry,
  deletePassportEntry
};
