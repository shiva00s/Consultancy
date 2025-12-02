const { ipcMain } = require("electron");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerRecycleBinHandlers() {
    const db = getDatabase();

    // =======================================================================
    // 🔹 GENERIC HELPER TO WRAP SIMPLE DB QUERIES
    // =======================================================================
    function simpleListHandler(sql) {
        return new Promise((resolve) => {
            db.all(sql, [], (err, rows) => {
                if (err) return resolve({ success: false, error: err.message });
                resolve({ success: true, data: rows });
            });
        });
    }

    function simpleUpdateHandler(sql, id) {
        return new Promise((resolve, reject) => {
            db.run(sql, [id], function (err) {
                if (err) return reject({ success: false, error: err.message });
                resolve({ success: true });
            });
        });
    }

    // =======================================================================
    // 🔥 1️⃣ CANDIDATES
    // =======================================================================
    ipcMain.handle("get-deleted-candidates", () =>
        queries.getDeletedCandidates()
    );

    ipcMain.handle("restore-candidate", async (event, { user, id }) => {
        const result = await queries.restoreCandidate(id);
        if (result.success) {
            logAction(user, "restore_candidate", "candidates", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 2️⃣ EMPLOYERS
    // =======================================================================
    ipcMain.handle("get-deleted-employers", () =>
        queries.getDeletedEmployers()
    );

    ipcMain.handle("restore-employer", async (event, { user, id }) => {
        const result = await queries.restoreEmployer(id);
        if (result.success) {
            logAction(user, "restore_employer", "employers", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 3️⃣ JOB ORDERS
    // =======================================================================
    ipcMain.handle("get-deleted-job-orders", () =>
        queries.getDeletedJobOrders()
    );

    ipcMain.handle("restore-job-order", async (event, { user, id }) => {
        const result = await queries.restoreJobOrder(id);
        if (result.success) {
            logAction(user, "restore_job", "job_orders", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 4️⃣ PLACEMENTS
    // =======================================================================
    ipcMain.handle("get-deleted-placements", () =>
        queries.getDeletedPlacements()
    );

    ipcMain.handle("restore-placement", async (event, { user, id }) => {
        const result = await queries.restorePlacement(id);
        if (result.success) {
            logAction(user, "restore_placement", "placements", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 5️⃣ PASSPORT
    // =======================================================================
    ipcMain.handle("get-deleted-passports", () =>
        queries.getDeletedPassports()
    );

    ipcMain.handle("restore-passport", async (event, { user, id }) => {
        const result = await queries.restorePassport(id);
        if (result.success) {
            logAction(user, "restore_passport", "passport_tracking", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 6️⃣ VISA
    // =======================================================================
    ipcMain.handle("get-deleted-visas", () =>
        queries.getDeletedVisas()
    );

    ipcMain.handle("restore-visa", async (event, { user, id }) => {
        const result = await queries.restoreVisa(id);
        if (result.success) {
            logAction(user, "restore_visa", "visa_tracking", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 7️⃣ MEDICAL
    // =======================================================================
    ipcMain.handle("get-deleted-medical", () =>
        queries.getDeletedMedical()
    );

    ipcMain.handle("restore-medical", async (event, { user, id }) => {
        const result = await queries.restoreMedical(id);
        if (result.success) {
            logAction(user, "restore_medical", "medical_tracking", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 8️⃣ INTERVIEWS
    // =======================================================================
    ipcMain.handle("get-deleted-interviews", () =>
        queries.getDeletedInterviews()
    );

    ipcMain.handle("restore-interview", async (event, { user, id }) => {
        const result = await queries.restoreInterview(id);
        if (result.success) {
            logAction(user, "restore_interview", "interview_tracking", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 9️⃣ TRAVEL
    // =======================================================================
    ipcMain.handle("get-deleted-travel", () =>
        queries.getDeletedTravel()
    );

    ipcMain.handle("restore-travel", async (event, { user, id }) => {
        const result = await queries.restoreTravel(id);
        if (result.success) {
            logAction(user, "restore_travel", "travel_tracking", id);
        }
        return result;
    });

    // =======================================================================
    // 🔥 🔟 REQUIRED DOCUMENTS
    // =======================================================================
    ipcMain.handle("get-deleted-required-documents", async () =>
        simpleListHandler(`
            SELECT id, name
            FROM required_documents
            WHERE isDeleted = 1
            ORDER BY id DESC
        `)
    );

    ipcMain.handle("restore-required-document", async (event, { user, id }) =>
        simpleUpdateHandler(
            `UPDATE required_documents SET isDeleted = 0 WHERE id = ?`,
            id
        )
    );

    // =======================================================================
    // 🔥 1️⃣1️⃣ PERMANENT DELETE — SUPER ADMIN ONLY
    // =======================================================================
    ipcMain.handle("delete-permanently", async (event, { user, id, targetType }) => {
        if (!user || user.role !== "super_admin") {
            return { success: false, error: "Access Denied: Super Admin only." };
        }

        let tableName = null;

        switch (targetType) {
            case "required_docs":
            case "required_doc":
                tableName = "required_documents"; break;

            case "candidate":
            case "candidates":
                tableName = "candidates"; break;

            case "employer":
            case "employers":
                tableName = "employers"; break;

            case "jobs":
            case "job":
            case "job_orders":
                tableName = "job_orders"; break;

            case "placement":
            case "placements":
                tableName = "placements"; break;

            case "passport":
            case "passports":
                tableName = "passport_tracking"; break;

            case "visa":
            case "visas":
                tableName = "visa_tracking"; break;

            case "medical":
            case "medical_records":
                tableName = "medical_tracking"; break;

            case "interview":
            case "interviews":
                tableName = "interview_tracking"; break;

            case "travel":
            case "travels":
                tableName = "travel_tracking"; break;

            default:
                return { success: false, error: `Unknown target type: ${targetType}` };
        }

        try {
            await simpleUpdateHandler(`DELETE FROM ${tableName} WHERE id = ?`, id);

            logAction(user, "permanent_delete", tableName, id);

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
