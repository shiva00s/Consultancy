const { ipcMain } = require("electron");
const { sendEmail } = require("../utils/emailSender.cjs");
const { logAction } = require("../utils/auditHelper.cjs");
const { getDatabase } = require("../db/database.cjs");
const queries = require("../db/queries.cjs");
const { sendEmail, saveSmtpSettings } = require("../utils/emailSender.cjs");
const nodemailer = require("nodemailer");

module.exports = function registerEmailHandlers() {

    // =========================================================================
    // 🔹 SEND SINGLE EMAIL
    // =========================================================================
    ipcMain.handle("send-email", async (event, { user, to, subject, text, html }) => {
        try {
            const result = await sendEmail({ to, subject, text, html });

            if (user) {
                logAction(
                    user,
                    "send_email",
                    "email",
                    0,
                    `Sent email to: ${to}, Subject: ${subject}`
                );
            }

            return { success: true, info: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 SEND BULK EMAIL (Multiple recipients)
    // =========================================================================
    ipcMain.handle("send-bulk-email", async (event, { user, recipients, subject, text, html }) => {
        try {
            for (const to of recipients) {
                await sendEmail({ to, subject, text, html });
            }

            if (user) {
                logAction(
                    user,
                    "send_bulk_email",
                    "email",
                    0,
                    `Bulk email to ${recipients.length} recipients`
                );
            }

            return { success: true, count: recipients.length };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 SEND OFFER LETTER EMAIL WITH ATTACHMENT
    // =========================================================================
    ipcMain.handle("send-offer-letter-email", async (event, { user, to, subject, html, pdfPath }) => {
        try {
            const attachments = [];

            if (pdfPath) {
                attachments.push({
                    filename: "Offer_Letter.pdf",
                    path: pdfPath
                });
            }

            const result = await sendEmail({
                to,
                subject,
                html,
                attachments
            });

            if (user) {
                logAction(
                    user,
                    "send_offer_letter_email",
                    "email",
                    0,
                    `Offer letter sent to ${to}`
                );
            }

            return { success: true, info: result };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};

// ---------------------------------------------------------------------------
// REGISTER EMAIL & SMTP HANDLERS
// ---------------------------------------------------------------------------
module.exports = function registerEmailHandlers() {

    const db = getDatabase();

    // =======================================================================
    // 1️⃣ GET SMTP SETTINGS (Super Admin Only)
    // =======================================================================
    ipcMain.handle("get-smtp-settings", async (event, { user }) => {
        if (!user || user.role !== "super_admin") {
            return { success: false, error: "Access Denied" };
        }

        try {
            const row = await queries.dbGet(
                db,
                "SELECT value FROM system_settings WHERE key = 'smtp_config'",
                []
            );

            if (row?.value) {
                return { success: true, config: JSON.parse(row.value) };
            }

            return { success: true, config: null };  // No config yet

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 2️⃣ SAVE SMTP SETTINGS (Super Admin Only)
    // =======================================================================
    ipcMain.handle("save-smtp-settings", async (event, { user, config }) => {
        if (!user || user.role !== "super_admin") {
            return { success: false, error: "Access Denied" };
        }

        try {
            await saveSmtpSettings(config);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 3️⃣ SEND EMAIL (Any Role Allowed)
    // =======================================================================
    ipcMain.handle("send-email", async (event, { user, to, subject, body, attachments }) => {
        try {
            await sendEmail({
                to,
                subject,
                html: body,
                attachments,
            });

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 4️⃣ TEST SMTP CONNECTION
    // =======================================================================
    ipcMain.handle("test-smtp-connection", async (event, { config }) => {
        try {
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port),
                secure: config.secure ?? false,
                auth: {
                    user: config.user,
                    pass: config.pass,
                },
            });

            await transporter.verify();

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};