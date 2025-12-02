const { saveSmtpSettings } = require('../../utils/emailSender.cjs');
// const { getDatabase } = require('../../db/database.cjs'); // No longer directly used here, queries module handles DB access

const registerSettingsHandlers = (ipcMain, dependencies) => {
    const { logAction, queries } = dependencies;

    ipcMain.handle('get-required-documents', (event) => {
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

    ipcMain.handle('get-feature-flags', async () => {
        // MODIFIED: Call the new query function
        return queries.getFeatureFlagsFromDb();
    });

    ipcMain.handle('save-feature-flags', async (event, { user, flags }) => {
        if (!user || user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Only Super Admin can modify system modules.' };
        }

        // MODIFIED: Call the new query function
        const result = await queries.saveFeatureFlagsToDb(flags);
        if (result.success) {
            logAction(user, 'update_feature_flags', 'settings', 1, 'Feature flags updated');
        }
        return result;
    });

    

    ipcMain.handle('save-smtp-settings', async (event, { user, config }) => {
        if (user.role !== 'super_admin') return { success: false, error: 'Access Denied' };
        try {
            await saveSmtpSettings(config); // This function should save to DB or secure storage
            logAction(user, 'update_smtp_settings', 'system', 1, 'SMTP settings updated.');
            return { success: true };
        } catch (err) {
            console.error("SMTP Save Error:", err);
            return { success: false, error: err.message };
        }
    });
};

module.exports = { registerSettingsHandlers };
