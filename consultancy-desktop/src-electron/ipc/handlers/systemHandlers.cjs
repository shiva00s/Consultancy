const { BrowserWindow, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const extract = require('extract-zip');
const ip = require('ip');
const { sendEmail } = require('../../utils/emailSender.cjs');
const { getDatabase } = require('../../db/database.cjs'); // Ensure this path is correct

const registerSystemHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('show-save-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showSaveDialog(win, options);
    });

    ipcMain.handle('show-open-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showOpenDialog(win, options);
    });

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
        if (!fs.existsSync(filesDir)) {
            console.warn('candidate_files directory not found, creating backup without it.');
        }

        try {
            const output = fs.createWriteStream(destinationPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('warning', (err) => {
                if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
            });
            archive.on('error', (err) => {
                console.error('Archiver error:', err);
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

    ipcMain.handle('get-machine-id', () => {
        const machineId = `${os.hostname().toUpperCase()}-${os.type().substring(0, 3)}-${ip.address().split('.').slice(2).join('.')}`;
        return { success: true, machineId: machineId };
    });

    ipcMain.handle('get-activation-status', async () => {
        return queries.getActivationStatus();
    });

    ipcMain.handle('activate-application', async (event, { activationKey }) => {
        const machineId = `${os.hostname().toUpperCase()}-${os.type().substring(0, 3)}-${ip.address().split('.').slice(2).join('.')}`;
        const expectedKeyPrefix = '74482';

        if (!activationKey || activationKey.length !== 5 || activationKey !== expectedKeyPrefix) {
            return { success: false, error: "Invalid activation code. Please contact support." };
        }
        
        const result = await queries.setActivationStatus({ activated: true, machineId: machineId });
        
        if (result.success) {
            logAction({ id: 0, username: 'SYSTEM' }, 'activate_license', 'system', 1, `Application activated on Machine ID: ${machineId}`);
        }
        
        return result;
    });

    ipcMain.handle('restore-database', async (event, { user }) => {
        if (user.role !== 'super_admin') return { success: false, error: 'Access Denied.' };

        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(win, {
            title: 'Select Backup File',
            filters: [{ name: 'Zip Backup', extensions: ['zip'] }],
            properties: ['openFile']
        });

        if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' };

        const backupPath = result.filePaths[0];
        const userDataPath = app.getPath('userData');
        const tempRestore = path.join(os.tmpdir(), 'consultancy_restore');

        try {
            await extract(backupPath, { dir: tempRestore });

            if (!fs.existsSync(path.join(tempRestore, 'consultancy.db'))) {
                 return { success: false, error: 'Invalid Backup: consultancy.db missing.' };
            }
            
            // Forcing app restart for a cleaner database swap.
            // In a real scenario, you'd close the DB connection here before copying.

            fs.copyFileSync(path.join(tempRestore, 'consultancy.db'), path.join(userDataPath, 'consultancy.db'));
            
            const filesSrc = path.join(tempRestore, 'candidate_files');
            const filesDest = path.join(userDataPath, 'candidate_files');
            
            if (fs.existsSync(filesSrc)) {
                // Node 16.7+ has fs.cpSync, for older Node, this would be a manual copy or using fs-extra
                // For now, assume fs.cpSync is available or similar recursive copy is handled.
                // Alternatively, warn user to manually copy. For a production-ready app, use fs-extra or similar.
                try {
                    fs.cpSync(filesSrc, filesDest, { recursive: true, force: true });
                } catch (cpErr) {
                    console.warn(`Could not copy candidate_files recursively: ${cpErr.message}. User might need to copy manually.`);
                }
            }

            logAction(user, 'system_restore', 'system', 1, 'Database restored from backup.');
            
            app.relaunch();
            app.exit(0);

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        } finally {
            // Clean up temporary directory
            if (fs.existsSync(tempRestore)) {
                fs.rmSync(tempRestore, { recursive: true, force: true });
            }
        }
    });

    ipcMain.handle('test-smtp-connection', async (event, { config }) => {
        const nodemailer = require('nodemailer');
        try {
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port),
                secure: config.secure,
                auth: { user: config.user, pass: config.pass },
            });
            await transporter.verify();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
};

module.exports = { registerSystemHandlers };
