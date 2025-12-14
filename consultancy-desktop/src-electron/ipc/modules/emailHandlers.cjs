// src-electron/ipc/modules/emailHandlers.cjs
const { ipcMain } = require('electron');
const { sendEmail, saveSmtpSettings } = require('../../utils/emailSender.cjs');
const queries = require('../../db/queries.cjs');
const { logAction } = require('../utils/logAction.cjs');
const { guard, FEATURES } = require('../security/ipcPermissionGuard.cjs');
const { getDatabase } = require('../../db/database.cjs');

function registerEmailHandlers(app) {
    console.log('📧 Registering Email Handlers...');

    ipcMain.handle('get-smtp-settings', async (event, { user }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            const db = getDatabase();
            const row = await queries.dbGet(
                db,
                "SELECT value FROM system_settings WHERE key = 'smtp_config'",
                []
            );

            if (!row) {
                return { success: true, data: null };
            }

            const config = JSON.parse(row.value);
            return { success: true, data: config };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('save-smtp-settings', async (event, { user, config }) => {
        try {
            guard(user).enforce(FEATURES.SETTINGS);

            const db = getDatabase();
            const configJson = JSON.stringify(config);

            await queries.dbRun(
                db,
                "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_config', ?)",
                [configJson]
            );

            await saveSmtpSettings(config);
            logAction(user, 'update_smtp_settings', 'settings', 1);

            return { success: true };
        } catch (err) {
            return { success: false, error: err.code || err.message };
        }
    });

    ipcMain.handle('send-email', async (event, { user, to, subject, text, html }) => {
        try {
            const result = await sendEmail({ to, subject, text, html });
            
            if (result.success && user) {
                logAction(user, 'send_email', 'system', 1, `To: ${to}, Subject: ${subject}`);
            }
            
            return result;
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    console.log('✅ Email Handlers Registered');
}

module.exports = { registerEmailHandlers };
