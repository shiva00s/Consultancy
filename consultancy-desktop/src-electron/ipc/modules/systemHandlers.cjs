// src-electron/ipc/modules/systemHandlers.cjs
const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const extract = require('extract-zip');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerSystemHandlers(app) {
    console.log('⚙️ Registering System Handlers...');

    // ====================================================================
    // DIALOGS
    // ====================================================================
    
    ipcMain.handle('show-save-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showSaveDialog(win, options);
    });

    ipcMain.handle('show-open-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showOpenDialog(win, options);
    });

    // ====================================================================
    // BACKUP & RESTORE
    // ====================================================================
    
    ipcMain.handle('backup-database', async (event, { user, destinationPath }) => {
        if (!user || user.role === 'staff') {
            return { success: false, error: 'Access Denied: Staff cannot perform database backups.' };
        }

        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'consultancy.db');
        const filesDir = path.join(userDataPath, 'candidate_files');

        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'Source database file not found.' };
        }

        try {
            const output = fs.createWriteStream(destinationPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            archive.on('warning', (err) => {
                if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
            });
            archive.on('error', (err) => {
                throw err;
            });
            
            archive.pipe(output);
            archive.file(dbPath, { name: 'consultancy.db' });
            
            if (fs.existsSync(filesDir)) {
                archive.directory(filesDir, 'candidate_files');
            }
            
            await archive.finalize();
            logAction(user, 'create_backup', 'system', 1, `Backup created: ${destinationPath}`);
            
            return { success: true };
        } catch (err) {
            console.error('Database backup failed:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('restore-database', async (event, { user }) => {
        if (user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Super Admin only.' };
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(win, {
            title: 'Select Backup File',
            filters: [{ name: 'Zip Backup', extensions: ['zip'] }],
            properties: ['openFile']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'Cancelled' };
        }

        const backupPath = result.filePaths[0];
        const userDataPath = app.getPath('userData');
        const tempRestore = path.join(os.tmpdir(), 'consultancy_restore');

        try {
            await extract(backupPath, { dir: tempRestore });

            if (!fs.existsSync(path.join(tempRestore, 'consultancy.db'))) {
                return { success: false, error: 'Invalid Backup: consultancy.db missing.' };
            }

            fs.copyFileSync(
                path.join(tempRestore, 'consultancy.db'),
                path.join(userDataPath, 'consultancy.db')
            );

            const filesSrc = path.join(tempRestore, 'candidate_files');
            const filesDest = path.join(userDataPath, 'candidate_files');

            if (fs.existsSync(filesSrc)) {
                fs.cpSync(filesSrc, filesDest, { recursive: true });
            }

            logAction(user, 'system_restore', 'system', 1, 'Database restored from backup.');

            app.relaunch();
            app.exit(0);

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // ====================================================================
    // REQUIRED DOCUMENTS
    // ====================================================================
    
    ipcMain.handle('get-required-documents', async (event) => {
        return queries.getRequiredDocuments();
    });

    ipcMain.handle('add-required-document', async (event, { user, name }) => {
        const result = await queries.addRequiredDocument(name);
        if (result.success) {
            logAction(user, 'add_required_doc', 'settings', result.data.id, `Name: ${name}`);
        }
        return result;
    });

    ipcMain.handle('delete-required-document', async (event, { user, id }) => {
        const result = await queries.deleteRequiredDocument(id);
        if (result.success) {
            logAction(user, 'delete_required_doc', 'settings', id);
        }
        return result;
    });

    // ====================================================================
    // DASHBOARD
    // ====================================================================
    
    ipcMain.handle('get-reporting-data', async (event, { user, filters = {} } = {}) => {
        if (user) {
            logAction(user, 'view_dashboard_reports', 'system', 1, 'Viewed reporting dashboard.');
        }
        return queries.getReportingData(user, filters);
    });

    ipcMain.handle('get-detailed-report-list', async (event, { user, status, employer }) => {
        return queries.getDetailedReportList(user, { status, employer });
    });

    console.log('✅ System Handlers Registered');
}

module.exports = { registerSystemHandlers };
