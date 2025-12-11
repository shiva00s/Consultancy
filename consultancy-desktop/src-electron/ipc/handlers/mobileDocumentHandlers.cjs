const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { getDatabase } = require("../db/database.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

// ---------------------------------------------------------------------------
// Helper to write uploaded mobile document safely
// ---------------------------------------------------------------------------
async function saveDocumentFromApi({ candidateId, user, fileData }) {
    try {
        const db = getDatabase();
        const filesDir = path.join(require("electron").app.getPath("userData"), "candidate_files");

        // Ensure target directory exists
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true });
        }

        // Create unique filename
        const uniqueName = `${uuidv4()}${path.extname(fileData.fileName)}`;
        const destPath = path.join(filesDir, uniqueName);

        // Write file
        await fs.promises.writeFile(destPath, fileData.buffer);

        // Insert into DB
        const sql = `
            INSERT INTO documents (candidate_id, fileType, fileName, filePath, category)
            VALUES (?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            db.run(
                sql,
                [
                    candidateId,
                    fileData.fileType,
                    fileData.fileName,
                    destPath,
                    fileData.category || "Uncategorized"
                ],
                function (err) {
                    if (err) {
                        // Remove saved file if DB insert fails
                        fs.unlink(destPath, () => {});
                        return reject(err);
                    }

                    logAction(
                        user,
                        "add_document_mobile",
                        "candidates",
                        candidateId,
                        `Uploaded from mobile: ${fileData.fileName}`
                    );

                    resolve({
                        success: true,
                        documentId: this.lastID
                    });
                }
            );
        });

    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// REGISTER IPC HANDLERS FOR MOBILE DOCUMENT UPLOAD
// ---------------------------------------------------------------------------
module.exports = function registerMobileDocumentHandlers() {

    // === IPC used by mobile server to save uploaded docs ===
    ipcMain.handle("mobile-save-document", async (event, payload) => {
        return saveDocumentFromApi(payload);
    });

};

// Export helper for reuse
module.exports.saveDocumentFromApi = saveDocumentFromApi;
