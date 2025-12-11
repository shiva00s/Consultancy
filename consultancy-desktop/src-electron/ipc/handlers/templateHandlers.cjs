const { BrowserWindow, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const mime = require('mime');
const { getDatabase } = require('../../db/database.cjs'); // Ensure path is correct

const registerTemplateHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('read-offer-template', async () => {
        try {
            const templatePath = path.join(app.getAppPath(), 'src-electron', 'templates', 'offer_letter_template.ejs');
            if (!fs.existsSync(templatePath)) {
                return { success: false, error: 'Offer letter template file not found on disk.' };
            }
            const content = fs.readFileSync(templatePath, 'utf-8');
            return { success: true, data: content };
        } catch (error) {
            console.error('Failed to read template:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('write-offer-template', async (event, { user, content }) => {
        try {
            if (user.role !== 'super_admin') {
                return { success: false, error: 'Access Denied: Only Super Admin can modify templates.' };
            }
            const templatePath = path.join(app.getAppPath(), 'src-electron', 'templates', 'offer_letter_template.ejs');
            fs.writeFileSync(templatePath, content);
            
            logAction(user, 'update_offer_template', 'system', 1, 'Offer letter template file updated.');
            return { success: true };
        } catch (error) {
            console.error('Failed to write template:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('print-to-pdf', async (event, url) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
        try {
            await printWindow.loadURL(url);
            const date = new Date().toISOString().slice(0, 10);
            const defaultFileName = `Candidate_Offer_Letter_${date}.pdf`;
            const saveDialogResult = await dialog.showSaveDialog(win, {
                title: 'Save Generated Offer Letter as PDF',
                defaultPath: defaultFileName,
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
            });
            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                printWindow.close();
                return { success: false, error: 'User cancelled save operation.' };
            }
            const pdfBuffer = await printWindow.webContents.printToPDF({
                margins: { default: 'default' },
                landscape: false,
                printBackground: true,
            });
            fs.writeFileSync(saveDialogResult.filePath, pdfBuffer);
            printWindow.close();
            return { success: true, filePath: saveDialogResult.filePath };
        } catch (error) {
            console.error("PDF Generation Error:", error);
            if (printWindow) printWindow.close();
            return { success: false, error: `PDF generation failed: ${error.message}` };
        }
    });

    ipcMain.handle('generate-offer-letter', async (event, { user, candidateId, jobId, templateData }) => {
        const db = getDatabase(); // Access the database here
        const row = await queries.dbGet(db, `
            SELECT
              c.name AS candidateName, c.passportNo, c.contact, c.aadhar, c.education,
              j.positionTitle, j.requirements,
              e.companyName, e.contactPerson, e.contactEmail, e.country AS employerCountry
            
            FROM candidates c
            JOIN placements p ON p.candidate_id = c.id
            JOIN job_orders j ON j.id = p.job_order_id
            JOIN employers e ON e.id = j.employer_id
            WHERE c.id = ? AND j.id = ? AND c.isDeleted = 0
            LIMIT 1
            `, [candidateId, jobId]);
        
        if (!row) {
            return { success: false, error: 'Failed to fetch candidate/job data. (Not assigned or candidate deleted)' };
        }

        try {
            const today = new Date().toISOString().slice(0, 10);
            const data = { ...row, ...templateData, currentDate: today };

            const templatePath = path.join(app.getAppPath(), 'src-electron', 'templates', 'offer_letter_template.ejs');
            let template = fs.readFileSync(templatePath, 'utf-8');
            const htmlContent = ejs.render(template, data);
            const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.html`);
            fs.writeFileSync(tempFilePath, htmlContent);
            logAction(user, 'generate_offer_letter', 'candidates', candidateId, `Candidate: ${candidateId}, Job ID: ${jobId}`);
            return { 
                success: true, 
                tempPath: tempFilePath,
                candidateName: row.candidateName,
                position: row.positionTitle
            };
        } catch (error) {
            console.error("Offer Letter generation failed:", error);
            return { success: false, error: error.message };
        }
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
                type: path.extname(filePath) === '.pdf' ? 'application/pdf' : mime.getType(filePath) 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
};

module.exports = { registerTemplateHandlers };
