// src/services/queries/candidatesQueries.js
// 👥 Candidate CRUD + Documents for AddCandidatePage.jsx, EditCandidatePage.jsx
// 100% backward compatible - EXACT same function signatures

const getDatabase = require('../database.cjs');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const { dbRun, dbGet, dbAll } = require('./dbHelpers.cjs');
const { 
  validateRequired, 
  validatePositiveNumber,
  mapErrorToFriendly 
} = require('./utils.cjs');

/**
 * Create new candidate with files (AddCandidatePage.jsx → saveCandidateMulti)
 * Handles: name, education, experience, dob, passportNo, passportExpiry, contact, aadhar, status, notes, Position
 */
async function createCandidate(user, data, fileData = []) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);
  const cleanPassportNo = data.passportNo ? 
    data.passportNo.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

  // VALIDATION (exact copy from original)
  if (validateRequired(data.name, 'Name')) errors.name = validateRequired(data.name, 'Name');
  if (validateRequired(data.Position, 'Position')) errors.Position = validateRequired(data.Position, 'Position');
  if (validateRequired(cleanPassportNo, 'Passport No')) errors.passportNo = validateRequired(cleanPassportNo, 'Passport No');
  else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) errors.passportNo = 'Passport No must be 6-15 letters or numbers (no special characters).';

  if (data.aadhar && !/^\d{12}$/.test(data.aadhar)) errors.aadhar = 'Aadhar must be exactly 12 digits.';
  if (data.contact && !/^\d{10}$/.test(data.contact)) errors.contact = 'Contact must be exactly 10 digits.';

  if (data.experience) {
    if (validatePositiveNumber(data.experience, 'Experience')) errors.experience = validatePositiveNumber(data.experience, 'Experience');
  }

  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (expiryDate <= today) errors.passportExpiry = 'Passport Expiry must be in the future.';
  }

  if (data.dob) {
    const dobDate = new Date(data.dob).getTime();
    if (dobDate >= today) errors.dob = 'Date of Birth must be in the past.';
  }

  // DUPLICATE CHECK
  try {
    let checkSql = 'SELECT passportNo, aadhar FROM candidates WHERE passportNo = ?';
    let params = [cleanPassportNo];
    if (data.aadhar) {
      checkSql += ' OR aadhar = ?';
      params.push(data.aadhar);
    }
    checkSql += ' AND isDeleted = 0';

    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      if (existing.passportNo === cleanPassportNo) errors.passportNo = `Passport No ${cleanPassportNo} already exists.`;
      if (data.aadhar && existing.aadhar === data.aadhar) errors.aadhar = `Aadhar No ${data.aadhar} already exists.`;
    }
  } catch (err) {
    console.error('createCandidate duplicate check error:', err);
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, error: mapErrorToFriendly('Validation failed'), errors };
  }

  try {
    const sqlCandidate = `
      INSERT INTO candidates (name, education, experience, dob, passportNo, passportExpiry, contact, aadhar, status, notes, Position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const paramsCandidate = [
      data.name, data.education, data.experience || null, data.dob, cleanPassportNo,
      data.passportExpiry, data.contact, data.aadhar, data.status || 'New', data.notes || '', data.Position
    ];

    const result = await dbRun(db, sqlCandidate, paramsCandidate);
    
    const candidateId = result.lastID;

    // Save documents if provided
    if (fileData.length > 0) {
      await saveCandidateDocuments(db, candidateId, fileData);
    }

    return { success: true, id: candidateId };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: mapErrorToFriendly('A unique field like Passport already exists.') };
    }
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Save candidate documents (used by createCandidate + edit)
 */
async function saveCandidateDocuments(db, candidateId, fileData) {
  for (const file of fileData) {
    const sqlDoc = `
      INSERT INTO documents (candidateid, fileType, fileName, filePath, category)
      VALUES (?, ?, ?, ?, ?)
    `;
    await dbRun(db, sqlDoc, [
      candidateId, file.type, file.name, file.path || file.bufferPath, file.category || 'Uncategorized'
    ]);
  }
}

/**
 * Get job positions for dropdown (AddCandidatePage.jsx → getJobOrders)
 */
async function getJobPositions(user) {
  const db = getDatabase();
  try {
    const sql = `
      SELECT DISTINCT positionTitle 
      FROM joborders 
      WHERE isDeleted = 0 AND positionTitle IS NOT NULL AND positionTitle != ''
      ORDER BY positionTitle ASC
    `;
    const rows = await dbAll(db, sql);
    const positions = rows.map(job => job.positionTitle).filter((pos, index, self) => 
      self.indexOf(pos) === index
    );
    return { success: true, data: positions };
  } catch (err) {
    console.error('getJobPositions error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Update candidate text fields (EditCandidatePage.jsx)
 */
async function updateCandidateText(user, id, data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);
  const cleanPassportNo = data.passportNo ? 
    data.passportNo.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

  // VALIDATION (exact copy from original)
  if (validateRequired(data.name, 'Candidate Name')) errors.name = validateRequired(data.name, 'Candidate Name');
  if (validateRequired(data.Position, 'Position')) errors.Position = validateRequired(data.Position, 'Position');
  if (validateRequired(cleanPassportNo, 'Passport No')) errors.passportNo = validateRequired(cleanPassportNo, 'Passport No');
  else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) errors.passportNo = 'Passport No must be 6-15 letters or numbers (no special characters).';

  if (data.contact && !/^\d{10}$/.test(data.contact)) errors.contact = 'Contact must be exactly 10 digits.';
  if (data.aadhar && !/^\d{12}$/.test(data.aadhar)) errors.aadhar = 'Aadhar must be exactly 12 digits.';

  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (isNaN(expiryDate) || expiryDate <= today) {
      errors.passportExpiry = 'Passport Expiry must be a valid date in the future.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, error: mapErrorToFriendly('Validation failed'), errors };
  }

  try {
    // DUPLICATE CHECK (exclude current candidate)
    let checkSql = 'SELECT passportNo, aadhar FROM candidates WHERE passportNo = ?';
    let params = [cleanPassportNo];
    if (data.aadhar) {
      checkSql += ' OR aadhar = ?';
      params.push(data.aadhar);
    }
    checkSql += ' AND isDeleted = 0 AND id != ?';
    params.push(id);

    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      const duplicateErrors = {};
      if (existing.passportNo === cleanPassportNo) {
        duplicateErrors.passportNo = `Passport No ${cleanPassportNo} already exists for another candidate.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        duplicateErrors.aadhar = `Aadhar No ${data.aadhar} already exists for another candidate.`;
      }
      if (Object.keys(duplicateErrors).length > 0) {
        return { success: false, error: mapErrorToFriendly('Duplicate field value detected.'), errors: duplicateErrors };
      }
    }

    const sql = `
      UPDATE candidates 
      SET name = ?, education = ?, experience = ?, dob = ?, passportNo = ?, 
          passportExpiry = ?, contact = ?, aadhar = ?, status = ?, notes = ?, Position = ?
      WHERE id = ?
    `;
    const updateParams = [
      data.name, data.education || '', data.experience || null, data.dob, cleanPassportNo,
      data.passportExpiry, data.contact, data.aadhar, data.status || 'New', data.notes || '', data.Position, id
    ];

    await dbRun(db, sql, updateParams);
    return { success: true };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: mapErrorToFriendly('A unique field like Passport already exists.') };
    }
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// 🔒 EXPORTS - Exact same names as original queries.cjs
module.exports = {
  // Core candidate functions
  createCandidate,
  updateCandidateText,
  getJobPositions,
  
  // Document helpers
  saveCandidateDocuments,
  
  // Legacy compatibility aliases
  saveCandidateMulti: createCandidate,  // For AddCandidatePage.jsx
  getJobOrders: getJobPositions         // For position dropdown
};
