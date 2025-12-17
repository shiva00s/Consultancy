// src/services/queries/candidateDetailQueries.js
// 👤 Complete Candidate Detail + All Sub-Modules for CandidateDetailPage.jsx
// Supports ALL tabs: Profile, Passport, Documents, Jobs, Visa, Finance, Medical, Interview, Travel, etc.

const getDatabase = require('../database.cjs');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');
const { checkAdminFeatureAccess } = require('./permissionsQueries.cjs');

/**
 * Main candidate details + documents (CandidateDetailPage.jsx → getCandidateDetails)
 */
async function getCandidateDetails(id) {
  const db = getDatabase();
  try {
    const candidate = await dbGet(db, `
      SELECT * FROM candidates 
      WHERE id = ? AND isDeleted = 0
    `, [id]);

    if (!candidate) {
      return { success: false, error: mapErrorToFriendly('Candidate not found.') };
    }

    const documents = await dbAll(db, `
      SELECT * FROM documents 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY category, fileName, id
    `, [id]);

    return {
      success: true,
      data: {
        candidate,
        documents
      }
    };
  } catch (err) {
    console.error('getCandidateDetails error:', err);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Update candidate text fields (CandidateDetailPage.jsx → updateCandidateText)
 */
async function updateCandidateText(user, id, data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);
  const cleanPassportNo = data.passportNo ? 
    data.passportNo.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

  // Validation (same as createCandidate)
  if (validateRequired(data.name, 'Candidate Name')) errors.name = 'Candidate Name is required';
  if (validateRequired(data.Position, 'Position')) errors.Position = 'Position is required';
  if (validateRequired(cleanPassportNo, 'Passport No')) {
    errors.passportNo = 'Passport No is required';
  } else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) {
    errors.passportNo = 'Passport No must be 6-15 letters/numbers only';
  }

  if (data.contact && !/^\d{10}$/.test(data.contact)) errors.contact = 'Contact must be exactly 10 digits';
  if (data.aadhar && !/^\d{12}$/.test(data.aadhar)) errors.aadhar = 'Aadhar must be exactly 12 digits';

  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (isNaN(expiryDate) || expiryDate <= today) {
      errors.passportExpiry = 'Passport Expiry must be a valid future date';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, error: mapErrorToFriendly('Validation failed'), errors };
  }

  try {
    // Check for duplicates (excluding current record)
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
        duplicateErrors.passportNo = `Passport No ${cleanPassportNo} already exists for another candidate`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        duplicateErrors.aadhar = `Aadhar No ${data.aadhar} already exists for another candidate`;
      }
      if (Object.keys(duplicateErrors).length > 0) {
        return { success: false, error: mapErrorToFriendly('Duplicate field value detected.'), errors: duplicateErrors };
      }
    }

    const sql = `
      UPDATE candidates SET 
        name = ?, education = ?, experience = ?, dob = ?, 
        passportNo = ?, passportExpiry = ?, contact = ?, 
        aadhar = ?, status = ?, notes = ?, Position = ?
      WHERE id = ?
    `;
    const updateParams = [
      data.name, data.education, data.experience || 0, data.dob,
      cleanPassportNo, data.passportExpiry, data.contact,
      data.aadhar, data.status || 'New', data.notes, data.Position, id
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

/**
 * Get candidate placements (CandidateDetailPage.jsx → getCandidatePlacements)
 */
async function getCandidatePlacements(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT 
        p.id as placementId, p.status as placementStatus, p.assignedAt as assignedDate,
        j.id as jobId, j.positionTitle, e.companyName, e.country
      FROM placements p 
      LEFT JOIN joborders j ON p.joborderid = j.id 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE p.candidateid = ? AND p.isDeleted = 0 
      ORDER BY p.assignedAt DESC
    `, [candidateId]);

    return { success: true, data: rows };
  } catch (err) {
    console.error('getCandidatePlacements error:', err);
    return { success: false, error: mapErrorToFriendly(err), data: [] };
  }
}

/**
 * Get tracking data for ALL sub-modules
 */
async function getVisaTracking(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM visatracking 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY applicationdate DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getPassportTracking(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM passporttracking 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY createdAt DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getMedicalTracking(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM medicaltracking 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY testdate DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getInterviewTracking(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT i.*, j.positionTitle, e.companyName 
      FROM interviewtracking i 
      LEFT JOIN joborders j ON i.joborderid = j.id 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE i.candidateid = ? AND i.isDeleted = 0 
      ORDER BY i.interviewdate DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getTravelTracking(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM traveltracking 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY traveldate DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Get candidate payments (Financial tab)
 */
async function getCandidatePayments(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM payments 
      WHERE candidateid = ? AND isDeleted = 0 
      ORDER BY createdat DESC
    `, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Soft delete candidate + cascade (Recycle Bin)
 */
async function deleteCandidate(id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    await dbRun(db, 'UPDATE candidates SET isDeleted = 1 WHERE id = ?', [id]);
    await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE visatracking SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE payments SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE medicaltracking SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE interviewtracking SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE traveltracking SET isDeleted = 1 WHERE candidateid = ?', [id]);
    await dbRun(db, 'UPDATE passporttracking SET isDeleted = 1 WHERE candidateid = ?', [id]);

    await dbRun(db, 'COMMIT');
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

/**
 * Get granular user permissions for tabs (CandidateDetailPage.jsx)
 */
async function getUserGranularPermissions(userId) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT flags FROM userpermissions WHERE userid = ?
    `, [userId]);

    const flags = row ? JSON.parse(row.flags) : {};
    
    // Default granular permissions structure
    const granular = {
      'tabprofile': true,
      'tabpassport': flags.canAccessPassport || false,
      'tabdocuments': flags.canAccessDocuments || false,
      'tabjobplacements': flags.canAssignJobs || false,
      'tabvisatracking': flags.canAccessVisa || false,
      'tabfinancial': flags.canViewReports || false,
      'tabmedical': flags.canAccessMedical || false,
      'tabinterview': flags.canAccessInterview || false,
      'tabtravel': flags.canAccessTravel || false,
      'tabofferletter': flags.canGenerateOffers || false,
      'tabhistory': flags.canViewReports || false,
      'tabcommslog': flags.canAccessComms || false
    };

    return { success: true, data: granular };
  } catch (err) {
    return { success: true, data: { 'tabprofile': true } }; // Profile always visible
  }
}

// 🔒 Validation helpers (reused from queries.cjs)
function validateRequired(field, name) {
  if (!field || typeof field === 'string' && !field.trim()) {
    return `${name} is required.`;
  }
  return null;
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateDetailPage.jsx
module.exports = {
  // Core candidate operations
  getCandidateDetails,
  updateCandidateText,
  deleteCandidate,
  
  // Placements
  getCandidatePlacements,
  
  // Tracking modules
  getVisaTracking,
  getPassportTracking,
  getMedicalTracking,
  getInterviewTracking,
  getTravelTracking,
  
  // Financial
  getCandidatePayments,
  
  // Permissions
  getUserGranularPermissions,
  
  // Legacy compatibility (from queries.cjs)
  getCandidateDetails: getCandidateDetails,  // Already exists
  updateCandidateText: updateCandidateText,  // Already exists
  getCandidatePlacements: getCandidatePlacements  // Already exists
};
