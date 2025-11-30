const { BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');

const registerDocumentImportHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

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
                    if(headers.length > 0) {
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

    ipcMain.handle('import-candidates-from-file', async (event, { user, filePath, mapping }) => {
        const db = dependencies.getDatabase; // Access the database here
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
                    .on('end', () => resolve())
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
                Position: row[invertedMap['Position']] || null,
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

    ipcMain.handle('import-candidates-from-excel', async (event, { user, filePath, sheetName, mapping }) => {
        const db = dependencies.getDatabase; // Access the database here
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

        let rows = [];
        try {
            const workbook = XLSX.readFile(filePath);
            const worksheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(worksheet);
        } catch (err) {
            return { success: false, error: `Error reading Excel: ${err.message}` };
        }

        await queries.dbRun(db, 'BEGIN TRANSACTION', []);
        for (const [index, row] of rows.entries()) {
            const rowNum = index + 2;
            const dbRow = {
                name: row[invertedMap['name']] || null,
                education: row[invertedMap['education']] || null,
                experience: row[invertedMap['experience']] || null,
                dob: queries.parseExcelDate(row[invertedMap['dob']]), // Use parseExcelDate from queries
                passportNo: row[invertedMap['passportNo']] || null,
                passportExpiry: queries.parseExcelDate(row[invertedMap['passportExpiry']]), // Use parseExcelDate from queries
                contact: row[invertedMap['contact']] || null,
                aadhar: row[invertedMap['aadhar']] || null,
                status: row[invertedMap['status']] || 'New',
                notes: row[invertedMap['notes']] || null,
                Position: row[invertedMap['Position']] || null,
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
        logAction(user, 'bulk_import_complete', 'system', 1, `(Excel) Success: ${results.successfulCount}, Failed: ${results.failedCount}`);
        return { success: true, data: results };
    });

    ipcMain.handle('download-excel-template', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);

        const headers = [
            'name', 'passportNo', 'Position', 'contact', 'aadhar', 'education',
            'experience', 'dob', 'passportExpiry', 'status', 'notes'
        ];

        try {
            const saveDialogResult = await dialog.showSaveDialog(win, {
                title: 'Save Excel Import Template',
                defaultPath: 'candidate_import_template.xlsx',
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            });

            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                return { success: false, error: 'User cancelled save.' };
            }

            const filePath = saveDialogResult.filePath;

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers]); 
            XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
            XLSX.writeFile(wb, filePath);

            return { success: true, filePath: filePath };
        } catch (err) {
            console.error('Failed to create template:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('download-import-errors', async (event, { user, failedRows }) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        
        if (!failedRows || failedRows.length === 0) {
            return { success: false, error: 'No failed rows to export.' };
        }

        const headers = Object.keys(failedRows[0].data);
        headers.push("__ERROR_REASON__");

        const dataToExport = failedRows.map(fail => {
            return {
                ...fail.data,
                "__ERROR_REASON__": fail.reason 
            };
        });

        try {
            const saveDialogResult = await dialog.showSaveDialog(win, {
                title: 'Save Import Error Report',
                defaultPath: 'import_error_report.xlsx',
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            });
            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                return { success: false, error: 'User cancelled save.' };
            }

            const filePath = saveDialogResult.filePath;
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
            XLSX.utils.book_append_sheet(wb, ws, 'Failed Rows');
            XLSX.writeFile(wb, filePath);

            logAction(user, 'export_import_errors', 'system', 1, `Exported ${failedRows.length} failed rows`);
            return { success: true, filePath: filePath };
        } catch (err) {
            console.error('Failed to create error report:', err);
            return { success: false, error: err.message };
        }
    });
};

module.exports = { registerDocumentImportHandlers };
