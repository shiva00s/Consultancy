// src/services/queries/passportTimelineQueries.js
// 🛫 COMPLETE Passport RECEIVE + SEND + Timeline + Photos
// Supports PassportReceiveForm.jsx [file:38] + PassportSendForm.jsx [file:39]

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * getPassportMovements → PassportHistoryTimeline.jsx [file:36]
 * Shows RECEIVED/DISPATCHED + photo counts
 */
async function getPassportMovements(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      pt.id, pt.candidateid, pt.passportstatus as type,
      COALESCE(pt.sourcetype, 'By Hand') as method, pt.couriernumber, 
      COALESCE(pt.receiveddate, pt.dispatchdate) as date,
      pt.sourcetype as receivedfrom, pt.agentcontact as receivedby,
      pt.dispatchnotes as sendtoname, pt.couriernumber as sendtocontact, 
      pt.agentcontact as sentby,
      COALESCE(pt.receivednotes, pt.dispatchnotes) as notes,
      pt.agentcontact as createdby, pt.createdAt,
      COALESCE(pmp.photoCount, 0) as photocount
    FROM passporttracking pt
    LEFT JOIN (
      SELECT movementid, COUNT(*) as photoCount 
      FROM passportmovementphotos WHERE isDeleted = 0 
      GROUP BY movementid
    ) pmp ON pt.id = pmp.movementid
    WHERE pt.candidateid = ? AND pt.isDeleted = 0
    ORDER BY COALESCE(pt.receiveddate, pt.dispatchdate) DESC, pt.createdAt DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows.map(row => ({
        id: row.id,
        candidateid: row.candidateid,
        type: row.type, // "Received" / "Dispatched"
        method: row.method,
        couriernumber: row.couriernumber,
        date: row.date,
        receivedfrom: row.receivedfrom,
        receivedby: row.receivedby,
        sendto: row.sendtoname,
        sendtoname: row.sendtoname,
        sendtocontact: row.sendtocontact,
        sentby: row.sentby,
        notes: row.notes,
        photocount: row.photocount || 0,
        hasphotos: (row.photocount || 0) > 0,
        createdAt: row.createdAt,
        createdby: row.createdby || 'Unknown'
      }))
    };
  } catch (err) {
    console.error('getPassportMovements error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * addPassportMovement → DUAL RECEIVE/SEND [file:38][file:39]
 * type: 'RECEIVE' → passportstatus='Received'
 * type: 'SEND' → passportstatus='Dispatched'  
 */
async function addPassportMovement(data, user) {
  const db = getDatabase();
  const candidateId = data.candidateid || data.candidateId;
  
  if (!candidateId) return { success: false, error: 'Candidate ID required' };
  
  // RECEIVE vs SEND validation
  const isReceive = data.type === 'RECEIVE';
  const errors = {};
  
  if (isReceive) {
    if (!data.receivedfrom) errors.receivedfrom = 'Received From required';
    if (!data.receivedby) errors.receivedby = 'Received By required';
  } else {
    if (!data.sendtoname) errors.sendtoname = 'Recipient Name required';
    if (!data.sentby) errors.sentby = 'Sent By required';
  }
  
  if (!data.method) errors.method = 'Method required';
  if (!data.date) errors.date = 'Date required';
  if (data.method === 'By Courier' && !data.couriernumber) {
    errors.couriernumber = 'Courier number required';
  }
  
  if (Object.keys(errors).length > 0) {
    return { success: false, error: 'Validation failed', errors };
  }
  
  // ✅ DUAL INSERT - Receive vs Send
  const status = isReceive ? 'Received' : 'Dispatched';
  const dateField = isReceive ? 'receiveddate' : 'dispatchdate';
  const notesField = isReceive ? 'receivednotes' : 'dispatchnotes';
  
  const sql = `
    INSERT INTO passporttracking (
      candidateid, passportstatus, sourcetype, ${dateField}, 
      ${notesField}, couriernumber, agentcontact
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    candidateId,
    status,
    data[isReceive ? 'receivedfrom' : 'sendtoname'] || 'Unknown',
    data.date,
    data[isReceive ? 'receivedby' : 'sentby'] || 'Unknown',
    data.couriernumber || null,
    user?.username || 'Unknown'
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    return {
      success: true,
      data: { 
        id: result.lastID, 
        passportstatus: status,
        [dateField]: data.date,
        hasphotos: false 
      }
    };
  } catch (err) {
    console.error('addPassportMovement error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ✅ Existing functions (unchanged)
async function getPassportMovementPhotos(movementId, user) {
  const db = getDatabase();
  const sql = `SELECT id, filename, filetype, filedata, createdat
               FROM passportmovementphotos WHERE movementid = ? AND isDeleted = 0
               ORDER BY createdat DESC`;
  
  try {
    const rows = await dbAll(db, sql, [movementId]);
    const photos = rows.map(row => ({
      id: row.id,
      filename: row.filename,
      filetype: row.filetype,
      filedata: `data:${row.filetype};base64,${row.filedata}`,
      uploadedat: row.createdat
    }));
    return { success: true, data: photos, totalCount: photos.length };
  } catch (err) {
    console.error('getPassportMovementPhotos error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deletePassportMovement(movementId, user) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `SELECT candidateid FROM passporttracking WHERE id = ?`, [movementId]);
    if (!row) return { success: false, error: 'Movement not found' };
    
    await dbRun(db, `UPDATE passporttracking SET isDeleted = 1 WHERE id = ?`, [movementId]);
    return { success: true, message: 'Movement deleted', candidateId: row.candidateid };
  } catch (err) {
    console.error('deletePassportMovement error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addPassportMovementPhoto(photoData, user) {
  const db = getDatabase();
  if (!photoData.movementid || !photoData.filename || !photoData.filetype || !photoData.filedata) {
    return { success: false, error: 'Missing photo data' };
  }
  
  let cleanBase64 = photoData.filedata.includes(',') ? photoData.filedata.split(',')[1] : photoData.filedata;
  
  const sql = `INSERT INTO passportmovementphotos (movementid, filename, filetype, filedata, createdat)
               VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`;
  
  try {
    const result = await dbRun(db, sql, [photoData.movementid, photoData.filename, photoData.filetype, cleanBase64]);
    const row = await dbGet(db, `SELECT * FROM passportmovementphotos WHERE id = ?`, [result.lastID]);
    return { success: true, data: row };
  } catch (err) {
    console.error('addPassportMovementPhoto error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// 🎯 COMPLETE EXPORTS - ALL 5 FUNCTIONS
module.exports = {
  getPassportMovements,
  getPassportMovementPhotos,
  deletePassportMovement,
  addPassportMovement,        // ✅ DUAL Receive/Send
  addPassportMovementPhoto
};
