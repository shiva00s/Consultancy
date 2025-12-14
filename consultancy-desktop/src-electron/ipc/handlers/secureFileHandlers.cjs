const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const { getDatabase } = require("../db/database.cjs");
const { dbGet } = require("../db/queries.cjs");

// ---------------------------------------------------------------------------
// REGISTER SECURE FILE ACCESS HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerSecureFileHandlers() {

    const db = getDatabase();

    // =======================================================================
    // 1️⃣ GET SECURE FILE PATH (DOCUMENT ID → REAL PATH)
    // =======================================================================
    ipcMain.handle("get-secure-file-path", async (event, { documentId }) => {
        if (!documentId) {
            return { success: false, error: "Document ID required." };
        }

        try {
            const row = await dbGet(
                db,
                `SELECT filePath FROM documents WHERE id = ?`,
                [documentId]
            );

            if (!row || !row.filePath) {
                return { success: false, error: "Document not found." };
            }

            return {
                success: true,
                filePath: row.filePath,
            };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ GET RAW BUFFER FOR ANY ABSOLUTE FILE PATH (Secure Reader)
    // =======================================================================
    ipcMain.handle("readAbsoluteFileBuffer", async (event, { filePath }) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: "File not found." };
        }

        try {
            const buffer = fs.readFileSync(filePath);
            const type =
                mime.getType(filePath) ||
                (path.extname(filePath) === ".pdf"
                    ? "application/pdf"
                    : "application/octet-stream");

            return {
                success: true,
                buffer,
                type,
            };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
