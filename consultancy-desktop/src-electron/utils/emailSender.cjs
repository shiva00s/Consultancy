// src-electron/utils/emailSender.cjs

const nodemailer = require('nodemailer');
const { getDatabase } = require('../db/database.cjs');
const { dbGet } = require('../db/queries.cjs');

let transporter = null;

const setupTransporter = async () => {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'smtp_config'", []);
        
        if (row && row.value) {
            const config = JSON.parse(row.value);
            
            if (!config.host || !config.port || !config.user || !config.pass) {
                return false;
            }
            
            transporter = nodemailer.createTransport({
                host: config.host,
                port: parseInt(config.port, 10),
                secure: config.secure === true || config.secure === 'true',
                auth: {
                    user: config.user,
                    pass: config.pass
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 10000,
            });
            
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

const sendEmail = async ({ to, subject, text, html, attachments }) => {
    try {
        if (!transporter) {
            const initialized = await setupTransporter();
            if (!initialized) {
                return { success: false, error: 'SMTP settings not configured' };
            }
        }

        if (!to || !subject) {
            return { success: false, error: 'Missing required fields' };
        }

        const info = await transporter.sendMail({
            from: transporter.options.auth.user,
            to, subject, text, html, attachments,
        });

        return { success: true, messageId: info.messageId };
    } catch (error) {
        if (error.code === 'EAUTH' || error.responseCode === 535) {
            transporter = null;
        }
        return { success: false, error: error.message };
    }
};

const saveSmtpSettings = async (config) => {
    const db = getDatabase();
    
    try {
        if (!config || !config.host || !config.port || !config.user || !config.pass) {
            throw new Error('Invalid SMTP configuration');
        }

        await new Promise((resolve, reject) => {
            db.run(
                `CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
                [],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Remove spaces from password
        const cleanedConfig = {
            ...config,
            pass: config.pass.replace(/\s+/g, '')
        };

        const json = JSON.stringify(cleanedConfig);
        
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('smtp_config', ?, datetime('now'))`,
                [json],
                (err) => err ? reject(err) : resolve()
            );
        });

        transporter = null;
        return { success: true, message: 'SMTP settings saved successfully' };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

const testSmtpConnection = async () => {
    try {
        if (!transporter) {
            const initialized = await setupTransporter();
            if (!initialized) {
                return { success: false, error: 'SMTP not configured' };
            }
        }

        await transporter.verify();
        return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
        transporter = null;
        return { success: false, error: error.message };
    }
};

const getSmtpSettings = async () => {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'smtp_config'", []);
        
        if (row && row.value) {
            const config = JSON.parse(row.value);
            return {
                success: true,
                config: {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                }
            };
        }
        return { success: true, config: null };
    } catch (err) {
        return { success: false, error: err.message };
    }
};

module.exports = { sendEmail, saveSmtpSettings, testSmtpConnection, getSmtpSettings };
