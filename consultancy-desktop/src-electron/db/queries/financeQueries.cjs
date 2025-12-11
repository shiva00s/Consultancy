const { getDatabase } = require('../database.cjs');
const { dbRun, dbGet, dbAll } = require('./dbHelpers.cjs');
const { validateRequired, validatePositiveNumber } = require('./validationHelpers.cjs');
const { checkAdminFeatureAccess } = require('./userAuthQueries.cjs');

async function getCandidatePayments(candidateId) {
    const db = getDatabase();
    const sql = `SELECT * FROM payments WHERE candidate_id = ? AND isDeleted = 0 ORDER BY created_at DESC`;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addPayment(user, data) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const errors = {};
    if (validateRequired(data.description, 'Description')) errors.description = validateRequired(data.description, 'Description');
    if (validateRequired(data.total_amount, 'Total Amount')) errors.total_amount = validateRequired(data.total_amount, 'Total Amount');
    if (!errors.total_amount && validatePositiveNumber(data.total_amount, 'Total Amount')) errors.total_amount = validatePositiveNumber(data.total_amount, 'Total Amount');
    if (data.amount_paid && validatePositiveNumber(data.amount_paid, 'Amount Paid')) errors.amount_paid = validatePositiveNumber(data.amount_paid, 'Amount Paid');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO payments (candidate_id, description, total_amount, amount_paid, status, due_date)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.description, data.total_amount,
        data.amount_paid, data.status, data.due_date,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function updatePayment(data) {
    const { user, id, total_amount, amount_paid, status } = data;
    
    const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const errors = {};
    
    if (!id) errors.id = 'Payment ID is required.';
    if (total_amount !== undefined && total_amount !== null) {
        const parsedTotal = parseFloat(total_amount);
        if (isNaN(parsedTotal) || parsedTotal <= 0) {
            errors.total_amount = 'Total Amount must be a positive number.';
        }
    }

    if (amount_paid !== undefined && amount_paid !== null) {
        const parsedPaid = parseFloat(amount_paid);
        if (isNaN(parsedPaid) || parsedPaid < 0) {
            errors.amount_paid = 'Amount Paid must be a valid non-negative number.';
        }
    } else {
        errors.amount_paid = 'Amount Paid value is required for update.';
    }

    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
    
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, description FROM payments WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Payment not found.' };

        const totalValue = total_amount === undefined || total_amount === null ? null : parseFloat(total_amount);
        const paidValue = amount_paid === undefined || amount_paid === null ? null : parseFloat(amount_paid);
        const sql = `UPDATE payments SET 
                         total_amount = COALESCE(?, total_amount),
                         amount_paid = COALESCE(?, amount_paid), 
                         status = COALESCE(?, status) 
                         WHERE id = ?`;
        await dbRun(db, sql, [totalValue, paidValue, status, id]);
        const updatedRow = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [id]);
        return { success: true, data: updatedRow, candidateId: row.candidate_id, description: row.description };
    } catch (err) { 
        return { success: false, error: err.message || 'Database execution failed.' }; 
    }
}

async function deletePayment(user, id) {
    const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
    if (!accessCheck.success) return accessCheck;
    
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, description, total_amount FROM payments WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Payment not found.' };
        await dbRun(db, 'UPDATE payments SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true, candidateId: row.candidate_id, description: row.description, total_amount: row.total_amount };
    } catch (err) { return { success: false, error: err.message }; }
}

module.exports = {
    getCandidatePayments,
    addPayment,
    updatePayment,
    deletePayment,
};
