// src-electron/ipc/modules/candidateHandlers.cjs
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerCandidateHandlers(app) {
    console.log('👤 Registering Candidate Handlers...');

    const db = getDatabase();

    // ====================================================================
    // CANDIDATE CRUD
    // ====================================================================
    
    ipcMain.handle('save-candidate-multi', async (event, { user, textData, files }) => {
        const createResult = await queries.createCandidate(textData);
        if (!createResult.success) {
            return createResult;
        }
        
        const candidateId = createResult.id;
        logAction(user, 'create_candidate', 'candidates', candidateId, `Name: ${textData.name}`);

        try {
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

            if (files && files.length > 0) {
                const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
                
                const fileOperations = files.map((file) => {
                    const uniqueName = `${uuidv4()}${path.extname(file.name)}`;
                    const newFilePath = path.join(filesDir, uniqueName);
                    fs.writeFileSync(newFilePath, Buffer.from(file.buffer));
                    
                    return new Promise((resolve, reject) => {
                        db.run(
                            sqlDoc,
                            [candidateId, file.type, file.name, newFilePath, 'Uncategorized'],
                            function (err) {
                                if (err) reject(err);
                                else {
                                    logAction(user, 'add_document', 'candidates', candidateId, `File: ${file.name}`);
                                    resolve();
                                }
                            }
                        );
                    });
                });
                
                await Promise.all(fileOperations);
            }
            return { success: true, id: candidateId };
        } catch (error) {
            console.error('Failed to save candidate files:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-candidates', async (event, args) => {
        const { searchTerm, status, position, limit, offset } = args;
        return queries.searchCandidates(searchTerm, status, position, limit, offset);
    });

    ipcMain.handle('get-candidate-details', async (event, { user, id }) => {
        if (user) {
            logAction(user, 'view_candidate_details', 'candidates', id);
        }
        return queries.getCandidateDetails(id);
    });

    ipcMain.handle('update-candidate-text', async (event, { user, id, data }) => {
        const result = await queries.updateCandidateText(user, id, data);
        if (result.success) {
            logAction(user, 'update_candidate', 'candidates', id, `Name: ${data.name}, Status: ${data.status}`);
        }
        return result;
    });

    ipcMain.handle('delete-candidate', async (event, { user, id }) => {
        const result = await queries.deleteCandidate(id);
        if (result.success) {
            logAction(user, 'delete_candidate', 'candidates', id);
        }
        return result;
    });

    // ====================================================================
    // DOCUMENTS
    // ====================================================================
    
    ipcMain.handle('add-documents', async (event, { user, candidateId, files }) => {
        try {
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
            if (!files || files.length === 0) return { success: false, error: 'No files provided.' };

            const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
            
            const fileOperations = files.map(async (file) => {
                const uniqueName = `${uuidv4()}${path.extname(file.name)}`;
                const newFilePath = path.join(filesDir, uniqueName);
                const category = file.category || 'Uncategorized';

                await fs.promises.writeFile(newFilePath, Buffer.from(file.buffer));

                return new Promise((resolve, reject) => {
                    db.run(sqlDoc, [candidateId, file.type, file.name, newFilePath, category], function (err) {
                        if (err) reject(err);
                        else {
                            logAction(user, 'add_document', 'candidates', candidateId, `File: ${file.name}`);
                            resolve({ 
                                id: this.lastID, 
                                fileName: file.name, 
                                filePath: newFilePath, 
                                fileType: file.type, 
                                category 
                            });
                        }
                    });
                });
            });
            
            const newDocs = await Promise.all(fileOperations);
            return { success: true, newDocs };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-document-category', async (event, { user, docId, category }) => {
        const result = await queries.updateDocumentCategory(docId, category);
        if (result.success) {
            logAction(user, 'update_doc_category', 'candidates', result.candidateId, `File: ${result.fileName}, Category: ${category}`);
        }
        return result;
    });

    ipcMain.handle('delete-document', async (event, { user, documentId }) => {
        try {
            const result = await queries.deleteDocument(documentId);
            if (result.success) {
                logAction(user, 'delete_document', 'candidates', result.candidateId, `Document ID: ${documentId}`);
            }
            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ====================================================================
    // AUDIT LOG
    // ====================================================================
    
    ipcMain.handle('get-audit-log-for-candidate', async (event, { candidateId }) => {
        return queries.getAuditLogForCandidate(candidateId);
    });

    console.log('✅ Candidate Handlers Registered');
}

module.exports = { registerCandidateHandlers };
