// src-electron/ipc/modules/fileSystemHandlers.cjs
const { ipcMain, shell, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const extract = require('extract-zip');
const mime = require('mime');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const ejs = require('ejs');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { getDatabase } = require('../../db/database.cjs');
const { guard, FEATURES } = require('../security/ipcPermissionGuard.cjs');

function registerFileSystemHandlers(app) {
    console.log('📂 Registering File System Handlers...');

    // ====================================================================
    // FILE OPERATIONS
    // ====================================================================
    
    ipcMain.handle('open-file-externally', async (event, { path }) => {
        if (path && fs.existsSync(path)) {
            shell.openPath(path);
            return { success: true };
        }
        return { success: false, error: 'File not found.' };
    });

    ipcMain.handle('getImageBase64', async (event, { filePath }) => {
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

    ipcMain.handle('readAbsoluteFileBuffer', async (event, { filePath }) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'File not found on disk.' };
        }
        try {
            const buffer = fs.readFileSync(filePath);
            return { 
                success: true, 
                buffer: buffer, 
                type: mime.getType(filePath) || (path.extname(filePath) === '.pdf' ? 'application/pdf' : 'application/octet-stream')
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ====================================================================
    // ZIP OPERATIONS
    // ====================================================================
    
    ipcMain.handle('zip-candidate-documents', async (event, { user, candidateId, destinationPath }) => {
        return new Promise((resolve, reject) => {
            const db = getDatabase();
            
            db.all(
                'SELECT fileName, filePath FROM documents WHERE candidate_id = ? AND isDeleted = 0',
                [candidateId],
                (err, docs) => {
                    if (err) {
                        return resolve({ success: false, error: 'Database error fetching documents.' });
                    }
                    
                    if (docs.length === 0) {
                        return resolve({ success: false, error: 'No active documents found to export.' });
                    }

                    const output = fs.createWriteStream(destinationPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });

                    output.on('close', () => {
                        logAction(user, 'export_documents_zip', 'candidates', candidateId);
                        resolve({ success: true, filePath: destinationPath });
                    });

                    archive.on('warning', (err) => {
                        if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
                    });

                    archive.on('error', (err) => {
                        resolve({ success: false, error: `Archiver failed: ${err.message}` });
                    });

                    archive.pipe(output);

                    docs.forEach((doc) => {
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

    ipcMain.handle('bulk-import-documents', async (event, { user, candidateIdMap, archivePath }) => {
        try {
            const db = getDatabase();
            
            if (!fs.existsSync(archivePath)) {
                return { success: false, error: 'Archive file not found.' };
            }

            const tempExtractDir = path.join(os.tmpdir(), `import_${uuidv4()}`);
            if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir);

            console.log(`Extracting ZIP: ${archivePath}`);
            await extract(archivePath, { dir: tempExtractDir });

            const files = fs.readdirSync(tempExtractDir);
            console.log(`Found ${files.length} items in ZIP.`);
            
            let successfulDocs = 0;
            let failedDocs = 0;
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
            
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

            const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
            
            for (const fileName of files) {
                if (fileName.startsWith('.') || fileName.startsWith('__')) continue;
                
                const cleanName = path.parse(fileName).name;
                const parts = cleanName.split('_');
                
                let passportNo = parts[0].trim().toUpperCase();
                let category = 'Uncategorized';

                if (parts.length >= 2) {
                    category = parts.slice(1).join('_');
                }

                const candidateId = candidateIdMap[passportNo];
                
                if (candidateId) {
                    const uniqueName = `${uuidv4()}${path.extname(fileName)}`;
                    const newFilePath = path.join(filesDir, uniqueName);
                    
                    try {
                        fs.copyFileSync(path.join(tempExtractDir, fileName), newFilePath);
                        
                        await new Promise((resolve, reject) => {
                            const fileType = mime.getType(fileName) || 'application/octet-stream';
                            db.run(sqlDoc, [candidateId, fileType, fileName, newFilePath, category], function(err) {
                                if (err) {
                                    console.error(`DB Insert Failed for ${fileName}:`, err.message);
                                    failedDocs++;
                                    try { fs.unlinkSync(newFilePath); } catch(e) {}
                                    resolve();
                                } else {
                                    successfulDocs++;
                                    resolve();
                                }
                            });
                        });
                    } catch (fileErr) {
                        console.error(`File Copy Error for ${fileName}:`, fileErr.message);
                        failedDocs++;
                    }
                } else {
                    console.warn(`Skipped: No candidate found for Passport "${passportNo}" (File: ${fileName})`);
                    failedDocs++;
                }
            }

            try {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            } catch (e) { 
                console.error("Temp cleanup failed:", e.message); 
            }

            const logMsg = `Bulk Import: Success=${successfulDocs}, Failed=${failedDocs}`;
            logAction(user, 'bulk_doc_import', 'system', 1, logMsg);
            
            return { success: true, data: { successfulDocs, failedDocs } };
        } catch (error) {
            console.error('Bulk document import CRITICAL failure:', error);
            return { success: false, error: error.message };
        }
    });

    // ====================================================================
    // PDF & OFFER LETTER GENERATION
    // ====================================================================
    
    ipcMain.handle('read-offer-template', async (event, { user }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            const templatePath = path.join(
                app.getAppPath(), 
                'src-electron', 
                'templates', 
                'offer_letter_template.ejs'
            );
            
            if (!fs.existsSync(templatePath)) {
                return { success: false, error: 'Template file not found.' };
            }
            
            const content = fs.readFileSync(templatePath, 'utf-8');
            return { success: true, data: content };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('write-offer-template', async (event, { user, content }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Super Admin only.' };
            }

            const templatePath = path.join(
                app.getAppPath(), 
                'src-electron', 
                'templates', 
                'offer_letter_template.ejs'
            );
            
            fs.writeFileSync(templatePath, content);
            logAction(user, 'update_offer_template', 'settings', 1);
            
            return { success: true };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('generate-offer-letter', async (event, { user, candidateId, jobId, templateData }) => {
        const db = getDatabase();
        
        const row = await queries.dbGet(
            db,
            `SELECT c.name AS candidateName, c.passportNo, c.contact, c.aadhar, c.education,
                    j.positionTitle, j.requirements,
                    e.companyName, e.contactPerson, e.contactEmail, e.country AS employerCountry
             FROM candidates c
             JOIN placements p ON p.candidate_id = c.id
             JOIN job_orders j ON j.id = p.job_order_id
             JOIN employers e ON e.id = j.employer_id
             WHERE c.id = ? AND j.id = ? AND c.isDeleted = 0 LIMIT 1`,
            [candidateId, jobId]
        );

        if (!row) {
            return { success: false, error: 'Failed to fetch candidate/job data. Not assigned or candidate deleted.' };
        }

        try {
            const today = new Date().toISOString().slice(0, 10);
            const data = { ...row, ...templateData, currentDate: today };
            
            const templatePath = path.join(
                app.getAppPath(), 
                'src-electron', 
                'templates', 
                'offer_letter_template.ejs'
            );
            
            let template = fs.readFileSync(templatePath, 'utf-8');
            const htmlContent = ejs.render(template, data);

            const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.html`);
            fs.writeFileSync(tempFilePath, htmlContent);

            logAction(user, 'generate_offer_letter', 'candidates', candidateId, `Job ID: ${jobId}`);
            
            return { 
                success: true, 
                tempPath: tempFilePath, 
                candidateName: row.candidateName, 
                position: row.positionTitle 
            };
        } catch (error) {
            console.error('Offer Letter generation failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('print-to-pdf', async (event, { url }) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        try {
            await printWindow.loadURL(url);

            const date = new Date().toISOString().slice(0, 10);
            const defaultFileName = `Candidate_Offer_Letter_${date}.pdf`;

            const saveDialogResult = await dialog.showSaveDialog(win, {
                title: 'Save Generated Offer Letter as PDF',
                defaultPath: defaultFileName,
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
            });

            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                printWindow.close();
                return { success: false, error: 'User cancelled save operation.' };
            }

            const pdfBuffer = await printWindow.webContents.printToPDF({
                margins: { marginType: 'default' },
                landscape: false,
                printBackground: true
            });

            fs.writeFileSync(saveDialogResult.filePath, pdfBuffer);
            printWindow.close();

            return { success: true, filePath: saveDialogResult.filePath };
        } catch (error) {
            console.error('PDF Generation Error:', error);
            if (printWindow) printWindow.close();
            return { success: false, error: `PDF generation failed: ${error.message}` };
        }
    });

    // ====================================================================
    // CSV/EXCEL IMPORT
    // ====================================================================
    
    ipcMain.handle('get-csv-headers', async (event, { filePath }) => {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                return resolve({ success: false, error: 'File not found.' });
            }

            const headers = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('headers', (hdr) => {
                    headers.push(...hdr);
                })
                .on('data', () => {})
                .on('end', () => {
                    if (headers.length > 0) {
                        resolve({ success: true, headers: headers });
                    } else {
                        resolve({ success: false, error: 'Could not read headers from CSV.' });
                    }
                })
                .on('error', (err) => {
                    resolve({ success: false, error: err.message });
                });
        });
    });

    ipcMain.handle('get-excel-sheets', async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found.' };
            }
            const workbook = XLSX.readFile(filePath);
            return { success: true, sheets: workbook.SheetNames };
        } catch (err) {
            return { success: false, error: `Failed to read Excel file: ${err.message}` };
        }
    });

    ipcMain.handle('get-excel-headers', async (event, { filePath, sheetName }) => {
        try {
            const workbook = XLSX.readFile(filePath);
            
            if (!workbook.SheetNames.includes(sheetName)) {
                return { success: false, error: 'Sheet name not found in file.' };
            }

            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (rows.length === 0) {
                return { success: false, error: 'Sheet is empty.' };
            }

            const headers = rows[0];
            return { success: true, headers: headers };
        } catch (err) {
            return { success: false, error: `Failed to read headers: ${err.message}` };
        }
    });

    ipcMain.handle('import-candidates-from-file', async (event, { user, filePath, mapping }) => {
        const db = getDatabase();
        const rows = [];
        const results = { successfulCount: 0, failedCount: 0, failures: [] };
        const requiredDbColumn = 'passportNo';

        const invertedMap = {};
        for (const csvHeader in mapping) {
            const dbColumn = mapping[csvHeader];
            if (dbColumn) invertedMap[dbColumn] = csvHeader;
        }

        if (!invertedMap[requiredDbColumn]) {
            return { success: false, error: `Required column "${requiredDbColumn}" was not mapped.` };
        }

        try {
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => rows.push(row))
                    .on('end', resolve)
                    .on('error', (err) => reject(err));
            });
        } catch (err) {
            return { success: false, error: `Error reading CSV: ${err.message}` };
        }

        await queries.dbRun(db, 'BEGIN TRANSACTION', []);

        for (const [index, row] of rows.entries()) {
            const rowNum = index + 2;
            
            const dbRow = {
                name: row[invertedMap['name']] || null,
                education: row[invertedMap['education']] || null,
                experience: row[invertedMap['experience']] || null,
                dob: row[invertedMap['dob']] || null,
                passportNo: row[invertedMap['passportNo']] || null,
                passportExpiry: row[invertedMap['passportExpiry']] || null,
                contact: row[invertedMap['contact']] || null,
                aadhar: row[invertedMap['aadhar']] || null,
                status: row[invertedMap['status']] || 'New',
                notes: row[invertedMap['notes']] || null,
                Position: row[invertedMap['Position']] || null
            };

            try {
                const createResult = await queries.createCandidate(dbRow);
                
                if (createResult.success) {
                    logAction(user, 'bulk_import_create', 'candidates', createResult.id, `Name: ${dbRow.name}, Passport: ${dbRow.passportNo}`);
                    results.successfulCount++;
                } else {
                    results.failedCount++;
                    const reason = createResult.errors 
                        ? `Row ${rowNum}: Validation failed on fields: ${Object.keys(createResult.errors).join(', ')}`
                        : `Row ${rowNum}: ${createResult.error}`;
                    results.failures.push({ data: row, reason: reason });
                }
            } catch (err) {
                results.failedCount++;
                results.failures.push({ data: row, reason: `Row ${rowNum}: ${err.message}` });
            }
        }

        await queries.dbRun(db, 'COMMIT', []);
        logAction(user, 'bulk_import_complete', 'system', 1, `Success: ${results.successfulCount}, Failed: ${results.failedCount}`);

        return { success: true, data: results };
    });

    console.log('✅ File System Handlers Registered');
}

ipcMain.handle('download-excel-template', async (event, { savePath }) => {
    try {
        const XLSX = require('xlsx');
        
        // Create template workbook
        const wb = XLSX.utils.book_new();
        
        const templateData = [
            ['Name', 'Passport No', 'Position', 'Contact', 'Aadhar', 'Education', 'Experience', 'DOB', 'Passport Expiry', 'Status', 'Notes'],
            ['John Doe', 'A1234567', 'Software Engineer', '9876543210', '1234-5678-9012', 'B.Tech', '5 years', '1990-01-15', '2028-12-31', 'New', 'Sample candidate']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
        
        // If savePath provided, save there. Otherwise, show dialog
        let finalPath = savePath;
        if (!finalPath) {
            const dialogRes = await dialog.showSaveDialog({
                title: 'Save Excel Template',
                defaultPath: 'candidate_import_template.xlsx',
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            });
            
            if (dialogRes.canceled) {
                return { success: false, error: 'Cancelled' };
            }
            finalPath = dialogRes.filePath;
        }
        
        XLSX.writeFile(wb, finalPath);
        return { success: true, filePath: finalPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});


module.exports = { registerFileSystemHandlers };
