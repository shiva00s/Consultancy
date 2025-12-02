const { ipcMain, dialog, BrowserWindow, shell, app } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const ip = require("ip");
const extract = require("extract-zip");
const { v4: uuidv4 } = require("uuid");
const archiver = require("archiver");

const queries = require("../db/queries.cjs");
const { getDatabase } = require("../db/database.cjs");
const { logAction } = require("../utils/auditHelper.cjs");
const { sendEmail } = require("../utils/emailSender.cjs");

module.exports = function registerSystemHandlers() {

    // -------------------------------------------------------------
    // DIALOGS
    // -------------------------------------------------------------
    ipcMain.handle("show-save-dialog", (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showSaveDialog(win, options);
    });

    ipcMain.handle("show-open-dialog", (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showOpenDialog(win, options);
    });

    // -------------------------------------------------------------
    // MACHINE ID
    // -------------------------------------------------------------
    ipcMain.handle("get-machine-id", () => {
        const machineId =
            os.hostname().toUpperCase() +
            "-" +
            os.type().substring(0, 3) +
            "-" +
            ip.address().split(".").slice(2).join(".");

        return { success: true, machineId };
    });

    // -------------------------------------------------------------
    // GET SERVER IP (Mobile API)
    // -------------------------------------------------------------
    ipcMain.handle("get-server-ip", () => {
        return { ip: ip.address(), port: 3000 };
    });

    // -------------------------------------------------------------
    // BACKUP DATABASE (ZIP)
    // -------------------------------------------------------------
    ipcMain.handle("backup-database", async (event, { user, destinationPath }) => {
        if (!user || user.role === "staff") {
            return { success: false, error: "Access Denied: Staff cannot perform backup." };
        }

        const userData = app.getPath("userData");
        const dbPath = path.join(userData, "consultancy.db");
        const filesDir = path.join(userData, "candidate_files");

        if (!fs.existsSync(dbPath)) {
            return { success: false, error: "Database file missing." };
        }

        try {
            const output = fs.createWriteStream(destinationPath);
            const archive = archiver("zip", { zlib: { level: 9 } });
            archive.pipe(output);

            archive.file(dbPath, { name: "consultancy.db" });

            if (fs.existsSync(filesDir)) {
                archive.directory(filesDir, "candidate_files");
            }

            await archive.finalize();

            logAction(user, "create_backup", "system", 1, `Backup created at ${destinationPath}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // RESTORE DATABASE (ZIP → Replace DB)
    // -------------------------------------------------------------
    ipcMain.handle("restore-database", async (event, { user }) => {
        if (user.role !== "super_admin") {
            return { success: false, error: "Access Denied." };
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        const res = await dialog.showOpenDialog(win, {
            title: "Select Backup ZIP",
            filters: [{ name: "Zip Backup", extensions: ["zip"] }],
            properties: ["openFile"]
        });

        if (res.canceled || res.filePaths.length === 0) {
            return { success: false, error: "Cancelled." };
        }

        const backup = res.filePaths[0];
        const tempExtract = path.join(os.tmpdir(), "restore_" + uuidv4());
        const userData = app.getPath("userData");

        try {
            await extract(backup, { dir: tempExtract });

            const newDb = path.join(tempExtract, "consultancy.db");
            if (!fs.existsSync(newDb)) {
                return { success: false, error: "Invalid Backup: DB missing." };
            }

            fs.copyFileSync(newDb, path.join(userData, "consultancy.db"));

            const srcFiles = path.join(tempExtract, "candidate_files");
            const destFiles = path.join(userData, "candidate_files");

            if (fs.existsSync(srcFiles)) {
                // Node 16+ only
                // fs.cpSync(srcFiles, destFiles, { recursive: true });
            }

            logAction(user, "system_restore", "system", 1, "Database restored.");

            app.relaunch();
            app.exit(0);

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // -------------------------------------------------------------
    // LICENSE: GET ACTIVATION STATUS
    // -------------------------------------------------------------
    ipcMain.handle("get-activation-status", async () => {
        const db = getDatabase();

        return new Promise((resolve) => {
            db.get(
                "SELECT value FROM system_settings WHERE key = 'license_status'",
                [],
                (err, row) => {
                    if (err) {
                        return resolve({ success: false, data: null });
                    }
                    resolve({
                        success: true,
                        data: { activated: row?.value === "activated" }
                    });
                }
            );
        });
    });

    // -------------------------------------------------------------
    // LICENSE: ACTIVATE WITH CODE
    // -------------------------------------------------------------
    ipcMain.handle("activate-application", async (event, code) => {
        const db = getDatabase();
        const clean = typeof code === "string" ? code.trim() : "";

        if (clean.length !== 6) {
            return { success: false, error: "Invalid code." };
        }

        return new Promise((resolve) => {
            db.run(
                "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', 'activated')",
                [],
                (err) => {
                    if (err) {
                        return resolve({ success: false, error: "Failed to save license." });
                    }
                    resolve({ success: true, data: { activated: true } });
                }
            );
        });
    });

    // -------------------------------------------------------------
    // REQUEST ACTIVATION CODE (EMAIL)
    // -------------------------------------------------------------
    ipcMain.handle("request-activation-code", async () => {
        try {
            const machineId = os.hostname().toUpperCase();
            const code = String(Math.floor(100000 + Math.random() * 900000));

            await queries.savePendingActivation({
                machineId,
                code,
                email: "prakashshiva368@gmail.com"
            });

            await sendEmail({
                to: "prakashshiva368@gmail.com",
                subject: "Consultancy Desktop Activation Code",
                text: `Machine ID: ${machineId}\nActivation Code: ${code}`
            });

            return { success: true, machineId, code };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
