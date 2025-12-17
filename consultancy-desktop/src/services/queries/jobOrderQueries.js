// src/services/queries/jobOrderQueries.js
// 📋 Job Order CRUD for JobOrderListPage.jsx
// employerid → positionTitle → openingsCount → food/accommodation → status

const getDatabase = require('../database.cjs');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired, validatePositiveNumber } = require('./utils.cjs');

/**
 * Get all job orders (JobOrderListPage.jsx → getJobOrders)
 * JOIN employers for companyName display
 */
async function getJobOrders() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT j.*, e.companyName 
      FROM joborders j 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE j.isDeleted = 0 
      ORDER BY j.createdAt DESC
    `);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getJobOrders error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Add new job order (JobOrderListPage.jsx → addJobOrder)
 */
async function addJobOrder(user, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.employerid, 'Employer')) {
    errors.employerid = 'Employer is required.';
  }
  if (validateRequired(data.positionTitle, 'Position Title')) {
    errors.positionTitle = 'Position Title is required.';
  }
  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1) {
    errors.openingsCount = 'Openings must be at least 1.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: 'Validation failed',
      errors
    };
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  
  const sql = `
    INSERT INTO joborders (
      employerid, positionTitle, country, openingsCount, status, requirements, 
      food, accommodation, dutyHours, overtime, contractPeriod, selectionType,
      createdAt, updatedAt, createdBy, updatedBy, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `;
  
  const params = [
    data.employerid,
    data.positionTitle.trim(),
    data.country || null,
    openings,
    data.status || 'Open',
    data.requirements || null,
    data.food || null,
    data.accommodation || null,
    data.dutyHours || null,
    data.overtime || null,
    data.contractPeriod || null,
    data.selectionType || 'CV Selection',
    now, now, user.id, user.id
  ];

  try {
    const result = await dbRun(db, sql, params);
    const newJobId = result.lastID;
    
    // Return full job record with employer
    const newJob = await dbGet(db, `
      SELECT j.*, e.companyName 
      FROM joborders j 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE j.id = ?
    `, [newJobId]);

    return {
      success: true,
      id: newJobId,
      data: newJob
    };
  } catch (err) {
    console.error('addJobOrder error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update job order (JobOrderListPage.jsx → updateJobOrder)
 */
async function updateJobOrder(user, id, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.employerid, 'Employer')) {
    errors.employerid = 'Employer is required.';
  }
  if (validateRequired(data.positionTitle, 'Position Title')) {
    errors.positionTitle = 'Position Title is required.';
  }
  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1) {
    errors.openingsCount = 'Openings must be at least 1.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: 'Validation failed',
      errors
    };
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  
  const sql = `
    UPDATE joborders 
    SET employerid = ?, positionTitle = ?, country = ?, openingsCount = ?, 
        status = ?, requirements = ?, food = ?, accommodation = ?, 
        dutyHours = ?, overtime = ?, contractPeriod = ?, selectionType = ?,
        updatedAt = ?, updatedBy = ?
    WHERE id = ? AND isDeleted = 0
  `;
  
  const params = [
    data.employerid,
    data.positionTitle.trim(),
    data.country || null,
    openings,
    data.status || 'Open',
    data.requirements || null,
    data.food || null,
    data.accommodation || null,
    data.dutyHours || null,
    data.overtime || null,
    data.contractPeriod || null,
    data.selectionType || 'CV Selection',
    now, user.id, id
  ];

  try {
    await dbRun(db, sql, params);
    
    // Return updated record
    const updatedJob = await dbGet(db, `
      SELECT j.*, e.companyName 
      FROM joborders j 
      LEFT JOIN employers e ON j.employerid = e.id 
      WHERE j.id = ?
    `, [id]);

    if (!updatedJob) {
      return {
        success: false,
        error: 'Job order not found.'
      };
    }

    return {
      success: true,
      id,
      data: updatedJob
    };
  } catch (err) {
    console.error('updateJobOrder error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete job order (JobOrderListPage.jsx → deleteJobOrder)
 * Cascades to placements
 */
async function deleteJobOrder(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Soft delete job order
    await dbRun(db, `
      UPDATE joborders SET isDeleted = 1 WHERE id = ?
    `, [id]);
    
    // Cascade soft delete placements
    await dbRun(db, `
      UPDATE placements SET isDeleted = 1 WHERE joborderid = ?
    `, [id]);
    
    await dbRun(db, 'COMMIT');
    
    return {
      success: true
    };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error('deleteJobOrder error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted job orders (Recycle Bin)
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
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Restore deleted job order
 */
async function restoreJobOrder(id) {
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
    
    return {
      success: true
    };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from JobOrderListPage.jsx
module.exports = {
  // Main CRUD
  getJobOrders,
  addJobOrder,
  updateJobOrder,
  deleteJobOrder,
  
  // Recycle Bin
  getDeletedJobOrders,
  restoreJobOrder
};
