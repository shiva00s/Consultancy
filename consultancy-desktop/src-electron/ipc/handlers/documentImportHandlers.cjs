const { ipcMain, app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const csv = require("csv-parser");
const XLSX = require("xlsx");
const extract = require("extract-zip");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime");

const queries = require("../db/queries.cjs");
const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet } = require("../db/queries.cjs");

// Shared audit logger
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerDocumentImportHandlers() {

    const db = getDatabase();

    // ----------------------------------------------------------------------
    // 1. BULK IMPORT DOCUMENT ZIP
    // ----------------------------------------------------------------------
    ipcMain.handle("bulk-import-documents", async (event, { user, candidateIdMap, archivePath }) => {
        try {
            const db = getDatabase();

            if (!fs.existsSync(archivePath)) {
                return { success: false, error: "Archive file not found." };
            }

            const tempExtractDir = path.join(os.tmpdir(), `import_${uuidv4()}`);
            if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir);

            await extract(archivePath, { dir: tempExtractDir });

            const files = fs.readdirSync(tempExtractDir);
            const filesDir = path.join(app.getPath("userData"), "candidate_files");
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

            const sqlDoc =
                `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category)
                 VALUES (?, ?, ?, ?, ?)`;

            let successful = 0;
            let failed = 0;

            for (const fileName of files) {
                if (fileName.startsWith(".") || fileName.startsWith("__")) continue;

                const cleanName = path.parse(fileName).name;
                const parts = cleanName.split("_");

                let passportNo = parts[0].trim().toUpperCase();
                let category = "Uncategorized";
                if (parts.length >= 2) category = parts.slice(1).join("_");

                const candidateId = candidateIdMap[passportNo];

                if (candidateId) {
                    const uniqueName = `${uuidv4()}${path.extname(fileName)}`;
                    const newFilePath = path.join(filesDir, uniqueName);

                    try {
                        fs.copyFileSync(path.join(tempExtractDir, fileName), newFilePath);

                        await new Promise(resolve => {
                            const fileType = mime.getType(fileName) || "application/octet-stream";
                            db.run(sqlDoc, [candidateId, fileType, fileName, newFilePath, category], err => {
                                if (err) {
                                    failed++;
                                    fs.unlinkSync(newFilePath); 
                                } else successful++;
                                resolve();
                            });
                        });

                    } catch (err) {
                        failed++;
                    }

                } else {
                    failed++;
                }
            }

            fs.rmSync(tempExtractDir, { recursive: true, force: true });

            logAction(user, "bulk_doc_import", "system", 1, `Success=${successful}, Failed=${failed}`);

            return { success: true, data: { successfulDocs: successful, failedDocs: failed } };

        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // ----------------------------------------------------------------------
    // 2. Read CSV HEADERS
    // ----------------------------------------------------------------------
    ipcMain.handle("get-csv-headers", async (event, { filePath }) => {
        return new Promise(resolve => {
            if (!fs.existsSync(filePath)) {
                return resolve({ success: false, error: "File not found." });
            }

            const headers = [];

            fs.createReadStream(filePath)
                .pipe(csv())
                .on("headers", hdr => headers.push(...hdr))
                .on("end", () => {
                    if (headers.length > 0)
                        resolve({ success: true, headers });
                    else
                        resolve({ success: false, error: "Could not read headers." });
                })
                .on("error", err => {
                    resolve({ success: false, error: err.message });
                });
        });
    });

    // ----------------------------------------------------------------------
    // 3. Import Candidates From CSV
    // ----------------------------------------------------------------------
    ipcMain.handle("import-candidates-from-file", async (event, { user, filePath, mapping }) => {
        const db = getDatabase();
        const rows = [];
        const results = { successfulCount: 0, failedCount: 0, failures: [] };

        const required = "passportNo";
        const inverted = {};

        for (const csvHeader in mapping) {
            if (mapping[csvHeader]) inverted[mapping[csvHeader]] = csvHeader;
        }

        if (!inverted[required]) {
            return { success: false, error: `Required column "${required}" not mapped.` };
        }

        try {
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on("data", row => rows.push(row))
                    .on("end", resolve)
                    .on("error", reject);
            });
        } catch (err) {
            return { success: false, error: `CSV read error: ${err.message}` };
        }

        await dbRun(db, "BEGIN TRANSACTION");

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const line = i + 2;

            const data = {
                name: r[inverted.name] || null,
                education: r[inverted.education] || null,
                experience: r[inverted.experience] || null,
                dob: r[inverted.dob] || null,
                passportNo: r[inverted.passportNo] || null,
                passportExpiry: r[inverted.passportExpiry] || null,
                contact: r[inverted.contact] || null,
                aadhar: r[inverted.aadhar] || null,
                status: r[inverted.status] || "New",
                notes: r[inverted.notes] || null,
                Position: r[inverted.Position] || null
            };

            try {
                const create = await queries.createCandidate(data);

                if (create.success) {
                    results.successfulCount++;
                    logAction(user, "bulk_import_create", "candidates", create.id,
                        `Name=${data.name}, Passport=${data.passportNo}`);
                } else {
                    results.failedCount++;
                    results.failures.push({ data: r, reason: `Row ${line}: ${create.error}` });
                }

            } catch (err) {
                results.failedCount++;
                results.failures.push({ data: r, reason: `Row ${line}: ${err.message}` });
            }
        }

        await dbRun(db, "COMMIT");

        logAction(user, "bulk_import_complete", "system", 1,
            `Success=${results.successfulCount}, Failed=${results.failedCount}`);

        return { success: true, data: results };
    });

    // ----------------------------------------------------------------------
    // 4. Get Excel Sheet Names
    // ----------------------------------------------------------------------
    ipcMain.handle("get-excel-sheets", async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) return { success: false, error: "File not found." };
            const workbook = XLSX.readFile(filePath);
            return { success: true, sheets: workbook.SheetNames };
        } catch (err) {
            return { success: false, error: `Excel read failed: ${err.message}` };
        }
    });

    // ----------------------------------------------------------------------
    // 5. Get Excel Headers
    // ----------------------------------------------------------------------
    ipcMain.handle("get-excel-headers", async (event, { filePath, sheetName }) => {
        try {
            if (!fs.existsSync(filePath)) return { success: false, error: "File not found." };

            const book = XLSX.readFile(filePath);
            if (!book.SheetNames.includes(sheetName))
                return { success: false, error: "Sheet not found." };

            const ws = book.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (rows.length === 0) return { success: false, error: "Sheet empty." };

            return { success: true, headers: rows[0] };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ----------------------------------------------------------------------
    // 6. Import Candidates From Excel
    // ----------------------------------------------------------------------
    ipcMain.handle("import-candidates-from-excel", async (event, { user, filePath, sheetName, mapping }) => {
        const db = getDatabase();
        const results = { successfulCount: 0, failedCount: 0, failures: [] };

        const required = "passportNo";
        const inverted = {};

        for (const key in mapping) {
            if (mapping[key]) inverted[mapping[key]] = key;
        }

        if (!inverted[required])
            return { success: false, error: `Required column "${required}" not mapped.` };

        let rows = [];
        try {
            const book = XLSX.readFile(filePath);
            const ws = book.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(ws);
        } catch (err) {
            return { success: false, error: `Excel read error: ${err.message}` };
        }

        const parseExcelDate = excelSerial => {
            if (!isNaN(excelSerial) && excelSerial > 25569) {
                const date = new Date((excelSerial - 25569) * 86400 * 1000);
                return date.toISOString().split("T")[0];
            }
            return excelSerial;
        };

        await dbRun(db, "BEGIN TRANSACTION");

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const line = i + 2;

            const data = {
                name: r[inverted.name] || null,
                education: r[inverted.education] || null,
                experience: r[inverted.experience] || null,
                dob: parseExcelDate(r[inverted.dob]),
                passportNo: r[inverted.passportNo] || null,
                passportExpiry: parseExcelDate(r[inverted.passportExpiry]),
                contact: r[inverted.contact] || null,
                aadhar: r[inverted.aadhar] || null,
                status: r[inverted.status] || "New",
                notes: r[inverted.notes] || null,
                Position: r[inverted.Position] || null
            };

            try {
                const createResult = await queries.createCandidate(data);

                if (createResult.success) {
                    results.successfulCount++;
                    logAction(user, "bulk_import_create", "candidates", createResult.id,
                        `Name=${data.name}, Passport=${data.passportNo}`);
                } else {
                    results.failedCount++;
                    results.failures.push({ data: r, reason: `Row ${line}: ${createResult.error}` });
                }

            } catch (err) {
                results.failedCount++;
                results.failures.push({ data: r, reason: `Row ${line}: ${err.message}` });
            }
        }

        await dbRun(db, "COMMIT");

        return { success: true, data: results };
    });

    // ----------------------------------------------------------------------
    // 7. Download Excel Template
    // ----------------------------------------------------------------------
    ipcMain.handle("download-excel-template", async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);

        const headers = [
            "name", "passportNo", "Position", "contact", "aadhar",
            "education", "experience", "dob", "passportExpiry",
            "status", "notes"
        ];

        try {
            const save = await dialog.showSaveDialog(win, {
                title: "Save Excel Import Template",
                defaultPath: "candidate_import_template.xlsx",
                filters: [{ name: "Excel Files", extensions: ["xlsx"] }]
            });

            if (save.canceled || !save.filePath)
                return { success: false, error: "Cancelled." };

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers]);
            XLSX.utils.book_append_sheet(wb, ws, "Candidates");
            XLSX.writeFile(wb, save.filePath);

            return { success: true, filePath: save.filePath };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ----------------------------------------------------------------------
    // 8. Download Import Errors
    // ----------------------------------------------------------------------
    ipcMain.handle("download-import-errors", async (event, { user, failedRows }) => {
        const win = BrowserWindow.fromWebContents(event.sender);

        if (!failedRows || failedRows.length === 0)
            return { success: false, error: "No failed rows." };

        const headers = Object.keys(failedRows[0].data).concat("__ERROR_REASON__");

        const exportRows = failedRows.map(r => ({
            ...r.data,
            __ERROR_REASON__: r.reason
        }));

        try {
            const save = await dialog.showSaveDialog(win, {
                title: "Save Import Error Report",
                defaultPath: "import_error_report.xlsx",
                filters: [{ name: "Excel Files", extensions: ["xlsx"] }]
            });

            if (save.canceled || !save.filePath)
                return { success: false, error: "Cancelled." };

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers });
            XLSX.utils.book_append_sheet(wb, ws, "Failed Rows");
            XLSX.writeFile(wb, save.filePath);

            logAction(user, "export_import_errors", "system", 1,
                `Exported ${failedRows.length} failed rows`);

            return { success: true, filePath: save.filePath };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
