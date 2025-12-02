const { ipcMain, dialog, BrowserWindow, shell, app } = require("electron");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const extract = require("extract-zip");
const mime = require("mime");
const os = require("os");
const { getDatabase } = require("../db/database.cjs");
const { logAction } = require("../utils/auditHelper.cjs");

module.exports = function registerFileHandlers() {
    const db = getDatabase();

    // =========================================================================
    // 🔹 SHOW SAVE DIALOG
    // =========================================================================
    ipcMain.handle("show-save-dialog", async (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showSaveDialog(win, options);
    });

    // =========================================================================
    // 🔹 SHOW OPEN DIALOG
    // =========================================================================
    ipcMain.handle("show-open-dialog", async (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showOpenDialog(win, options);
    });

    // =========================================================================
    // 🔹 OPEN FILE EXTERNALLY
    // =========================================================================
    ipcMain.handle("open-file-externally", async (event, { filePath }) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: "File not found." };
        }

        shell.openPath(filePath);
        return { success: true };
    });

    // =========================================================================
    // 🔹 BASE64 READER (Image / PDF)
    // =========================================================================
    ipcMain.handle("get-document-base64", async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: "File not found." };
            }

            const base64 = fs.readFileSync(filePath, "base64");
            const ext = path.extname(filePath).toLowerCase();

            let type = "application/octet-stream";

            if (ext === ".pdf") type = "application/pdf";
            else if ([".jpg", ".jpeg"].includes(ext)) type = "image/jpeg";
            else if (ext === ".png") type = "image/png";

            return { success: true, data: `data:${type};base64,${base64}` };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 READ ABSOLUTE FILE BUFFER
    // =========================================================================
    ipcMain.handle("readAbsoluteFileBuffer", async (event, { filePath }) => {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return { success: false, error: "File not found." };
            }

            const buffer = fs.readFileSync(filePath);
            const type = mime.getType(filePath) || "application/octet-stream";

            return { success: true, buffer, type };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 SECURE FILE PATH LOOKUP
    // =========================================================================
    ipcMain.handle("get-secure-file-path", async (event, { documentId }) => {
        try {
            const row = await new Promise((resolve, reject) => {
                db.get(`SELECT filePath FROM documents WHERE id = ?`, [documentId], (err, row) => {
                    if (err) return resolve(null);
                    resolve(row);
                });
            });

            if (!row || !row.filePath) {
                return { success: false, error: "Document not found." };
            }

            return { success: true, filePath: row.filePath };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 BACKUP DATABASE (ZIP EXPORT)
    // =========================================================================
    ipcMain.handle("backup-database", async (event, { user, destinationPath }) => {
        if (user.role === "staff") {
            return { success: false, error: "Access denied." };
        }

        try {
            const userData = app.getPath("userData");
            const dbPath = path.join(userData, "consultancy.db");
            const filesDir = path.join(userData, "candidate_files");

            const output = fs.createWriteStream(destinationPath);
            const archive = archiver("zip", { zlib: { level: 9 } });

            archive.pipe(output);
            archive.file(dbPath, { name: "consultancy.db" });

            if (fs.existsSync(filesDir)) {
                archive.directory(filesDir, "candidate_files");
            }

            await archive.finalize();

            logAction(user, "backup_created", "system", 1);

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    // =========================================================================
    // 🔹 RESTORE DATABASE (ZIP IMPORT)
    // =========================================================================
    ipcMain.handle("restore-database", async (event, { user }) => {
        if (user.role !== "super_admin") {
            return { success: false, error: "Only super admin can restore." };
        }

        const win = BrowserWindow.fromWebContents(event.sender);

        const result = await dialog.showOpenDialog(win, {
            title: "Select Backup File",
            filters: [{ name: "Zip Backup", extensions: ["zip"] }],
            properties: ["openFile"]
        });

        if (result.canceled || !result.filePaths.length) {
            return { success: false, error: "Cancelled" };
        }

        const backupZip = result.filePaths[0];
        const userData = app.getPath("userData");
        const tempDir = path.join(os.tmpdir(), "restore_" + uuidv4());

        try {
            await extract(backupZip, { dir: tempDir });

            const restoredDB = path.join(tempDir, "consultancy.db");

            if (!fs.existsSync(restoredDB)) {
                return { success: false, error: "Invalid backup." };
            }

            fs.copyFileSync(restoredDB, path.join(userData, "consultancy.db"));

            const sourceFiles = path.join(tempDir, "candidate_files");
            const destFiles = path.join(userData, "candidate_files");

            if (fs.existsSync(sourceFiles)) {
                fs.cpSync(sourceFiles, destFiles, { recursive: true });
            }

            logAction(user, "restore_database", "system", 1);

            app.relaunch();
            app.exit(0);

            return { success: true };

        } catch (err) {
            return { success: false, error: err.message };
        }
    });

};
