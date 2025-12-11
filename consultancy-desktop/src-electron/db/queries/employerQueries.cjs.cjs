// =====================================
// EMPLOYER QUERIES (STRICT DOMAIN SPLIT)
// =====================================

const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet, dbAll } = require("../db/dbHelpers.cjs");

// -------------------------------------
// VALIDATION HELPERS
// -------------------------------------
function isEmpty(v) {
    return !v || (typeof v === "string" && v.trim() === "");
}

function validateEmployerInput(data) {
    const errors = {};

    if (isEmpty(data.companyName))
        errors.companyName = "Company name is required.";

    if (isEmpty(data.country))
        errors.country = "Country is required.";

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        errors.email = "Invalid email format.";

    return errors;
}

// -------------------------------------
// DUPLICATES
// -------------------------------------
async function checkDuplicateCompanyName(companyName, excludeId = null) {
    if (!companyName) return false;

    let sql = `SELECT id FROM employers WHERE companyName = ? AND isDeleted = 0`;
    const params = [companyName];

    if (excludeId) {
        sql += " AND id <> ?";
        params.push(excludeId);
    }

    return await dbGet(getDatabase(), sql, params);
}

// -------------------------------------
// CREATE EMPLOYER
// -------------------------------------
async function addEmployer(data) {
    const db = getDatabase();

    const validationErrors = validateEmployerInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    // Duplicate check
    if (await checkDuplicateCompanyName(data.companyName)) {
        return { success: false, error: "Company name already exists." };
    }

    const sql = `
        INSERT INTO employers (
            companyName,
            contactPerson,
            phone,
            email,
            address,
            country,
            createdAt,
            updatedAt,
            isDeleted
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
    `;

    const params = [
        data.companyName,
        data.contactPerson || "",
        data.phone || "",
        data.email || "",
        data.address || "",
        data.country,
    ];

    try {
        const result = await dbRun(db, sql, params);

        return {
            success: true,
            data: { id: result.lastID }
        };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// UPDATE EMPLOYER
// -------------------------------------
async function updateEmployer(id, data) {
    const db = getDatabase();

    const validationErrors = validateEmployerInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    // Duplicate check
    if (await checkDuplicateCompanyName(data.companyName, id)) {
        return { success: false, error: "Company name already exists." };
    }

    const sql = `
        UPDATE employers SET
            companyName = ?,
            contactPerson = ?,
            phone = ?,
            email = ?,
            address = ?,
            country = ?,
            updatedAt = datetime('now')
        WHERE id = ? AND isDeleted = 0
    `;

    const params = [
        data.companyName,
        data.contactPerson || "",
        data.phone || "",
        data.email || "",
        data.address || "",
        data.country,
        id
    ];

    try {
        const res = await dbRun(db, sql, params);

        if (!res.changes)
            return { success: false, error: "Employer not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// SOFT DELETE EMPLOYER
// -------------------------------------
async function deleteEmployerSoft(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            "UPDATE employers SET isDeleted = 1 WHERE id = ?",
            [id]
        );

        if (!res.changes)
            return { success: false, error: "Employer not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function restoreEmployer(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            "UPDATE employers SET isDeleted = 0 WHERE id = ?",
            [id]
        );

        if (!res.changes)
            return { success: false, error: "Employer not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET EMPLOYER LIST
// -------------------------------------
async function getEmployers() {
    const sql = `
        SELECT id, companyName, country, contactPerson, phone, email
        FROM employers
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
// SEARCH EMPLOYERS
// -------------------------------------
async function searchEmployers(keyword) {
    const kw = `%${keyword}%`;

    const sql = `
        SELECT id, companyName, country, phone, email
        FROM employers
        WHERE isDeleted = 0
        AND (
            companyName LIKE ? OR
            phone LIKE ? OR
            email LIKE ?
        )
        ORDER BY companyName ASC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql, [kw, kw, kw]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET EMPLOYER BY ID
// -------------------------------------
async function getEmployerById(id) {
    const sql = `
        SELECT *
        FROM employers
        WHERE id = ? AND isDeleted = 0
        LIMIT 1
    `;

    try {
        const row = await dbGet(getDatabase(), sql, [id]);
        if (!row) return { success: false, error: "Employer not found." };

        return { success: true, data: row };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// EXPORTS
// -------------------------------------
module.exports = {
    addEmployer,
    updateEmployer,
    deleteEmployerSoft,
    restoreEmployer,
    getEmployers,
    searchEmployers,
    getEmployerById
};
