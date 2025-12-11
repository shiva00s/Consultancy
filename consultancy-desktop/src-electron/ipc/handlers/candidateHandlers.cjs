const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime');
const archiver = require('archiver');
const extract = require('extract-zip');
const { getDatabase } = require('../../db/database.cjs'); // Ensure path is correct

// This function can be externalized to a utils if needed, but for now, keep near resume parsing logic
const extractResumeDetails = (text) => {
    const details = {};
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) details.email = emailMatch[0];

    const phoneRegex = /\b\d{10,12}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) details.contact = phoneMatch[0];

    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) details.name = lines[0].substring(0, 50);

    return details;
};

const registerCandidateHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-all-candidates-basic', (event) => {
        return queries.getAllCandidates();
    });

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
                const db = getDatabase(); // Get DB here if needed
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

    ipcMain.handle('search-candidates', (event, args) => {
        const { searchTerm, status, position, limit, offset } = args;
        return queries.searchCandidates(searchTerm, status, position, limit, offset);
    });

    ipcMain.handle('get-candidate-details', (event, { id }) => {
        return queries.getCandidateDetails(id);
    });

    ipcMain.handle('update-candidate-text', async (event, { user, id, data }) => {
        const result = await queries.updateCandidateText(id, data);
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

    ipcMain.handle('add-documents', async (event, { user, candidateId, files }) => {
        try {
            const db = getDatabase(); // Access the database here
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
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
                            resolve({ id: this.lastID, fileName: file.name, filePath: newFilePath, fileType: file.type, category });
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
            logAction(user, 'update_doc_category', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, File: ${result.fileName}, New Category: ${category}`);
        }
        return result;
    });

    ipcMain.handle('open-file-externally', async (event, { path }) => {
        if (path && fs.existsSync(path)) {
            shell.openPath(path);
            return { success: true };
        }
        return { success: false, error: 'File not found.' };
    });

    ipcMain.handle('getImageBase64', (event, { filePath }) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Image file not found.' };
        }
        try {
            const data = fs.readFileSync(filePath, { encoding: 'base64' });
            const fileType = path.extname(filePath).toLowerCase();
            let mimeType = 'image/jpeg'; 

            if (fileType === '.png') mimeType = 'image/png';
            else if (fileType === '.gif') mimeType = 'image/gif';
            
            return { success: true, data: `data:${mimeType};base64,${data}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-document-base64', async (event, { filePath }) => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, { encoding: 'base64' });
                const fileType = path.extname(filePath).toLowerCase();
                let mimeType = 'application/octet-stream';

                if (fileType === '.pdf') mimeType = 'application/pdf';
                else if (['.png', '.jpg', '.jpeg', '.gif'].includes(fileType))
                    mimeType = `image/${fileType.substring(1)}`;

                
                return { success: true, data: `data:${mimeType};base64,${data}` };
                
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
        return { success: false, error: 'File not found.' };
    });

    ipcMain.handle('zip-candidate-documents', async (event, { user, candidateId, destinationPath }) => {
        return new Promise((resolve, reject) => {
            const db = getDatabase(); // Access the database here
            db.all(
                'SELECT fileName, filePath FROM documents WHERE candidate_id = ? AND isDeleted = 0',
                [candidateId],
                (err, docs) => {
                    if (err) return resolve({ success: false, error: 'Database error fetching documents.' });
                    
                    if (docs.length === 0) return resolve({ success: false, error: 'No active documents found to export.' });

                    const output = fs.createWriteStream(destinationPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });

                    output.on('close', function() {
                        logAction(user, 'export_documents_zip', 'candidates', candidateId, `Candidate: ${candidateId}`);
                        resolve({ success: true, filePath: destinationPath });
                    });
                    output.on('end', () => console.log('Data has been drained'));
                    archive.on('warning', (err) => {
                        if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
                    });
                    archive.on('error', (err) => {
                        console.error('Archiver error:', err);
                        resolve({ success: false, error: `Archiver failed: ${err.message}` });
                    });
                    archive.pipe(output);
                    docs.forEach(doc => {
                        if (fs.existsSync(doc.filePath)) {
                            archive.file(doc.filePath, { name: doc.fileName });
                        } else {
                            console.warn(`Missing physical file: ${doc.filePath}`);
                        }
                    });
                    archive.finalize();
                }
            );
        });
    });

    ipcMain.handle('get-comm-logs', (event, args) => queries.getCommLogs(args.candidateId));

    ipcMain.handle('get-secure-file-path', async (event, { documentId }) => {
        try {
            const db = getDatabase();
            const sql = 'SELECT filePath FROM documents WHERE id = ?';
            const row = await queries.dbGet(db, sql, [documentId]);
            
            if (row && row.filePath) {
                return { success: true, filePath: row.filePath };
            }
            return { success: false, error: 'Document ID not found or path is missing.' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // Mobile specific (if applicable, though generally handled by mobile-server sync)
    // The `saveDocumentFromApi` function is now exported from queries.cjs and will be used by the mobile server.
};

module.exports = { registerCandidateHandlers, extractResumeDetails };
