const { ipcMain } = require("electron");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// REGISTER DOCUMENT CATEGORY HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerDocumentCategoryHandlers() {

    // =======================================================================
    // 1️⃣ GET ALL DOCUMENT CATEGORIES
    // =======================================================================
    ipcMain.handle("get-document-categories", async () => {
        try {
            const db = getDatabase();
            const rows = await queries.dbAll(
                db,
                "SELECT * FROM document_categories WHERE isDeleted = 0 ORDER BY id DESC",
                []
            );
            return { success: true, data: rows };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ ADD DOCUMENT CATEGORY
    // =======================================================================
    ipcMain.handle("add-document-category", async (event, { user, name }) => {
        if (!name) return { success: false, error: "Category name required." };

        try {
            const db = getDatabase();
            await queries.dbRun(
                db,
                "INSERT INTO document_categories (name, isDeleted) VALUES (?, 0)",
                [name]
            );

            logAction(
                user,
                "add_document_category",
                "document_categories",
                0,
                `Added Category: ${name}`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 3️⃣ UPDATE DOCUMENT CATEGORY
    // =======================================================================
    ipcMain.handle("update-document-category", async (event, { user, id, name }) => {
        if (!id || !name)
            return { success: false, error: "ID and name required." };

        try {
            const db = getDatabase();
            await queries.dbRun(
                db,
                "UPDATE document_categories SET name = ? WHERE id = ?",
                [name, id]
            );

            logAction(
                user,
                "update_document_category",
                "document_categories",
                id,
                `Updated Category: ${name}`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 4️⃣ DELETE DOCUMENT CATEGORY (Soft Delete)
    // =======================================================================
    ipcMain.handle("delete-document-category", async (event, { user, id }) => {
        if (!id) return { success: false, error: "ID required." };

        try {
            const db = getDatabase();
            await queries.dbRun(
                db,
                "UPDATE document_categories SET isDeleted = 1 WHERE id = ?",
                [id]
            );

            logAction(
                user,
                "delete_document_category",
                "document_categories",
                id,
                `Deleted Category`
            );

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
