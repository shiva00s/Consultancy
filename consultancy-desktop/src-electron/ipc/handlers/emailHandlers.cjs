const { sendEmail } = require('../../utils/emailSender.cjs'); // Ensure path is correct

const registerEmailHandlers = (ipcMain, dependencies) => {
    // const { logAction } = dependencies; // logAction is not used directly here, but passed for consistency

    ipcMain.handle('send-email', async (event, { user, to, subject, body, attachments }) => {
        try {
            await sendEmail({ to, subject, html: body, attachments });
            // logAction(user, 'sent_email', 'system', 0, `To: ${to}, Subject: ${subject}`); // Uncomment if logging email sends is desired
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
};

module.exports = { registerEmailHandlers };
