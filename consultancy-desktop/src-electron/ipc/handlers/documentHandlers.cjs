const { ipcMain, dialog, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const mime = require("mime");
const extract = require("extract-zip");
const Tesseract = require("tesseract.js");
const ejs = require("ejs");
const { v4: uuidv4 } = require("uuid");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerDocumentHandlers(app) {

    const db = getDatabase();

    // =====================================================================
    // 🔹 READ OFFER LETTER TEMPLATE
    // =====================================================================
    ipcMain.handle("read-offer-template", async () => {
        try {
            const templatePath = path.join(app.getAppPath(), "src-electron", "templates", "offer_letter_template.ejs");

            if (!fs.existsSync(templatePath)) {
                return { success: false, error: "Template file not found." };
            }

            const content = fs.readFileSync(templatePath, "utf8");
            return { success: true, content };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =====================================================================
    // 🔹 WRITE / UPDATE OFFER LETTER TEMPLATE
    // =====================================================================
    ipcMain.handle("write-offer-template", async (event, { user, content }) => {
        try {
            if (user.role !== "super_admin") {
                return { success: false, error: "Access denied." };
            }

            const templatePath = path.join(app.getAppPath(), "src-electron", "templates", "offer_letter_template.ejs");
            fs.writeFileSync(templatePath, content);

            logAction(user, "update_offer_template", "system", 1);
            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =====================================================================
    // 🔹 PRINT HTML TO PDF
    // =====================================================================
    ipcMain.handle("print-to-pdf", async (event, url) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const printWindow = new BrowserWindow({ show: false });
        
        try {
            await printWindow.loadURL(url);

            const pdfBuffer = await printWindow.webContents.printToPDF({
                printBackground: true
            });

            const saveDialog = await dialog.showSaveDialog(win, {
                title: "Save PDF",
                defaultPath: "offer_letter.pdf",
                filters: [{ name: "PDF", extensions: ["pdf"] }]
            });

            if (saveDialog.canceled) {
                printWindow.close();
                return { success: false, error: "Cancelled." };
            }

            fs.writeFileSync(saveDialog.filePath, pdfBuffer);
            printWindow.close();

            return { success: true, filePath: saveDialog.filePath };

        } catch (err) {
            if (printWindow) printWindow.close();
            return { success: false, error: err.message };
        }
    });

    // =====================================================================
    // 🔹 READ ABSOLUTE FILE BUFFER (PDF / IMAGE)
    // =====================================================================
    ipcMain.handle("readAbsoluteFileBuffer", async (event, { filePath }) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: "File not found." };
            }

            const buffer = fs.readFileSync(filePath);
            const type = mime.getType(filePath) || "application/octet-stream";

            return { success: true, buffer, type };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =====================================================================
    // 🔹 ZIP CANDIDATE DOCUMENTS
    // =====================================================================
    ipcMain.handle("zip-candidate-documents", async (event, { user, candidateId, destinationPath }) => {
        try {
            return await queries.zipCandidateDocuments(candidateId, destinationPath);
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =====================================================================
    // 🔹 OCR PASSPORT SCAN (MRZ Reader)
    // =====================================================================
    ipcMain.handle("ocr-scan-passport", async (event, { fileBuffer }) => {
        if (!fileBuffer) {
            return { success: false, error: "No file provided." };
        }

        let worker;

        try {
            worker = await Tesseract.createWorker("eng");

            const { data: { text } } = await worker.recognize(Buffer.from(fileBuffer));

            const result = queries.parsePassportMRZ(text);

            return {
                success: true,
                data: result || null,
                rawText: text
            };

        } catch (err) {
            return { success: false, error: err.message };
        } finally {
            if (worker) await worker.terminate();
        }
    });

};
