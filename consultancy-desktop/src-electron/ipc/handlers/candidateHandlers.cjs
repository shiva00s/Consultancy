const { ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const queries = require("../db/queries.cjs");
const { getDatabase } = require("../db/database.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerCandidateHandlers() {

    const db = getDatabase();

    // -------------------------------------------------------------
    // SAVE CANDIDATE (CREATE)
    // -------------------------------------------------------------
    ipcMain.handle("save-candidate", async (event, { user, data }) => {
        const result = await queries.saveCandidate(data);

        if (result.success) {
            logAction(user, "create_candidate", "candidates", result.id, data.fullname);
        }

        return result;
    });

    // -------------------------------------------------------------
    // UPDATE CANDIDATE TEXT FIELDS (NAME, PASSPORT, DOB etc.)
    // -------------------------------------------------------------
    ipcMain.handle("update-candidate-text", async (event, { user, id, data }) => {
        const result = await queries.updateCandidateText(id, data);

        if (result.success) {
            logAction(user, "update_candidate", "candidates", id);
        }

        return result;
    });

    // -------------------------------------------------------------
    // DELETE CANDIDATE (SOFT)
    // -------------------------------------------------------------
    ipcMain.handle("delete-candidate", async (event, { user, id }) => {
        const result = await queries.deleteCandidate(id);

        if (result.success) {
            logAction(user, "delete_candidate", "candidates", id);
        }

        return result;
    });

    // -------------------------------------------------------------
    // GET CANDIDATE DETAILS
    // -------------------------------------------------------------
    ipcMain.handle("get-candidate-details", async (event, id) => {
        return queries.getCandidateDetails(id);
    });

    // -------------------------------------------------------------
    // SEARCH CANDIDATES
    // -------------------------------------------------------------
    ipcMain.handle("search-candidates", async (event, query) => {
        return queries.searchCandidates(query);
    });

    // -------------------------------------------------------------
    // GET CANDIDATES LIST (FILTERED)
    // -------------------------------------------------------------
    ipcMain.handle("get-candidate-list", async (event, filters) => {
        return queries.getCandidateList(filters);
    });

    // -------------------------------------------------------------
    // ADD DOCUMENTS TO CANDIDATE
    // -------------------------------------------------------------
    ipcMain.handle("add-documents", async (event, { user, candidateId, docs }) => {
        const result = await queries.addDocuments(candidateId, docs);

        if (result.success) {
            logAction(
                user,
                "add_documents",
                "candidate_documents",
                candidateId,
                `${docs.length} file(s) added`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // UPDATE DOCUMENT CATEGORY (AADHAR / PASSPORT / OTHER)
    // -------------------------------------------------------------
    ipcMain.handle("update-document-category", async (event, { user, id, category }) => {
        const result = await queries.updateDocumentCategory(id, category);

        if (result.success) {
            logAction(
                user,
                "update_doc_category",
                "candidate_documents",
                id,
                `Category → ${category}`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // GET DOCUMENT AS BASE64 (FOR PREVIEW)
    // -------------------------------------------------------------
    ipcMain.handle("get-document-base64", async (event, filepath) => {
        try {
            if (!fs.existsSync(filepath)) {
                return { success: false, error: "File not found." };
            }

            const data = fs.readFileSync(filepath);
            const base64 = data.toString("base64");
            const ext = path.extname(filepath).substring(1);

            return { success: true, base64, ext };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // GET IMAGE BASE64 (Profile photo / Passport photo)
    // -------------------------------------------------------------
    ipcMain.handle("getImageBase64", async (event, filepath) => {
        try {
            if (!fs.existsSync(filepath)) {
                return { success: false, error: "Image not found." };
            }

            const data = fs.readFileSync(filepath);
            const base64 = data.toString("base64");

            return { success: true, base64 };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // OPEN DOCUMENT EXTERNALLY
    // -------------------------------------------------------------
    ipcMain.handle("open-file-externally", async (event, filepath) => {
        try {
            if (!fs.existsSync(filepath)) {
                return { success: false, error: "File not found." };
            }

            await shell.openPath(filepath);
            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // DELETE DOCUMENT
    // -------------------------------------------------------------
    ipcMain.handle("delete-document", async (event, { user, id }) => {
        const result = await queries.deleteDocument(id);

        if (result.success) {
            logAction(user, "delete_document", "candidate_documents", id);
        }

        return result;
    });

    // -------------------------------------------------------------
    // BULK IMPORT DOCUMENTS
    // -------------------------------------------------------------
    ipcMain.handle("bulk-import-documents", async (event, { user, candidateId, files }) => {
        const result = await queries.bulkImportDocuments(candidateId, files);

        if (result.success) {
            logAction(
                user,
                "bulk_add_documents",
                "candidate_documents",
                candidateId,
                `${files.length} docs imported`
            );
        }

        return result;
    });

    // -------------------------------------------------------------
    // ZIP CANDIDATE DOCUMENTS (Export All)
    // -------------------------------------------------------------
    ipcMain.handle("zip-candidate-documents", async (event, { candidateId, output }) => {
        return queries.zipCandidateDocuments(candidateId, output);
    });

    // -------------------------------------------------------------
    // SAVE PROFILE PHOTO
    // -------------------------------------------------------------
    ipcMain.handle("save-candidate-profile-photo", async (event, { candidateId, imgPath }) => {
        return queries.saveCandidateProfilePhoto(candidateId, imgPath);
    });

};
