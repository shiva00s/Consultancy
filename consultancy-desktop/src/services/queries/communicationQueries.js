// src/services/queries/communicationQueries.js
// 💬 Communication Logs for CommunicationHistory.jsx
// WhatsApp/Call/Email timeline + user lookup

const getDatabase = require('../database.cjs');
const { dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get all communication logs for candidate (CommunicationHistory.jsx → getCommunicationLogs)
 * WhatsApp/Call/Email + username + ORDER BY createdAt DESC
 */
async function getCommunicationLogs(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      cl.id, 
      cl.communicationtype, 
      cl.details, 
      cl.createdAt,
      COALESCE(u.username, 'Unknown User') as username
    FROM communicationlogs cl
    LEFT JOIN users u ON cl.userid = u.id
    WHERE cl.candidateid = ?
    ORDER BY cl.createdAt DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getCommunicationLogs error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Log new communication event (WhatsAppBulkPage.jsx → logCommunication)
 * Auto-called from WhatsApp/Call/Email integrations
 */
async function logCommunication(candidateId, userId, type, details) {
  const db = getDatabase();
  
  // Validate inputs
  if (!candidateId || !type || !['WhatsApp', 'Call', 'Email'].includes(type)) {
    return {
      success: false,
      error: 'Invalid candidateId or communication type'
    };
  }
  
  const sql = `
    INSERT INTO communicationlogs (
      candidateid, userid, communicationtype, details
    ) VALUES (?, ?, ?, ?)
  `;
  
  const params = [candidateId, userId || null, type, details || ''];
  
  try {
    await dbRun(db, sql, params);
    console.log(`Communication logged: ${candidateId} | ${type} | ${details}`);
    return {
      success: true
    };
  } catch (err) {
    console.error('logCommunication error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CommunicationHistory.jsx
module.exports = {
  getCommunicationLogs,
  logCommunication
};
