// src/services/queries/employerQueries.js
// 🏢 Employer CRUD for EmployerListPage.jsx
// Add/Edit/View + Soft delete (cascade to joborders)

const getDatabase = require('../database.cjs');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateEmail, validateRequired } = require('./utils.cjs');

/**
 * Get all employers (EmployerListPage.jsx → getEmployers)
 */
async function getEmployers() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT * FROM employers 
      WHERE isDeleted = 0 
      ORDER BY companyName ASC
    `);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getEmployers error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Add new employer (EmployerListPage.jsx → addEmployer)
 */
async function addEmployer(user, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.companyName, 'Company Name')) {
    errors.companyName = validateRequired(data.companyName, 'Company Name');
  }
  if (data.contactEmail && !validateEmail(data.contactEmail)) {
    errors.contactEmail = 'Contact Email must be valid.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  const db = getDatabase();
  const sql = `
    INSERT INTO employers (companyName, country, contactPerson, contactEmail, notes) 
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [
    data.companyName.trim(),
    data.country || null,
    data.contactPerson || null,
    data.contactEmail || null,
    data.notes || null
  ];

  try {
    const result = await dbRun(db, sql, params);
    const newId = result.lastID;
    
    // Return full employer record
    const newEmployer = await dbGet(db, `
      SELECT * FROM employers WHERE id = ?
    `, [newId]);

    return {
      success: true,
      id: newId,
      data: newEmployer
    };
  } catch (err) {
    console.error('addEmployer error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update employer (EmployerListPage.jsx → updateEmployer)
 */
async function updateEmployer(user, id, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.companyName, 'Company Name')) {
    errors.companyName = validateRequired(data.companyName, 'Company Name');
  }
  if (data.contactEmail && !validateEmail(data.contactEmail)) {
    errors.contactEmail = 'Contact Email must be valid.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  const db = getDatabase();
  const sql = `
    UPDATE employers 
    SET companyName = ?, country = ?, contactPerson = ?, contactEmail = ?, notes = ? 
    WHERE id = ?
  `;
  const params = [
    data.companyName.trim(),
    data.country || null,
    data.contactPerson || null,
    data.contactEmail || null,
    data.notes || null,
    id
  ];

  try {
    await dbRun(db, sql, params);
    
    // Return updated record
    const updatedEmployer = await dbGet(db, `
      SELECT * FROM employers WHERE id = ?
    `, [id]);

    if (!updatedEmployer) {
      return {
        success: false,
        error: 'Employer not found.'
      };
    }

    return {
      success: true,
      id,
      data: updatedEmployer
    };
  } catch (err) {
    console.error('updateEmployer error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete employer (EmployerListPage.jsx → deleteEmployer)
 * Cascades to joborders (soft delete)
 */
async function deleteEmployer(user, id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Soft delete employer
    await dbRun(db, `
      UPDATE employers SET isDeleted = 1 WHERE id = ?
    `, [id]);
    
    // Cascade soft delete to job orders
    await dbRun(db, `
      UPDATE joborders SET isDeleted = 1 WHERE employerid = ?
    `, [id]);
    
    await dbRun(db, 'COMMIT');
    
    return {
      success: true
    };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error('deleteEmployer error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get employer stats (Dashboard integration)
 */
async function getEmployerStats() {
  const db = getDatabase();
  try {
    const stats = await dbGet(db, `
      SELECT 
        COUNT(*) as totalEmployers,
        COUNT(CASE WHEN j.id IS NOT NULL THEN 1 END) as employersWithJobs
      FROM employers e
      LEFT JOIN joborders j ON e.id = j.employerid AND j.isDeleted = 0
      WHERE e.isDeleted = 0
    `);

    return {
      success: true,
      data: {
        totalEmployers: stats?.totalEmployers || 0,
        employersWithJobs: stats?.employersWithJobs || 0
      }
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get employer by ID (detail view)
 */
async function getEmployerById(id) {
  const db = getDatabase();
  try {
    const employer = await dbGet(db, `
      SELECT * FROM employers WHERE id = ? AND isDeleted = 0
    `, [id]);

    if (!employer) {
      return {
        success: false,
        error: 'Employer not found.'
      };
    }

    return {
      success: true,
      data: employer
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get deleted employers (Recycle Bin)
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
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Restore deleted employer
 */
async function restoreEmployer(id) {
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

// 🔒 EXPORTS - Exact IPC handler names from EmployerListPage.jsx
module.exports = {
  // Main CRUD
  getEmployers,
  addEmployer,
  updateEmployer,
  deleteEmployer,
  
  // Stats & Detail
  getEmployerStats,
  getEmployerById,
  
  // Recycle Bin
  getDeletedEmployers,
  restoreEmployer
};
