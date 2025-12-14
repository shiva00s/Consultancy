// src-electron/ipc/modules/licenseHandlers.cjs

const { ipcMain } = require('electron');
const { getDatabase } = require('../../db/database.cjs');
const crypto = require('crypto');
const os = require('os');
const { sendEmail, saveSmtpSettings } = require('../../utils/emailSender.cjs');

function registerLicenseHandlers() {
    const db = getDatabase();

    ipcMain.handle('get-machine-id', async () => {
        try {
            const machineId = generateMachineId();
            return { success: true, machineId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('request-activation-code', async () => {
        try {
            const machineId = generateMachineId();
            const code = String(Math.floor(100000 + Math.random() * 900000));

            try {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO activations (machineId, code, activated, createdAt)
                    VALUES (?, ?, 0, datetime('now'))
                `);
                stmt.run(machineId, code);
            } catch (dbError) {
                // Silent fail
            }

            try {
                const emailResult = await sendEmail({
                    to: 'prakashshiva368@gmail.com',
                    subject: 'Consultancy Desktop - Activation Code',
                    text: `Machine ID: ${machineId}\nActivation Code: ${code}\n\nSupport: +91 9629 881 598`.trim(),
                });
            } catch (emailError) {
                // Silent fail
            }

            return { success: true, machineId, code };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-activation-status', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM activation_keys LIMIT 1');
            const row = stmt.get();

            if (!row) {
                return {
                    success: true,
                    data: {
                        activated: false,
                        licenseKey: null,
                        activatedAt: null,
                        expiresAt: null,
                        isExpired: true
                    }
                };
            }

            const now = new Date();
            const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
            const isExpired = expiresAt ? now > expiresAt : false;

            return {
                success: true,
                data: {
                    activated: row.activated === 1 && !isExpired,
                    licenseKey: row.license_key,
                    activatedAt: row.activated_at,
                    expiresAt: row.expires_at,
                    isExpired: isExpired,
                    daysRemaining: expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('activate-license', async (event, { licenseKey }) => {
        try {
            if (!licenseKey || typeof licenseKey !== 'string') {
                return { success: false, error: 'Invalid license key format' };
            }

            if (/^\d{6}$/.test(licenseKey)) {
                try {
                    const machineId = generateMachineId();
                    const stmt = db.prepare(`
                        SELECT * FROM activations 
                        WHERE machineId = ? AND code = ? AND activated = 0
                        ORDER BY createdAt DESC
                        LIMIT 1
                    `);
                    const activation = stmt.get(machineId, licenseKey);
                    
                    if (activation) {
                        const activatedAt = new Date().toISOString();
                        const expiresAt = new Date();
                        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                        const expiresAtISO = expiresAt.toISOString();

                        db.prepare(`UPDATE activations SET activated = 1 WHERE id = ?`).run(activation.id);
                        const existing = db.prepare('SELECT * FROM activation_keys LIMIT 1').get();

                        if (existing) {
                            db.prepare(`UPDATE activation_keys SET license_key = ?, activated = 1, activated_at = ?, expires_at = ?`)
                                .run(licenseKey, activatedAt, expiresAtISO);
                        } else {
                            db.prepare(`INSERT INTO activation_keys (license_key, activated, activated_at, expires_at) VALUES (?, 1, ?, ?)`)
                                .run(licenseKey, activatedAt, expiresAtISO);
                        }

                        return {
                            success: true,
                            message: 'License activated successfully',
                            data: { activatedAt, expiresAt: expiresAtISO }
                        };
                    }
                } catch (err) {
                    // Silent fail
                }
                
                return { success: false, error: 'Invalid or already used activation code' };
            }

            const keyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
            if (!keyPattern.test(licenseKey)) {
                return { success: false, error: 'Invalid license key format' };
            }

            const isValid = verifyLicenseKey(licenseKey);
            if (!isValid) {
                return { success: false, error: 'Invalid license key' };
            }

            const activatedAt = new Date().toISOString();
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            const expiresAtISO = expiresAt.toISOString();
            const existing = db.prepare('SELECT * FROM activation_keys LIMIT 1').get();

            if (existing) {
                db.prepare(`UPDATE activation_keys SET license_key = ?, activated = 1, activated_at = ?, expires_at = ?`)
                    .run(licenseKey, activatedAt, expiresAtISO);
            } else {
                db.prepare(`INSERT INTO activation_keys (license_key, activated, activated_at, expires_at) VALUES (?, 1, ?, ?)`)
                    .run(licenseKey, activatedAt, expiresAtISO);
            }

            return {
                success: true,
                message: 'License activated successfully',
                data: { activatedAt, expiresAt: expiresAtISO }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('deactivate-license', async () => {
        try {
            db.prepare('UPDATE activation_keys SET activated = 0').run();
            return { success: true, message: 'License deactivated' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('generate-license-key', async () => {
        try {
            const key = generateLicenseKey();
            return { success: true, licenseKey: key };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

}

function generateMachineId() {
    const hostname = os.hostname().toUpperCase();
    const platform = os.platform().substring(0, 3).toUpperCase();
    const hash = crypto.createHash('md5').update(hostname + platform).digest('hex').substring(0, 8).toUpperCase();
    return `${hostname.substring(0, 6)}-${hash}`;
}

function verifyLicenseKey(licenseKey) {
    const parts = licenseKey.split('-');
    if (parts.length !== 4) return false;
    const dataSegments = parts.slice(0, 3).join('');
    const checksum = parts[3];
    const calculatedChecksum = generateChecksum(dataSegments);
    return checksum === calculatedChecksum;
}

function generateLicenseKey() {
    const segment1 = generateRandomSegment();
    const segment2 = generateRandomSegment();
    const segment3 = generateRandomSegment();
    const dataSegments = segment1 + segment2 + segment3;
    const checksum = generateChecksum(dataSegments);
    return `${segment1}-${segment2}-${segment3}-${checksum}`;
}

function generateRandomSegment() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let segment = '';
    for (let i = 0; i < 4; i++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
}

function generateChecksum(data) {
    const hash = crypto.createHash('md5').update(data + 'MY_SECRET_SALT_2025').digest('hex');
    return hash.substring(0, 4).toUpperCase();
}

module.exports = { registerLicenseHandlers };
