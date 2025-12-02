// =============================================
// PLACEMENT QUERIES (STRICT DOMAIN MODULE)
// =============================================

const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet, dbAll } = require("../db/dbHelpers.cjs");

// ---------------------------------------------------------
// GET ALL ACTIVE PLACEMENTS FOR A CANDIDATE
// ---------------------------------------------------------
async function getCandidatePlacements(candidateId) {
    const sql = `
        SELECT
            p.id AS placementId,
            p.job_order_id,
            p.candidate_id,
            p.status AS placementStatus,
            j.positionTitle,
            j.country,
            e.companyName
        FROM placements p
        JOIN job_orders j ON p.job_order_id = j.id
        JOIN employers e ON j.employer_id = e.id
        WHERE p.candidate_id = ?
        AND p.isDeleted = 0
        ORDER BY p.id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) {
        console.error("getCandidatePlacements Error:", err);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// UNASSIGNED JOBS FOR A CANDIDATE
// (Frontend uses this in <CandidateJobs/>)
// ---------------------------------------------------------
async function getUnassignedJobs(candidateId) {
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
            SELECT job_order_id FROM placements
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

// ---------------------------------------------------------
// ASSIGN CANDIDATE TO JOB
// ---------------------------------------------------------
async function assignCandidateToJob(candidateId, jobId) {
    const db = getDatabase();

    // ✅ Prevent duplicate assignment
    const existing = await dbGet(
        db,
        `SELECT id FROM placements 
         WHERE candidate_id = ? AND job_order_id = ? AND isDeleted = 0`,
        [candidateId, jobId]
    );

    if (existing) {
        return {
            success: false,
            error: "Candidate is already assigned to this job."
        };
    }

    // Insert placement
    const sql = `
        INSERT INTO placements (
            candidate_id,
            job_order_id,
            status,
            createdAt,
            isDeleted
        )
        VALUES (?, ?, 'Assigned', datetime('now'), 0)
    `;

    try {
        const result = await dbRun(db, sql, [candidateId, jobId]);

        // Return FULL row for UI because your React expects it
        const detail = await dbGet(
            db,
            `
            SELECT
                p.id AS placementId,
                p.status AS placementStatus,
                j.positionTitle,
                j.country,
                e.companyName
            FROM placements p
            JOIN job_orders j ON p.job_order_id = j.id
            JOIN employers e ON j.employer_id = e.id
            WHERE p.id = ?
        `,
            [result.lastID]
        );

        return { success: true, data: detail };
    } catch (err) {
        console.error("assignCandidateToJob Error:", err);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// REMOVE (SOFT DELETE) PLACEMENT
// ---------------------------------------------------------
async function removeCandidateFromJob(placementId) {
    const db = getDatabase();

    try {
        const placement = await dbGet(
            db,
            `SELECT candidate_id, job_order_id FROM placements WHERE id = ?`,
            [placementId]
        );

        if (!placement) {
            return { success: false, error: "Placement not found." };
        }

        await dbRun(
            db,
            `UPDATE placements SET isDeleted = 1 WHERE id = ?`,
            [placementId]
        );

        return {
            success: true,
            candidateId: placement.candidate_id,
            jobId: placement.job_order_id
        };
    } catch (err) {
        console.error("removeCandidateFromJob Error:", err);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// RECYCLE BIN SUPPORT
// ---------------------------------------------------------
async function getDeletedPlacements() {
    const sql = `
        SELECT
            p.id,
            c.name AS candidateName,
            j.positionTitle,
            e.companyName,
            p.createdAt
        FROM placements p
        JOIN candidates c ON c.id = p.candidate_id
        JOIN job_orders j ON j.id = p.job_order_id
        JOIN employers e ON j.employer_id = e.id
        WHERE p.isDeleted = 1
        ORDER BY p.id DESC
    `;

    try {
        const rows = await dbAll(getDatabase(), sql);
        return { success: true, data: rows };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// RESTORE PLACEMENT
// ---------------------------------------------------------
async function restorePlacement(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            `UPDATE placements SET isDeleted = 0 WHERE id = ?`,
            [id]
        );

        if (!res.changes) {
            return { success: false, error: "Placement not found." };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// PERMANENT DELETE (SuperAdmin Only)
// ---------------------------------------------------------
async function deletePlacementPermanently(id) {
    try {
        const res = await dbRun(
            getDatabase(),
            `DELETE FROM placements WHERE id = ?`,
            [id]
        );

        if (!res.changes) {
            return { success: false, error: "Placement not found." };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------
// EXPORT API
// ---------------------------------------------------------
module.exports = {
    getCandidatePlacements,
    getUnassignedJobs,
    assignCandidateToJob,
    removeCandidateFromJob,
    getDeletedPlacements,
    restorePlacement,
    deletePlacementPermanently
};
