// =====================================
// JOB ORDER QUERIES (STRICT DOMAIN SPLIT)
// =====================================

const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet, dbAll } = require("../db/dbHelpers.cjs");

// -------------------------------------
// VALIDATION HELPERS
// -------------------------------------
function isEmpty(v) {
    return !v || (typeof v === "string" && v.trim() === "");
}

function validateJobInput(data) {
    const errors = {};

    if (isEmpty(data.positionTitle))
        errors.positionTitle = "Position title is required.";

    if (isEmpty(data.country))
        errors.country = "Country is required.";

    if (!data.employerId)
        errors.employerId = "Employer is required.";

    if (data.salary && isNaN(data.salary))
        errors.salary = "Salary must be a valid number.";

    return errors;
}

// -------------------------------------
// CREATE JOB ORDER
// -------------------------------------
async function addJobOrder(data) {
    const db = getDatabase();

    const validationErrors = validateJobInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    const sql = `
        INSERT INTO job_orders (
            employer_id,
            positionTitle,
            country,
            salary,
            description,
            requirements,
            createdAt,
            updatedAt,
            isDeleted
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
    `;

    const params = [
        data.employerId,
        data.positionTitle,
        data.country,
        data.salary || "",
        data.description || "",
        data.requirements || ""
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
// UPDATE JOB ORDER
// -------------------------------------
async function updateJobOrder(id, data) {
    const db = getDatabase();

    const validationErrors = validateJobInput(data);
    if (Object.keys(validationErrors).length > 0) {
        return { success: false, error: "Validation failed", errors: validationErrors };
    }

    const sql = `
        UPDATE job_orders SET
            employer_id = ?,
            positionTitle = ?,
            country = ?,
            salary = ?,
            description = ?,
            requirements = ?,
            updatedAt = datetime('now')
        WHERE id = ? AND isDeleted = 0
    `;

    const params = [
        data.employerId,
        data.positionTitle,
        data.country,
        data.salary || "",
        data.description || "",
        data.requirements || "",
        id
    ];

    try {
        const res = await dbRun(db, sql, params);

        if (!res.changes)
            return { success: false, error: "Job order not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// SOFT DELETE
// -------------------------------------
async function deleteJobOrderSoft(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            "UPDATE job_orders SET isDeleted = 1 WHERE id = ?",
            [id]
        );

        if (!res.changes)
            return { success: false, error: "Job order not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function restoreJobOrder(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            "UPDATE job_orders SET isDeleted = 0 WHERE id = ?",
            [id]
        );

        if (!res.changes)
            return { success: false, error: "Job order not found." };

        return { success: true };

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET ALL JOB ORDERS (JOINED WITH EMPLOYER)
// -------------------------------------
async function getJobOrders() {
    const sql = `
        SELECT 
            j.id,
            j.positionTitle,
            j.country,
            j.salary,
            j.createdAt,
            e.companyName,
            (
                SELECT COUNT(*)
                FROM placements p
                WHERE p.job_order_id = j.id AND p.isDeleted = 0
            ) AS assignedCount
        FROM job_orders j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.isDeleted = 0
        ORDER BY j.id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// SEARCH JOB ORDERS
// -------------------------------------
async function searchJobOrders(keyword) {
    const kw = `%${keyword}%`;

    const sql = `
        SELECT 
            j.id,
            j.positionTitle,
            j.country,
            j.salary,
            e.companyName
        FROM job_orders j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.isDeleted = 0
        AND (
            j.positionTitle LIKE ? OR
            j.country LIKE ? OR
            e.companyName LIKE ?
        )
        ORDER BY j.positionTitle ASC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql, [kw, kw, kw]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET JOBS BY EMPLOYER
// -------------------------------------
async function getJobOrdersByEmployer(employerId) {
    const sql = `
        SELECT 
            id,
            positionTitle,
            country,
            salary,
            createdAt
        FROM job_orders
        WHERE employer_id = ?
        AND isDeleted = 0
        ORDER BY id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql, [employerId]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// GET UNASSIGNED JOB ORDERS FOR A CANDIDATE
// -------------------------------------
async function getUnassignedJobsForCandidate(candidateId) {
    const sql = `
        SELECT 
            j.id,
            j.positionTitle,
            j.country,
            e.companyName
        FROM job_orders j
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE j.isDeleted = 0
        AND j.id NOT IN (
            SELECT job_order_id
            FROM placements
            WHERE candidate_id = ? AND isDeleted = 0
        )
        ORDER BY j.id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// -------------------------------------
// EXPORTS
// -------------------------------------
module.exports = {
    addJobOrder,
    updateJobOrder,
    deleteJobOrderSoft,
    restoreJobOrder,
    getJobOrders,
    searchJobOrders,
    getJobOrdersByEmployer,
    getUnassignedJobsForCandidate
};
