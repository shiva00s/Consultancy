const nodemailer = require('nodemailer');
const { getDatabase } = require('../db/database.cjs');
const { dbGet } = require('../db/queries.cjs');

let transporter = null;

// Helper to get SMTP settings from DB
const setupTransporter = async () => {
  const db = getDatabase();
  try {
    const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'smtp_config'", []);
    if (row && row.value) {
        const config = JSON.parse(row.value);
        transporter = nodemailer.createTransport({
            host: config.host,
            port: parseInt(config.port),
            secure: config.secure, 
            auth: { user: config.user, pass: config.pass },
        });
        return true;
    }
  } catch (err) {
      console.error("Error loading SMTP config:", err);
  }
  return false;
};

// Send Email Function
const sendEmail = async ({ to, subject, text, html, attachments }) => {
    if (!transporter) {
        const initialized = await setupTransporter();
        if (!initialized) throw new Error("SMTP Settings not configured.");
    }
    try {
        const info = await transporter.sendMail({
            from: transporter.options.auth.user,
            to, subject, text, html, attachments,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// === CRITICAL: Save Function ===
const saveSmtpSettings = async (config) => {
    const db = getDatabase();
    // 1. Ensure the settings table exists (Auto-create)
    await new Promise((resolve) => {
        db.run("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)", [], (err) => {
            if(err) console.error("Table creation error:", err);
            resolve();
        });
    });
    
    const json = JSON.stringify(config);
    // 2. Save the config
    return new Promise((resolve, reject) => {
        db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_config', ?)", [json], (err) => {
            if (err) reject(err);
            else {
                transporter = null; // Reset transporter to force reload
                resolve({ success: true });
            }
        });
    });
};

module.exports = { sendEmail, saveSmtpSettings };