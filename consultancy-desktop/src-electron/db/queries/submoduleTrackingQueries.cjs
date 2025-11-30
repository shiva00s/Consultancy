const { getDatabase } = require('../database.cjs');
const { dbRun, dbGet, dbAll } = require('./dbHelpers.cjs');
const { validateRequired } = require('./validationHelpers.cjs');

// Passport Tracking
async function getPassportTracking(candidateId) {
    const db = getDatabase();
    const sql = `SELECT * FROM passport_tracking 
                 WHERE candidate_id = ? AND isDeleted = 0 
                 ORDER BY createdAt DESC`;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addPassportEntry(data) {
    const errors = {};
    if (data.passport_status === 'Received' && !data.received_date) errors.received_date = 'Received Date is required when status is "Received".';
    if (data.passport_status === 'Dispatched' && !data.dispatch_date) errors.dispatch_date = 'Dispatch Date is required when status is "Dispatched".';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO passport_tracking 
                 (candidate_id, received_date, received_notes, dispatch_date, docket_number, 
                  dispatch_notes, passport_status, source_type, agent_contact)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.received_date || null, data.received_notes || null,
        data.dispatch_date || null, data.docket_number || null, data.dispatch_notes || null,
        data.passport_status, data.source_type, data.agent_contact || null,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM passport_tracking WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function updatePassportEntry(id, data) {
    const db = getDatabase();
    
    const errors = {};
    if (data.passport_status === 'Received' && !data.received_date) errors.received_date = 'Received Date is required.';
    if (data.passport_status === 'Dispatched' && !data.dispatch_date) errors.dispatch_date = 'Dispatch Date is required.';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors };

    const sql = `UPDATE passport_tracking SET 
                 received_date = ?, received_notes = ?, dispatch_date = ?, docket_number = ?, 
                 dispatch_notes = ?, passport_status = ?, source_type = ?, agent_contact = ?
                 WHERE id = ? AND isDeleted = 0`;
                 
    const params = [
        data.received_date || null, data.received_notes || null,
        data.dispatch_date || null, data.docket_number || null, data.dispatch_notes || null,
        data.passport_status, data.source_type, data.agent_contact || null,
        id
    ];

    try {
        await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM passport_tracking WHERE id = ?', [id]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function deletePassportEntry(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'UPDATE passport_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
}


// Visa Tracking
async function getVisaTracking(candidateId) {
    const db = getDatabase();
    const sql = `SELECT * FROM visa_tracking WHERE candidate_id = ?
      AND isDeleted = 0 ORDER BY application_date DESC`;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addVisaEntry(data) {
    const errors = {};
    if (validateRequired(data.country, 'Country')) errors.country = validateRequired(data.country, 'Country');
    if (validateRequired(data.application_date, 'Application Date')) errors.application_date = validateRequired(data.application_date, 'Application Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO visa_tracking (candidate_id, country, visa_type, application_date, status, notes,
                 position, passport_number, travel_date, contact_type, agent_contact)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.country, data.visa_type || null,
        data.application_date, data.status, data.notes || null,
        data.position || null, data.passport_number || null, data.travel_date || null,
        data.contact_type, data.agent_contact || null,
    ];

    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM visa_tracking WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { 
        console.error("addVisaEntry DB Error:", err.message);
        return { success: false, error: err.message || "Database execution failed during INSERT." };
    }
}

async function updateVisaEntry(id, data) {
    const errors = {};
    if (validateRequired(data.country, 'Country')) errors.country = validateRequired(data.country, 'Country');
    if (validateRequired(data.application_date, 'Application Date')) errors.application_date = validateRequired(data.application_date, 'Application Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    
    const sql = `UPDATE visa_tracking SET 
                 country = ?, visa_type = ?, application_date = ?, status = ?, notes = ?,
                 position = ?, passport_number = ?, travel_date = ?, contact_type = ?, agent_contact = ?
                 WHERE id = ? AND isDeleted = 0`;
    
    const params = [
        data.country, data.visa_type, data.application_date,
        data.status, data.notes,
        data.position, data.passport_number, data.travel_date, data.contact_type, data.agent_contact,
        id,
    ];
    try {
        const result = await dbRun(db, sql, params);
        if (result.changes === 0) {
            return { success: false, error: 'Visa entry not found or already deleted.' };
        }
        
        const updatedRow = await dbGet(db, 'SELECT * FROM visa_tracking WHERE id = ?', [id]);
        return { success: true, data: updatedRow };
    } catch (err) { 
        return { success: false, error: err.message };
    }
}

async function deleteVisaEntry(id) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, country FROM visa_tracking WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Entry not found.' };
        await dbRun(db, 'UPDATE visa_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true, candidateId: row.candidate_id, country: row.country };
    } catch (err) { return { success: false, error: err.message }; }
}

// Medical Tracking
async function getMedicalTracking(candidateId) {
    const db = getDatabase();
    const sql = 'SELECT * FROM medical_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY test_date DESC';
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addMedicalEntry(data) {
    const errors = {};
    if (validateRequired(data.test_date, 'Test Date')) errors.test_date = validateRequired(data.test_date, 'Test Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO medical_tracking (candidate_id, test_date, certificate_path, status, notes)
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.test_date, data.certificate_path,
        data.status, data.notes,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM medical_tracking WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function updateMedicalEntry(id, data) {
    const errors = {};
    if (validateRequired(data.test_date, 'Test Date')) errors.test_date = validateRequired(data.test_date, 'Test Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `UPDATE medical_tracking SET 
                 test_date = ?, certificate_path = ?, status = ?, notes = ?
                 WHERE id = ? AND isDeleted = 0`;
    const params = [
        data.test_date, data.certificate_path || null, data.status, data.notes || null, id,
    ];
    try {
        const result = await dbRun(db, sql, params);
        if (result.changes === 0) {
            return { success: false, error: 'Medical entry not found or already deleted.' };
        }
        const updatedRow = await dbGet(db, 'SELECT * FROM medical_tracking WHERE id = ?', [id]);
        return { success: true, data: updatedRow };
    } catch (err) { return { success: false, error: err.message }; }
}

async function deleteMedicalEntry(id) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, test_date, status FROM medical_tracking WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Entry not found.' };
        await dbRun(db, 'UPDATE medical_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true, candidateId: row.candidate_id, test_date: row.test_date, status: row.status };
    } catch (err) { return { success: false, error: err.message }; }
}

// Travel Tracking
async function getTravelTracking(candidateId) {
    const db = getDatabase();
    const sql = 'SELECT * FROM travel_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY travel_date DESC';
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addTravelEntry(data) {
    const errors = {};
    if (validateRequired(data.travel_date, 'Travel Date')) errors.travel_date = validateRequired(data.travel_date, 'Travel Date');
    if (validateRequired(data.departure_city, 'Departure City')) errors.departure_city = validateRequired(data.departure_city, 'Departure City');
    if (validateRequired(data.arrival_city, 'Arrival City')) errors.arrival_city = validateRequired(data.arrival_city, 'Arrival City');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO travel_tracking (candidate_id, pnr, travel_date, ticket_file_path, departure_city, arrival_city, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.pnr || null, data.travel_date,
        data.ticket_file_path || null, data.departure_city || null,
        data.arrival_city || null, data.notes || null,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM travel_tracking WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function updateTravelEntry(id, data) {
    const errors = {};
    if (validateRequired(data.travel_date, 'Travel Date')) errors.travel_date = validateRequired(data.travel_date, 'Travel Date');
    if (validateRequired(data.departure_city, 'Departure City')) errors.departure_city = validateRequired(data.departure_city, 'Departure City');
    if (validateRequired(data.arrival_city, 'Arrival City')) errors.arrival_city = validateRequired(data.arrival_city, 'Arrival City');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `UPDATE travel_tracking SET 
                 pnr = ?, travel_date = ?, ticket_file_path = ?, departure_city = ?, arrival_city = ?, notes = ?
                 WHERE id = ? AND isDeleted = 0`;
    const params = [
        data.pnr || null, data.travel_date, data.ticket_file_path || null, data.departure_city, 
        data.arrival_city, data.notes || null, id,
    ];
    try {
        const result = await dbRun(db, sql, params);
        if (result.changes === 0) {
            return { success: false, error: 'Travel entry not found or already deleted.' };
        }
        const updatedRow = await dbGet(db, 'SELECT * FROM travel_tracking WHERE id = ?', [id]);
        return { success: true, data: updatedRow };
    } catch (err) { return { success: false, error: err.message }; }
}

async function deleteTravelEntry(id) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, travel_date FROM travel_tracking WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Entry not found.' };
        await dbRun(db, 'UPDATE travel_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true, candidateId: row.candidate_id, travel_date: row.travel_date };
    } catch (err) { return { success: false, error: err.message }; }
}

// Interview Tracking
async function getInterviewTracking(candidateId) {
    const db = getDatabase();
    const sql = `
      SELECT i.*, j.positionTitle, e.companyName
      FROM interview_tracking i
      LEFT JOIN job_orders j ON i.job_order_id = j.id
      LEFT JOIN employers e ON j.employer_id = e.id
      WHERE i.candidate_id = ? AND i.isDeleted = 0
      ORDER BY i.interview_date DESC
    `;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addInterviewEntry(data) {
    const errors = {};
    if (validateRequired(data.job_order_id, 'Job Order')) errors.job_order_id = validateRequired(data.job_order_id, 'Job Order');
    if (validateRequired(data.interview_date, 'Interview Date')) errors.interview_date = validateRequired(data.interview_date, 'Interview Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `INSERT INTO interview_tracking (candidate_id, job_order_id, interview_date, round, status, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.job_order_id, data.interview_date,
        data.round, data.status, data.notes,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const getSql = `
          SELECT i.*, j.positionTitle, e.companyName
          FROM interview_tracking i
          LEFT JOIN job_orders j ON i.job_order_id = j.id
          LEFT JOIN employers e ON j.employer_id = e.id
          WHERE i.id = ?
        `;
        const row = await dbGet(db, getSql, [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function updateInterviewEntry(id, data) {
    const errors = {};
    if (validateRequired(data.job_order_id, 'Job Order')) errors.job_order_id = validateRequired(data.job_order_id, 'Job Order');
    if (validateRequired(data.interview_date, 'Interview Date')) errors.interview_date = validateRequired(data.interview_date, 'Interview Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

    const db = getDatabase();
    const sql = `UPDATE interview_tracking SET 
                 job_order_id = ?, interview_date = ?, round = ?, status = ?, notes = ?
                 WHERE id = ? AND isDeleted = 0`;
    const params = [
        data.job_order_id, data.interview_date, data.round || null, data.status, data.notes || null, id,
    ];
    try {
        const result = await dbRun(db, sql, params);
        if (result.changes === 0) {
            return { success: false, error: 'Interview entry not found or already deleted.' };
        }
        const getSql = `
            SELECT i.*, j.positionTitle, e.companyName
            FROM interview_tracking i
            LEFT JOIN job_orders j ON i.job_order_id = j.id
            LEFT JOIN employers e ON j.employer_id = e.id
            WHERE i.id = ?
        `;
        const updatedRow = await dbGet(db, getSql, [id]);
        return { success: true, data: updatedRow };
    } catch (err) { return { success: false, error: err.message }; }
}

async function deleteInterviewEntry(id) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, interview_date, round FROM interview_tracking WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Entry not found.' };
        await dbRun(db, 'UPDATE interview_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true, candidateId: row.candidate_id, interview_date: row.interview_date, round: row.round };
    } catch (err) { return { success: false, error: err.message }; }
}

// Kanban Board Functions
async function getAllActiveVisas() {
    const db = getDatabase();
    const sql = `
      SELECT 
        v.id, v.candidate_id, v.country, v.visa_type, v.status, v.application_date,
        c.name as candidateName, 
        c.passportNo
      FROM visa_tracking v
      JOIN candidates c ON v.candidate_id = c.id
      WHERE v.isDeleted = 0 AND c.isDeleted = 0
      ORDER BY v.application_date DESC
    `;
    try {
      const rows = await dbAll(db, sql, []);
      return { success: true, data: rows };
    } catch (err) {
      return { success: false, error: err.message };
    }
}

async function updateVisaStatus(id, status) {
    const db = getDatabase();
    try {
      await dbRun(db, 'UPDATE visa_tracking SET status = ? WHERE id = ?', [status, id]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
}

module.exports = {
    getPassportTracking,
    addPassportEntry,
    updatePassportEntry,
    deletePassportEntry,
    getVisaTracking,
    addVisaEntry,
    updateVisaEntry,
    deleteVisaEntry,
    getMedicalTracking,
    addMedicalEntry,
    updateMedicalEntry,
    deleteMedicalEntry,
    getTravelTracking,
    addTravelEntry,
    updateTravelEntry,
    deleteTravelEntry,
    getInterviewTracking,
    addInterviewEntry,
    updateInterviewEntry,
    deleteInterviewEntry,
    getAllActiveVisas,
    updateVisaStatus,
};
