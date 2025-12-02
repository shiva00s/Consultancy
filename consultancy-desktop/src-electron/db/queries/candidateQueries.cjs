// =====================================
// CANDIDATE QUERIES (STRICT DOMAIN SPLIT)
// =====================================

const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet, dbAll } = require("../db/dbHelpers.cjs");

// -------------------------------------
// VALIDATION HELPERS
// -------------------------------------
function isEmpty(v) {
    return !v || (typeof v === "string" && v.trim() === "");
}

function validateCandidateInput(data) {
    const errors = {};

    if (isEmpty(data.name)) errors.name = "Name is required.";
    if (isEmpty(data.gender)) errors.gender = "Gender is required.";
    if (isEmpty(data.phone)) errors.phone = "Phone number is required.";

    if (data.passportNo && data.passportNo.length < 6)
        errors.passportNo = "Passport number seems too short.";

    if (data.aadhar && data.aadhar.length !== 12)
        errors.aadhar = "Aadhar number must be exactly 12 digits.";

    return errors;
}

// -------------------------------------
// DUPLICATE CHECK HELPERS
// -------------------------------------
async function checkDuplicatePassport(passportNo, excludeId = null) {
    if (!passportNo) return false;

    let sql = `SELECT id FROM candidates WHERE passportNo = ? AND isDeleted = 0`;
    const params = [passportNo];

    if (excludeId) {
        sql += ` AND id <> ?`;
        params.push(excludeId);
    }

    return await dbGet(getDatabase(), sql, params);
}

async function checkDuplicateAadhar(aadhar, excludeId = null) {
    if (!aadhar) return false;

    let sql = `SELECT id FROM candidates WHERE aadhar = ? AND isDeleted = 0`;
    const params = [aadhar];

    if (excludeId) {
        sql += ` AND id <> ?`;
        params.push(excludeId);
    }

    return await dbGet(getDatabase(), sql, params);
}

// -------------------------------------
// CREATE CANDIDATE
// -------------------------------------
async function addCandidate(data) {
    const db = getDatabase();

    const validationErrors = validateCandidateInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    // Duplicate checks
    if (await checkDuplicatePassport(data.passportNo)) {
        return { success: false, error: "Passport number already exists." };
    }

    if (await checkDuplicateAadhar(data.aadhar)) {
        return { success: false, error: "Aadhar number already exists." };
    }

    const sql = `
        INSERT INTO candidates
        (name, gender, phone, email, passportNo, aadhar, address, birthDate, remarks, createdAt, updatedAt, isDeleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
    `;

    const params = [
        data.name,
        data.gender,
        data.phone,
        data.email || "",
        data.passportNo || "",
        data.aadhar || "",
        data.address || "",
        data.birthDate || "",
        data.remarks || "",
    ];

    try {
        const result = await dbRun(db, sql, params);
        return { success: true, data: { id: result.lastID } };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// UPDATE CANDIDATE
// -------------------------------------
async function updateCandidate(id, data) {
    const db = getDatabase();

    const validationErrors = validateCandidateInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    // Duplicate checks
    if (await checkDuplicatePassport(data.passportNo, id)) {
        return { success: false, error: "Passport number already exists." };
    }

    if (await checkDuplicateAadhar(data.aadhar, id)) {
        return { success: false, error: "Aadhar number already exists." };
    }

    const sql = `
        UPDATE candidates SET
            name = ?, gender = ?, phone = ?, email = ?, passportNo = ?, aadhar = ?, 
            address = ?, birthDate = ?, remarks = ?, updatedAt = datetime('now')
        WHERE id = ? AND isDeleted = 0
    `;

    const params = [
        data.name,
        data.gender,
        data.phone,
        data.email || "",
        data.passportNo || "",
        data.aadhar || "",
        data.address || "",
        data.birthDate || "",
        data.remarks || "",
        id,
    ];

    try {
        const r = await dbRun(db, sql, params);
        if (!r.changes) return { success: false, error: "Candidate not found." };

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// SOFT DELETE (RECYCLE BIN)
// -------------------------------------
async function deleteCandidateSoft(id) {
    try {
        const r = await dbRun(
            getDatabase(),
            "UPDATE candidates SET isDeleted = 1, updatedAt = datetime('now') WHERE id = ?",
            [id]
        );

        if (!r.changes) return { success: false, error: "Candidate not found." };

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function restoreCandidate(id) {
    try {
        const r = await dbRun(
            getDatabase(),
            "UPDATE candidates SET isDeleted = 0 WHERE id = ?",
            [id]
        );

        if (!r.changes) return { success: false, error: "Candidate not found." };

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET CANDIDATE LIST
// -------------------------------------
async function getCandidates() {
    const sql = `
        SELECT id, name, gender, phone, email, passportNo, aadhar, country, createdAt
        FROM candidates
        WHERE isDeleted = 0
        ORDER BY id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// SEARCH CANDIDATES
// -------------------------------------
async function searchCandidates(keyword) {
    const sql = `
        SELECT id, name, phone, passportNo, aadhar, gender
        FROM candidates
        WHERE isDeleted = 0
        AND (
            name LIKE ? OR
            phone LIKE ? OR
            passportNo LIKE ? OR
            aadhar LIKE ?
        )
        ORDER BY name ASC
    `;

    const kw = `%${keyword}%`;

    try {
        const rows = await dbAll(getDatabase(), sql, [kw, kw, kw, kw]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET CANDIDATE BY ID
// -------------------------------------
async function getCandidateById(id) {
    const sql = `
        SELECT *
        FROM candidates
        WHERE id = ? AND isDeleted = 0
        LIMIT 1
    `;

    try {
        const row = await dbGet(getDatabase(), sql, [id]);
        if (!row) return { success: false, error: "Candidate not found." };

        return { success: true, data: row };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// EXPORTS
// -------------------------------------
module.exports = {
    addCandidate,
    updateCandidate,
    deleteCandidateSoft,
    restoreCandidate,
    getCandidates,
    searchCandidates,
    getCandidateById,
};
