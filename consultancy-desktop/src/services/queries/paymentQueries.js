// src/services/queries/paymentQueries.js
// 💰 Payment Tracking for CandidateFinance.jsx
// CRUD + auto-status (Pending/Partial/Paid/Refunded) + due date

const getDatabase = require('../database.cjs');
const { dbAll, dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired, validatePositiveNumber } = require('./utils.cjs');

/**
 * Get candidate payments (CandidateFinance.jsx → getCandidatePayments)
 * Active records only + ORDER BY createdat DESC
 */
async function getCandidatePayments(user, candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT * FROM payments 
    WHERE candidateid = ? AND isDeleted = 0 
    ORDER BY createdat DESC
  `;
  
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getCandidatePayments error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Add payment (CandidateFinance.jsx → addPayment)
 * Auto-calculates status: Pending/Partial/Paid
 */
async function addPayment(user, data) {
  const errors = {};
  
  // Validation
  if (validateRequired(data.description, 'Description')) {
    errors.description = validateRequired(data.description, 'Description');
  }
  if (validateRequired(data.totalamount, 'Total Amount')) {
    errors.totalamount = validateRequired(data.totalamount, 'Total Amount');
  } else {
    errors.totalamount = validatePositiveNumber(data.totalamount, 'Total Amount');
  }
  if (data.amountpaid !== undefined && data.amountpaid !== null) {
    errors.amountpaid = validatePositiveNumber(data.amountpaid, 'Amount Paid');
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  const totalamount = parseFloat(data.totalamount);
  const amountpaid = parseFloat(data.amountpaid || 0);
  
  // Auto-calculate status
  let status = 'Pending';
  if (amountpaid >= totalamount) {
    status = 'Paid';
  } else if (amountpaid > 0) {
    status = 'Partial';
  }
  
  const sql = `
    INSERT INTO payments (candidateid, description, totalamount, amountpaid, status, duedate)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.candidateid,
    data.description,
    totalamount,
    amountpaid,
    status,
    data.duedate || null
  ];
  
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [result.lastID]);
    
    return {
      success: true,
      data: row
    };
  } catch (err) {
    console.error('addPayment error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Update payment (CandidateFinance.jsx → updatePayment)
 * amountpaid + status only (partial updates)
 */
async function updatePayment(user, id, amountpaid, status) {
  const errors = {};
  const parsedPaid = parseFloat(amountpaid);
  
  if (isNaN(parsedPaid) && parsedPaid !== 0) {
    errors.amountpaid = 'Amount Paid must be a valid non-negative number.';
  }
  
  if (!['Pending', 'Partial', 'Paid', 'Refunded'].includes(status)) {
    errors.status = 'Invalid payment status.';
  }
  
  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors)
    };
  }
  
  const db = getDatabase();
  
  try {
    // Verify payment exists
    const row = await dbGet(db, `
      SELECT candidateid, description 
      FROM payments 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Payment not found.')
      };
    }
    
    // Partial update
    const sql = `
      UPDATE payments 
      SET amountpaid = COALESCE(?, amountpaid),
          status = COALESCE(?, status)
      WHERE id = ?
    `;
    
    await dbRun(db, sql, [parsedPaid, status, id]);
    
    const updatedRow = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [id]);
    
    return {
      success: true,
      data: updatedRow,
      candidateId: row.candidateid,
      description: row.description
    };
  } catch (err) {
    console.error('updatePayment error:', err);
    return {
      success: false,
      error: mapErrorToFriendly('Database execution failed.')
    };
  }
}

/**
 * Soft delete payment (CandidateFinance.jsx → deletePayment)
 * Moves to Recycle Bin
 */
async function deletePayment(user, id) {
  const db = getDatabase();
  
  try {
    const row = await dbGet(db, `
      SELECT candidateid, description, totalamount 
      FROM payments 
      WHERE id = ? AND isDeleted = 0
    `, [id]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Payment not found.')
      };
    }
    
    await dbRun(db, `
      UPDATE payments 
      SET isDeleted = 1 
      WHERE id = ?
    `, [id]);
    
    return {
      success: true,
      candidateId: row.candidateid,
      description: row.description,
      totalamount: row.totalamount
    };
  } catch (err) {
    console.error('deletePayment error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateFinance.jsx
module.exports = {
  getCandidatePayments,
  addPayment,
  updatePayment,
  deletePayment
};
