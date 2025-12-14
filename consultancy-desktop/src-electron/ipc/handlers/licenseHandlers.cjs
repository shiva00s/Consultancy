const { ipcMain } = require("electron");
const os = require("os");
const ip = require("ip");
const queries = require("../db/queries.cjs");
const { sendEmail } = require("../utils/emailSender.cjs");
const { getDatabase } = require("../db/database.cjs");

// ---------------------------------------------------------------------------
// 🔹 Machine ID Generator (used both for UI and license mapping)
// ---------------------------------------------------------------------------
function getMachineIdForLicense() {
    return (
        os.hostname().toUpperCase() +
        "-" +
        os.type().substring(0, 3).toUpperCase() +
        "-" +
        ip.address().split(".").slice(2).join(".")
    );
}

// ---------------------------------------------------------------------------
// 🔹 Register Activation IPC Handlers
// ---------------------------------------------------------------------------
module.exports = function registerLicenseHandlers() {
    const db = getDatabase();

    // =======================================================================
    // 🔹 1. Request Activation Code
    // =======================================================================
    ipcMain.handle("request-activation-code", async () => {
        try {
            const machineId = getMachineIdForLicense();
            const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digit OTP

            // Save request in DB (pending activation)
            await queries.savePendingActivation({
                machineId,
                code,
                email: "prakashshiva368@gmail.com",
            });

            // Send email (ignore failures)
            const emailResult = await sendEmail({
                to: "prakashshiva368@gmail.com",
                subject: "Consultancy Desktop Activation Code",
                text: `Machine ID: ${machineId}\nActivation Code: ${code}`,
            });

            if (!emailResult.success) {
                console.warn("Activation email failed:", emailResult.error);
            }

            return { success: true, machineId, code };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =======================================================================
    // 🔹 2. Get Activation Status
    // =======================================================================
    ipcMain.handle("get-activation-status", async () => {
        return new Promise((resolve) => {
            db.get(
                "SELECT value FROM system_settings WHERE key = 'license_status'",
                [],
                (err, row) => {
                    if (err) {
                        console.error("get-activation-status error:", err);
                        return resolve({ success: false, data: null });
                    }

                    const activated = row?.value === "activated";

                    resolve({
                        success: true,
                        data: { activated },
                    });
                }
            );
        });
    });

    // =======================================================================
    // 🔹 3. Activate Application
    // =======================================================================
    ipcMain.handle("activate-application", async (event, code) => {
        const db = getDatabase();
        const trimmed = typeof code === "string" ? code.trim() : "";

        if (trimmed.length !== 6) {
            return { success: false, error: "Invalid activation code." };
        }

        // NOTE: You can verify code against pending_activation table if required

        return new Promise((resolve) => {
            db.run(
                "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', 'activated')",
                [],
                (err) => {
                    if (err) {
                        console.error("activate-application error:", err);
                        return resolve({
                            success: false,
                            error: "Failed to save license.",
                        });
                    }

                    resolve({ success: true, data: { activated: true } });
                }
            );
        });
    });

};
