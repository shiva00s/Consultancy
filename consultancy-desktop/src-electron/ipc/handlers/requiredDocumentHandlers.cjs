const { ipcMain } = require("electron");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER REQUIRED DOCUMENT MASTER HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerRequiredDocumentHandlers() {

    // =======================================================================
    // 1️⃣ GET REQUIRED DOCUMENTS LIST (MASTER)
    // =======================================================================
    ipcMain.handle("get-required-documents", async () => {
        try {
            const db = getDatabase();
            const rows = await queries.dbAll(
                db,
                "SELECT * FROM required_documents WHERE isDeleted = 0 ORDER BY id DESC",
                []
            );

            return { success: true, data: rows };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ ADD REQUIRED DOCUMENT (MASTER ENTRY)
    // =======================================================================
    ipcMain.handle("add-required-document", async (event, { user, name }) => {
        if (!name) return { success: false, error: "Document name required." };

        try {
            const db = getDatabase();

            await queries.dbRun(
                db,
                "INSERT INTO required_documents (name, isDeleted) VALUES (?, 0)",
                [name]
            );

            logAction(
                user,
                "add_required_document",
                "required_documents",
                0,
                `Added Required Document: ${name}`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 3️⃣ UPDATE REQUIRED DOCUMENT
    // =======================================================================
    ipcMain.handle("update-required-document", async (event, { user, id, name }) => {
        if (!id || !name)
            return { success: false, error: "ID and name required." };

        try {
            const db = getDatabase();

            await queries.dbRun(
                db,
                "UPDATE required_documents SET name = ? WHERE id = ?",
                [name, id]
            );

            logAction(
                user,
                "update_required_document",
                "required_documents",
                id,
                `Updated to: ${name}`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 4️⃣ DELETE REQUIRED DOCUMENT (Soft Delete)
    // =======================================================================
    ipcMain.handle("delete-required-document", async (event, { user, id }) => {
        if (!id) return { success: false, error: "ID required." };

        try {
            const db = getDatabase();

            await queries.dbRun(
                db,
                "UPDATE required_documents SET isDeleted = 1 WHERE id = ?",
                [id]
            );

            logAction(
                user,
                "delete_required_document",
                "required_documents",
                id,
                `Soft Deleted Document`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
