const { ipcMain, shell, app, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const pdf = require('pdf-parse');
const { spawn } = require("child_process"); 
const ip = require('ip');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const mime = require('mime');
const { getDatabase } = require('../db/database.cjs');
const ejs = require('ejs');
const tempFile = require('temp-file');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const queries = require('../db/queries.cjs');
const { dbRun, dbGet, getCanonicalUserContext: getCanonicalUserContextFromQueries } = require('../db/queries.cjs'); 
const { sendEmail, saveSmtpSettings } = require('../utils/emailSender.cjs');
const Tesseract = require('tesseract.js');
const extract = require('extract-zip');
const { registerAnalyticsHandlers } = require('./analyticsHandlers.cjs');
const { registerDocumentHandlers } = require('./documentHandlers.cjs');
const { fileManager } = require('../utils/fileManager.cjs');
const { registerSyncHandlers } = require('./syncHandlers.cjs');
const { registerPermissionHandlers } = require('../utils/permissionHandlers.cjs');
const { enforcePermissionOrDeny } = require('../utils/rbacHelpers.cjs');
const sendWhatsAppBulk = require("./sendWhatsAppBulk.cjs");
const openWhatsAppSingle = require("./openWhatsAppSingle.cjs");
const { guard, FEATURES } = require('./security/ipcPermissionGuard.cjs');
//const sendTwilioWhatsApp = require("./twilioSendWhatsApp.cjs");


const tempDir = path.join(os.tmpdir(), "paddle_ocr_temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 🐞 FIX: Rename the local helper to avoid declaration conflict
const getEventUserContext = (event) => {
    // This helper extracts the user context (which is used for audit logging when user isn't passed)
    return event.sender.session.user || { id: 0, username: 'SYSTEM' }; 
};


const logAction = (user, action, target_type, target_id, details = null) => {
    try {
        const db = getDatabase();
        if (!db) {
            console.error('Audit Log: Database is not initialized.');
            return;
        }
        
        // ✅ Silently skip if user is invalid - no warning needed
        if (!user || !user.id) {
            return; // Just return silently
        }

        const safeUsername = user.username || `User_${user.id}`;

        const sql = `INSERT INTO audit_log (user_id, username, action, target_type, target_id, details)
                     VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [user.id, safeUsername, action, target_type, target_id, details], (err) => {
            if (err) {
                console.error('❌ Failed to write to audit_log:', err.message, {
                    user_id: user.id,
                    username: safeUsername,
                    action,
                    target_type,
                    target_id
                });
            }
        });
    } catch (e) {
        console.error('🔥 Critical error in logAction:', e.message);
    }
};


const extractResumeDetails = (text) => {
    const details = {};
// 1. Email Regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) details.email = emailMatch[0];
// 2. Phone Regex (Generic 10-12 digit)
    const phoneRegex = /\b\d{10,12}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) details.contact = phoneMatch[0];

    // 3. Name Heuristic (Basic: Look for first line or capitalized words near top)
    // This is very hard to do perfectly without AI, so we skip strict name parsing 
    // to avoid bad data, or just grab the first non-empty line.
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) details.name = lines[0].substring(0, 50);
// Cap length

    return details;
};

function getMachineIdForLicense() {
  return os.hostname().toUpperCase();
}

ipcMain.handle('request-activation-code', async () => {
  try {
    const machineId = getMachineIdForLicense();
    const code = String(Math.floor(100000 + Math.random() * 900000));

    await queries.savePendingActivation({ machineId, code, email: 'prakashshiva368@gmail.com' });

    // Try to send email, but ignore failure
    const emailResult = await sendEmail({
      to: 'prakashshiva368@gmail.com',
      subject: 'New Consultancy Desktop Activation Code',
      text: `Machine ID: ${machineId}\nActivation code: ${code}`,
    });

    if (!emailResult.success) {
      console.warn('Activation email failed:', emailResult.error);
    }

    return { success: true, machineId, code }; // include code for debug if you want
  } catch (err) {
    console.error('request-activation-code error', err);
    return { success: false, error: err.message };
  }
});


function registerIpcHandlers(app) {

    registerAnalyticsHandlers();
    registerDocumentHandlers();
    registerSyncHandlers();
    registerPermissionHandlers();
    const db = getDatabase();
    if (!db) {
        console.error('Database is not initialized. Handlers will not be registered.');
        return;
    }

   

    // ====================================================================
    // 1. SYSTEM UTILITIES (Requires Electron modules like dialog)
    // ====================================================================

 
    ipcMain.handle('show-save-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showSaveDialog(win, options);
    });
// ====================================================================
    ipcMain.handle('show-open-dialog', (event, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return dialog.showOpenDialog(win, options);
    });
// ====================================================================
    ipcMain.handle('backup-database', async (event, { user, destinationPath }) => {
        // SECURITY: Staff cannot download full database backups
        if (!user || user.role === 'staff') {
            return { success: false, error: 'Access Denied: Staff cannot perform database backups.' };
        }

        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'consultancy.db');
   
        const filesDir = path.join(userDataPath, 'candidate_files');

        if (!fs.existsSync(dbPath)) {
            return { success: false, error: 'Source database file not found.' };
        }
        if (!fs.existsSync(filesDir)) {
            console.warn('candidate_files directory not found, creating backup without it.');
        }

        try {
     
            const output = fs.createWriteStream(destinationPath);
            
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.on('warning', (err) => {
                if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
            });
            archive.on('error', (err) => {
                console.error('Archiver error:', err);
                throw err;
            });
            archive.pipe(output);
            archive.file(dbPath, { name: 'consultancy.db' });
            if (fs.existsSync(filesDir)) {
                archive.directory(filesDir, 'candidate_files');
            }
            await archive.finalize();
            logAction(user, 'create_backup', 'system', 1, `Backup created: ${destinationPath}`);
            return { success: true };
        } catch (err) {
            console.error('Database backup failed:', err);
            return { success: false, error: err.message };
        }
    });
// ====================================================================
    // 2. USER MANAGEMENT & AUTHENTICATION (REFACTORED)
    // ====================================================================
    
    ipcMain.handle('get-user-permissions', (event, { userId }) => {
      return queries.getUserPermissions(userId);
  });
// ====================================================================
   ipcMain.handle('save-user-permissions', async (event, { user, userId, flags }) => {
    try {
        guard(user).enforce(FEATURES.USERS);

        if (user.role !== 'super_admin') {
            return { success: false, error: 'Only Super Admin can modify permissions.' };
        }

        const result = await queries.saveUserPermissions(userId, flags);

        if (result.success) {
            logAction(
                user,
                'update_user_permissions',
                'users',
                userId,
                `Permissions updated`
            );
        }
        return result;
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});

// ====================================================================
    ipcMain.handle('login', (event, { username, password }) => {
        return queries.login(username, password);
    });
    ipcMain.handle('register-new-user', (event, { username, password, role }) => {
        return queries.registerNewUser(username, password, role);
    });
    ipcMain.handle('get-all-users', (event) => {
        return queries.getAllUsers();
    });
    ipcMain.handle('add-user', async (event, { user, username, password, role }) => {
    try {
        // 🔐 Permission enforcement
        guard(user).enforce(FEATURES.USERS);

        const result = await queries.addUser(username, password, role);

        if (result.success) {
            logAction(
                user,
                'create_user',
                'users',
                result.data.id,
                `Username: ${username}, Role: ${role}`
            );
        }
        return result;
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});
// ====================================================================
    ipcMain.handle('reset-user-password', async (event, { user, id, newPassword }) => {
    try {
        guard(user).enforce(FEATURES.USERS);

        const db = getDatabase();

        const targetUser = await queries.dbGet(
            db,
            'SELECT role FROM users WHERE id = ?',
            [id]
        );

        if (!targetUser) {
            return { success: false, error: 'User not found.' };
        }

        // Admin cannot reset Admin / SuperAdmin
        if (user.role === 'admin' && targetUser.role !== 'staff') {
            return { success: false, error: 'Admins can reset Staff only.' };
        }

        const result = await queries.resetUserPassword(id, newPassword);

        if (result.success) {
            logAction(user, 'reset_password', 'users', id);
        }
        return result;
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});

// ====================================================================
    ipcMain.handle('change-my-password', async (event, { user, oldPassword, newPassword }) => {
        const result = await queries.changeMyPassword(user.id, oldPassword, newPassword);
        if (result.success) {
            logAction(user, 'change_password_self', 'users', user.id);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('delete-user', async (event, { user, idToDelete }) => {
    try {
        // 🔐 Only SuperAdmin allowed
        guard(user).enforce(FEATURES.USERS);

        if (user.role !== 'super_admin') {
            return { success: false, error: 'Only Super Admin can delete users.' };
        }

        if (user.id === idToDelete) {
            return { success: false, error: 'You cannot delete your own account.' };
        }

        const result = await queries.deleteUser(idToDelete, user.id);

        if (result.success) {
            logAction(user, 'delete_user', 'users', idToDelete);
        }
        return result;
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});

// ====================================================================
    ipcMain.handle('get-required-documents', (event) => {
        return queries.getRequiredDocuments();
    });
// ====================================================================
    ipcMain.handle('add-required-document', async (event, { user, name }) => {
        const result = await queries.addRequiredDocument(name);
        if (result.success) {
            logAction(user, 'add_required_doc', 'settings', result.data.id, `Name: ${name}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('delete-required-document', async (event, { user, id }) => {
        const result = await queries.deleteRequiredDocument(id);
        if (result.success) {
            logAction(user, 'delete_required_doc', 'settings', id);
        }
        return result;
    });
// --- Feature Toggles (Settings) ---
ipcMain.handle('get-feature-flags', async (event, { user } = {}) => {
    try {
        // 🔐 Only SuperAdmin can read global feature flags
        guard(user).enforce(FEATURES.SETTINGS);

        if (user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Super Admin only.' };
        }

        const defaultFlags = {
            isEmployersEnabled: true,
            isJobsEnabled: true,
            isVisaKanbanEnabled: true,
            isDocumentsEnabled: true,
            isVisaTrackingEnabled: true,
            isFinanceTrackingEnabled: true,
            isMedicalEnabled: true,
            isInterviewEnabled: true,
            isTravelEnabled: true,
            isHistoryEnabled: true,
            isBulkImportEnabled: true,
            isMobileAccessEnabled: true,
            canViewReports: true,
            canAccessSettings: true,
            canAccessRecycleBin: true,
            canDeletePermanently: true,
        };

        const row = await queries.dbGet(
            getDatabase(),
            "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1",
            []
        );

        if (!row || !row.features) {
            return { success: true, data: defaultFlags };
        }

        const storedFlags = JSON.parse(row.features);
        return { success: true, data: { ...defaultFlags, ...storedFlags } };
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});
// ====================================================================
    ipcMain.handle('save-feature-flags', async (event, { user, flags }) => {
    try {
        // 🔐 Enforce permission + hierarchy
        guard(user).enforce(FEATURES.SETTINGS);

        if (user.role !== 'super_admin') {
            return { success: false, error: 'Access Denied: Super Admin only.' };
        }

        const db = getDatabase();
        const featuresJson = JSON.stringify(flags);

        await queries.dbRun(
            db,
            "UPDATE users SET features = ? WHERE role = 'super_admin'",
            [featuresJson]
        );

        logAction(user, 'update_feature_flags', 'settings', 1, 'Feature flags updated');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.code || err.message };
    }
});

// 3. DASHBOARD & REPORTING (REFACTORED)
    // ====================================================================

    // CRITICAL FIX: Destructure from an empty object if the payload is missing entirely.
    ipcMain.handle('get-reporting-data', (event, { user, filters = {} } = {}) => {
        // 🐞 Audit Log Injection
        logAction(user, 'view_dashboard_reports', 'system', 1, 'Viewed reporting dashboard.');
        return queries.getReportingData(user, filters);
    });
// === NEW HANDLER (INJECTED) ===
    ipcMain.handle('get-detailed-report-list', (event, { user, status, employer }) => {
        // Pass the destructured user object and filter object to the query
        return queries.getDetailedReportList(user, { status, employer });
    });
// ====================================================================
    // 4. CANDIDATE MANAGEMENT (REFACTORED)
    // ====================================================================

    // src-electron/ipc/handlers.cjs

// ... (Keep existing imports at the top)

    // === REAL BULK DOCUMENT IMPORT HANDLER ===
    ipcMain.handle('bulk-import-documents', async (event, { user, candidateIdMap, archivePath }) => {
        try {
            // CRITICAL FIX: Ensure DB is defined within the handler scope
            const db = getDatabase(); 
   
            
            if (!fs.existsSync(archivePath)) {
                return { success: false, error: 'Archive file not found.' };
            }

            // 1. Prepare Temp Directory
            const tempExtractDir = path.join(os.tmpdir(), `import_${uuidv4()}`);
        
            if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir);

            // 2. Extract Zip
            console.log(`Extracting ZIP: ${archivePath}`);
            await extract(archivePath, { dir: tempExtractDir });

            // 3. Process Files
            const files = fs.readdirSync(tempExtractDir);
            console.log(`Found ${files.length} items in ZIP.`);
            
            let successfulDocs = 0;
            let failedDocs = 0;
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
// Ensure storage directory exists
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
            const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
            for (const fileName of files) {
                // Skip Mac/Linux artifacts and hidden files
                if (fileName.startsWith('.') || fileName.startsWith('__')) continue;
                const cleanName = path.parse(fileName).name; 
                const parts = cleanName.split('_');
                
                // Allow files without category (PassportNo.pdf)
                let passportNo = parts[0].trim().toUpperCase();
                let category = 'Uncategorized';

                if (parts.length >= 2) {
                    category = parts.slice(1).join('_');
// Everything after first _ is category
                }

                // Lookup Candidate ID
                const candidateId = candidateIdMap[passportNo];
                if (candidateId) {
                    // Prepare paths and copy file
                    const uniqueName = `${uuidv4()}${path.extname(fileName)}`;
                    const newFilePath = path.join(filesDir, uniqueName);
                    
                    try {
                        // A. Copy file to permanent storage
                        fs.copyFileSync(path.join(tempExtractDir, fileName), newFilePath);
// B. Database Insert (Awaited Promise)
                        await new Promise((resolve, reject) => {
                            const fileType = mime.getType(fileName) || 'application/octet-stream';
                            db.run(sqlDoc, [candidateId, fileType, fileName, newFilePath, category], function(err) {
                                if (err) {
                                    console.error(`DB Insert Failed for ${fileName}:`, err.message);
                       
                                    failedDocs++;
                                    // Cleanup file if DB insert fails
                                    try { fs.unlinkSync(newFilePath); } catch(e) {}
    
                                    resolve(); 
                                } else {
                                 
                                    successfulDocs++;
                                    resolve();
                                }
                            });
 
                        });
                    } catch (fileErr) {
                        console.error(`File Copy Error for ${fileName}:`, fileErr.message);
                        failedDocs++;
                    }
                } else {
                    console.warn(`Skipped: No candidate found for Passport "${passportNo}" (File: ${fileName})`);
                    failedDocs++;
                }
            }

            // 4. Cleanup Temp Files
            try {
                fs.rmSync(tempExtractDir, { recursive: true, force: true });
            } catch (e) { console.error("Temp cleanup failed:", e.message); }

            const logMsg = `Bulk Import: Success=${successfulDocs}, Failed=${failedDocs}`;
            logAction(user, 'bulk_doc_import', 'system', 1, logMsg);
            
            return { success: true, data: { successfulDocs, failedDocs } };
        } catch (error) {
            console.error('Bulk document import CRITICAL failure:', error);
            return { success: false, error: error.message };
        }
    });
// ===================================================
 function registerAuditHandlers() {
  const db = getDatabase();

  ipcMain.handle('log-audit-event', async (event, payload) => {
    try {
      // Support multiple payload formats
      const userId = payload.userId || payload.user?.id;
      const username = payload.username || payload.user?.username || 'Unknown';
      const action = payload.action;
      const candidateId = payload.candidateId;
      
      // Determine target type and ID
      const targetType = payload.target_type || 
                        payload.table || 
                        (candidateId ? 'candidates' : 'system');
      
      const targetId = payload.target_id || 
                      payload.rowId || 
                      candidateId || 
                      null;
      
      const details = payload.details || 
                     payload.description || 
                     null;

      // Validation
      if (!userId) {
        console.warn('Audit Log: User ID missing');
        return { success: false, error: 'User ID required' };
      }

      if (!action) {
        console.warn('Audit Log: Action missing');
        return { success: false, error: 'Action required' };
      }

      // Insert into YOUR actual table structure
      return await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO audit_log (user_id, username, action, target_type, target_id, details, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [userId, username, action, targetType, targetId, details],
          (err) => {
            if (err) {
              console.error("Audit Log insert error:", err);
              return resolve({ success: false, error: err.message });
            }
            console.log(`✅ Audit logged: ${action} by user ${userId}`);
            resolve({ success: true });
          }
        );
      });
    } catch (error) {
      console.error('Audit Log handler error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Audit log handler registered');
}


   ipcMain.handle("get-system-audit-log", async (event, { userFilter, actionFilter, limit, offset }) => {
    try {
        // Get user from stored session (you should have currentAuthUser available)
        if (!currentAuthUser) {
            return { success: false, error: "Authentication required." };
        }
        
        // Check if user is admin or super_admin
        const normalizedRole = currentAuthUser.role?.toLowerCase().replace('_', '');
        if (!['admin', 'superadmin'].includes(normalizedRole)) {
            return {
                success: false,
                error: `Access Denied: Only admins can access audit logs. Your role: ${currentAuthUser.role}`
            };
        }
        
        // Call the queries function
        return await queries.getSystemAuditLog({
            userFilter: userFilter || '',
            actionFilter: actionFilter || '',
            limit: limit || 30,
            offset: offset || 0
        });
        
    } catch (error) {
        return {
            success: false,
            error: error.message || "Failed to fetch audit logs"
        };
    }
});

// ====================================================================
    ipcMain.handle('get-audit-log-for-candidate', (event, { candidateId }) => {
        return queries.getAuditLogForCandidate(candidateId);
    });
// ====================================================================
    ipcMain.handle('save-candidate-multi', async (event, { user, textData, files }) => {
        // 1. Create candidate (this now includes duplicate checks)
        const createResult = await queries.createCandidate(textData);
        if (!createResult.success) {
            return createResult; // Return the error (e.g., "Passport exists")
        }
        
        const candidateId = createResult.id;
 
        logAction(user, 'create_candidate', 'candidates', candidateId, `Name: ${textData.name}`);

        // 2. Handle file uploads (this part stays in handlers.cjs)
        try {
            const filesDir = path.join(app.getPath('userData'), 'candidate_files');
            if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

            if (files && files.length > 0) {
          
            const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
            const fileOperations = files.map((file) => {
                    const uniqueName = `${uuidv4()}${path.extname(file.name)}`;
                    const newFilePath = path.join(filesDir, uniqueName);
                    fs.writeFileSync(newFilePath, Buffer.from(file.buffer));
                    
       
                    return new Promise((resolve, reject) => {
                        db.run(
                            sqlDoc,
                            [candidateId, file.type, file.name, newFilePath, 'Uncategorized'],
                            function (err) {
                                if (err) reject(err);
                                else {
 
                                    logAction(user, 'add_document', 'candidates', candidateId, `File: ${file.name}`);
                                    resolve();
                        
                                }
                            }
                        );
                    });
                });
            await Promise.all(fileOperations);
            }
            return { success: true, id: candidateId };
        } catch (error) {
            console.error('Failed to save candidate files:', error);
            return { success: false, error: error.message };
        }
    });
// ====================================================================
    // --- Candidate Search and Listing (Local SQLite Version) ---
    ipcMain.handle('search-candidates', (event, args) => {
        // Extract parameters from the object
        const { searchTerm, status, position, limit, offset } = args;
        return queries.searchCandidates(searchTerm, status, position, limit, offset);
    });
// ====================================================================
    ipcMain.handle('get-candidate-details', (event, { id }) => {
        // 🐞 Audit Log Injection
       // logAction(getEventUserContext(event), 'view_candidate_details', 'candidates', id, `Viewed candidate ID: ${id}`);
        return queries.getCandidateDetails(id);
    });
// ====================================================================
   ipcMain.handle('update-candidate-text', async (event, { user, id, data }) => {
    // 🐞 FIX: Ensure user is passed to the query function's signature
    const result = await queries.updateCandidateText(user, id, data); 
    if (result.success) {
        logAction(user, 'update_candidate', 'candidates', id, `Name: ${data.name}, Status: ${data.status}`);
    }
    return result;
    });
// ====================================================================
    ipcMain.handle('delete-candidate', async (event, { user, id }) => {
        const result = await queries.deleteCandidate(id);
        if (result.success) {
            logAction(user, 'delete_candidate', 'candidates', id);
        }
        return result;
    });
// ====================================================================
    // [UPDATED] Async File Writing
ipcMain.handle('add-documents', async (event, { user, candidateId, files }) => {
    try {
        const filesDir = path.join(app.getPath('userData'), 'candidate_files');
        if (!files || files.length === 0) return { success: false, error: 'No files provided.' };

        const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
        
        // Use Promise.all 
        const fileOperations = files.map(async (file) => { // marked async
            const uniqueName = `${uuidv4()}${path.extname(file.name)}`;
            const newFilePath = path.join(filesDir, uniqueName);
            const category = file.category || 'Uncategorized';

            // FIX: Non-blocking write
            await fs.promises.writeFile(newFilePath, Buffer.from(file.buffer));

   
            return new Promise((resolve, reject) => {
                db.run(sqlDoc, [candidateId, file.type, file.name, newFilePath, category], function (err) {
                    if (err) reject(err);
                    else {
                        logAction(user, 'add_document', 'candidates', candidateId, `File: ${file.name}`);
                        resolve({ id: this.lastID, fileName: file.name, filePath: newFilePath, fileType: file.type, category });
                    }
                });
            });
        });
        const newDocs = await Promise.all(fileOperations);
        return { success: true, newDocs };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
// ====================================================================
    ipcMain.handle('update-document-category', async (event, { user, docId, category }) => {
        const result = await queries.updateDocumentCategory(docId, category);
        if (result.success) {
            logAction(user, 'update_doc_category', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, File: ${result.fileName}, New Category: ${category}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('open-file-externally', async (event, { path }) => {
        if (path && fs.existsSync(path)) {
            shell.openPath(path);
            return { success: true };
        }
        return { success: false, error: 'File not found.' };
    });
// ====================================================================
ipcMain.handle('getImageBase64', (event, { filePath }) => {
        if (!filePath || !fs.existsSync(filePath)) {
            return { success: false, error: 'Image file not found.' };
        }
        try {
            const data = fs.readFileSync(filePath, { encoding: 'base64' });
            const fileType = path.extname(filePath).toLowerCase();
         
            let mimeType = 'image/jpeg'; 

            if (fileType === '.png') mimeType = 'image/png';
            else if (fileType === '.gif') mimeType = 'image/gif';
            
            return { success: true, data: `data:${mimeType};base64,${data}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });
// ====================================================================
    ipcMain.handle('get-document-base64', async (event, { filePath }) => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, { encoding: 'base64' });
                const fileType = path.extname(filePath).toLowerCase();
                let mimeType = 'application/octet-stream';

  
                if (fileType === '.pdf') mimeType = 'application/pdf';
                else if (['.png', '.jpg', '.jpeg', '.gif'].includes(fileType))
                    mimeType = `image/${fileType.substring(1)}`;

                
                return { success: true, data: `data:${mimeType};base64,${data}` };
                
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
        return { success: false, error: 'File not found.' };
    });
// ====================================================================
    // 5. EMPLOYER MANAGEMENT (REFACTORED)
    // ====================================================================

    ipcMain.handle('get-employers', (event) => {
        return queries.getEmployers();
    });
// ====================================================================
    ipcMain.handle('add-employer', async (event, { user, data }) => {
        const result = await queries.addEmployer(user, data);
        if (result.success) {
            logAction(user, 'create_employer', 'employers', result.id, `Name: ${data.companyName}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('update-employer', async (event, { user, id, data }) => {
        const result = await queries.updateEmployer(user, id, data);
        if (result.success) {
            logAction(user, 'update_employer', 'employers', id, `Name: ${data.companyName}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('delete-employer', async (event, { user, id }) => {
        const result = await queries.deleteEmployer(user, id);
        if (result.success) {
            logAction(user, 'delete_employer', 'employers', id);
        }
        return result;
    });
// ====================================================================
    // 6. JOB ORDER MANAGEMENT (REFACTORED)
    // ====================================================================

    ipcMain.handle('get-job-orders', (event) => {
        return queries.getJobOrders();
    });
// ====================================================================
    ipcMain.handle('add-job-order', async (event, { user, data }) => {
        const result = await queries.addJobOrder(user, data);
        if (result.success) {
            logAction(user, 'create_job', 'job_orders', result.id, `Position: ${data.positionTitle}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('update-job-order', async (event, { user, id, data }) => {
        const result = await queries.updateJobOrder(user, id, data);
        if (result.success) {
            logAction(user, 'update_job', 'job_orders', id, `Position: ${data.positionTitle}, Status: ${data.status}`);
        }
        return result;
    });
// ====================================================================
    ipcMain.handle('delete-job-order', async (event, { user, id }) => {
        const result = await queries.deleteJobOrder(user, id);
        if (result.success) {
            logAction(user, 'delete_job', 'job_orders', id);
        }
        return result;
    });
// ====================================================================
    // 7. PLACEMENT & SUB-MODULES (REFACTORED)
    // ====================================================================

    ipcMain.handle('get-candidate-placements', (event, { candidateId }) => {
        return queries.getCandidatePlacements(candidateId);
    });
    ipcMain.handle('get-unassigned-jobs', (event, { candidateId }) => {
        return queries.getUnassignedJobs(candidateId);
    });
    ipcMain.handle('assign-candidate-to-job', async (event, { user, candidateId, jobId }) => {
        const result = await queries.assignCandidateToJob(candidateId, jobId);
        if (result.success) {
            logAction(user, 'assign_job', 'candidates', candidateId, `Candidate: ${candidateId}, Job ID: ${jobId}`);
        }
        return result;
    });
    ipcMain.handle('remove-candidate-from-job', async (event, { user, placementId }) => {
        const result = await queries.removeCandidateFromJob(placementId);
        if (result.success) {
            logAction(user, 'remove_placement', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Job ID: ${result.jobId}`);
        }
        return result;
    });
// ====================================================================
    // 8. SUB-MODULES (REFACTORED)
    // ====================================================================

   
    ipcMain.handle('add-passport-entry', async (event, { user, data }) => {
        const result = await queries.addPassportEntry(data);
        if (result.success) {
            logAction(user, 'add_passport_entry', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Status: ${data.passport_status}, Docket: ${data.docket_number}`);
        }
        return result;
    });
// ===================================================
    ipcMain.handle('get-visa-tracking', (event, { candidateId }) => {
        return queries.getVisaTracking(candidateId);
    });
    ipcMain.handle('add-visa-entry', async (event, { user, data }) => {
        const result = await queries.addVisaEntry(data);
        if (result.success) {
            logAction(user, 'add_visa', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Country: ${data.country}, Status: ${data.status}`);
        }
        return result;
    });
    // --- NEW: Update Visa Entry Handler ---
    ipcMain.handle('update-visa-entry', async (event, { user, id, data }) => {
        const result = await queries.updateVisaEntry(id, data);
        if (result.success) {
            logAction(user, 'update_visa', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Country: ${data.country}, Status: ${data.status}`);
        }
        return result;
    });
    ipcMain.handle('delete-visa-entry', async (event, { user, id }) => {
        const result = await queries.deleteVisaEntry(id);
        if (result.success) {
            logAction(user, 'delete_visa', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Country: ${result.country}`);
        }
        return result;
    });
// --- Medical Tracking ---
    ipcMain.handle('get-medical-tracking', (event, { candidateId }) => {
        return queries.getMedicalTracking(candidateId);
    });
    ipcMain.handle('add-medical-entry', async (event, { user, data }) => {
        const result = await queries.addMedicalEntry(data);
        if(result.success) {
            logAction(user, 'add_medical', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.test_date}, Status: ${data.status}`);
        }
        return result;
    });
// --- NEW: Update Medical Entry Handler ---
    ipcMain.handle('update-medical-entry', async (event, { user, id, data }) => {
        const result = await queries.updateMedicalEntry(id, data);
        if(result.success) {
            logAction(user, 'update_medical', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.test_date}, Status: ${data.status}`);
        }
        return result;
    });
    ipcMain.handle('delete-medical-entry', async (event, { user, id }) => {
        const result = await queries.deleteMedicalEntry(id);
        if(result.success) {
            logAction(user, 'delete_medical', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.test_date}, Status: ${result.status}`);
        }
        return result;
    });
// --- Travel Tracking ---
    ipcMain.handle('get-travel-tracking', (event, { candidateId }) => {
        return queries.getTravelTracking(candidateId);
    });
    ipcMain.handle('add-travel-entry', async (event, { user, data }) => {
        const result = await queries.addTravelEntry(data);
        if(result.success) {
            logAction(user, 'add_travel', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`);
        }
        return result;
    });
// --- NEW: Update Travel Entry Handler ---
    ipcMain.handle('update-travel-entry', async (event, { user, id, data }) => {
        const result = await queries.updateTravelEntry(id, data);
        if(result.success) {
            logAction(user, 'update_travel', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.travel_date}, Route: ${data.departure_city} to ${data.arrival_city}`);
        }
        return result;
    });
    ipcMain.handle('delete-travel-entry', async (event, { user, id }) => {
        const result = await queries.deleteTravelEntry(id);
        if(result.success) {
            logAction(user, 'delete_travel', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.travel_date}`);
        }
        return result;
    });
// --- Interview Tracking ---
    ipcMain.handle('get-interview-tracking', (event, { candidateId }) => {
        return queries.getInterviewTracking(candidateId);
    });
    ipcMain.handle('add-interview-entry', async (event, { user, data }) => {
        const result = await queries.addInterviewEntry(data);
        if(result.success) {
            logAction(user, 'add_interview', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`);
        }
        return result;
    });
// --- NEW: Update Interview Entry Handler ---
    ipcMain.handle('update-interview-entry', async (event, { user, id, data }) => {
        const result = await queries.updateInterviewEntry(id, data);
        if(result.success) {
            logAction(user, 'update_interview', 'candidates', data.candidate_id, `Candidate: ${data.candidate_id}, Date: ${data.interview_date}, Round: ${data.round}, Status: ${data.status}`);
        }
        return result;
    });
    ipcMain.handle('delete-interview-entry', async (event, { user, id }) => {
        const result = await queries.deleteInterviewEntry(id);
        if(result.success) {
            logAction(user, 'delete_interview', 'candidates', result.candidateId, `Candidate: ${result.candidateId}, Date: ${result.interview_date}, Round: ${result.round}`);
        }
        return result;
    });
// ====================================================================
    // 9. FINANCIAL TRACKING (REFACTORED)
    // ====================================================================

    ipcMain.handle('get-candidate-payments', (event, { candidateId }) => {
        // 🐞 Audit Log Injection
        logAction(getEventUserContext(event), 'view_candidate_finance', 'candidates', candidateId, `Viewed financials for candidate ID: ${candidateId}`);
        return queries.getCandidatePayments(candidateId);
    });
    ipcMain.handle('add-payment', async (event, { user, data }) => {
  try {
    // 🔐 Admin & SuperAdmin only
    guard(user).enforce(FEATURES.BILLING);

    if (user.role === 'staff') {
      return { success: false, error: 'Access Denied: Staff cannot add payments.' };
    }

    const result = await queries.addPayment(user, data);

    if (result.success) {
      logAction(
        user,
        'add_payment',
        'candidates',
        data.candidate_id,
        `Amount: ${data.amount_paid}, Status: ${data.status}`
      );
    }

    return result;
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});


ipcMain.handle('update-payment', async (event, { user, id, amount_paid, status }) => {
  try {
    // 🔐 Admin & SuperAdmin only
    guard(user).enforce(FEATURES.BILLING);

    if (user.role === 'staff') {
      return { success: false, error: 'Access Denied: Staff cannot modify payments.' };
    }

    const updateData = { user, id, amount_paid, status };
    const result = await queries.updatePayment(updateData);

    if (result.success) {
      logAction(
        user,
        'update_payment',
        'candidates',
        result.candidateId,
        `Amount: ${amount_paid}, Status: ${status}`
      );
    }

    return result;
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});

ipcMain.handle('delete-payment', async (event, { user, id }) => {
  try {
    // 🔐 SuperAdmin only (destructive)
    guard(user).enforce(FEATURES.BILLING);

    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

    const result = await queries.deletePayment(user, id);

    if (result.success) {
      logAction(
        user,
        'delete_payment',
        'candidates',
        result.candidateId,
        `Deleted payment ID: ${id}`
      );
    }

    return result;
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});


// ====================================================================
// 10. RECYCLE BIN MANAGEMENT (COMPLETE)
// ====================================================================

// --- CANDIDATES ---
ipcMain.handle('get-deleted-candidates', () => {
  return queries.getDeletedCandidates();
});
ipcMain.handle('restore-candidate', async (event, { user, id }) => {
  const result = await queries.restoreCandidate(id);
  if (result.success) {
    logAction(user, 'restore_candidate', 'candidates', id);
  }
  return result;
});

// --- EMPLOYERS ---
ipcMain.handle('get-deleted-employers', () => {
  return queries.getDeletedEmployers();
});
ipcMain.handle('restore-employer', async (event, { user, id }) => {
  const result = await queries.restoreEmployer(id);
  if (result.success) {
    logAction(user, 'restore_employer', 'employers', id);
  }
  return result;
});

// --- JOB ORDERS ---
ipcMain.handle('get-deleted-job-orders', () => {
  return queries.getDeletedJobOrders();
});
ipcMain.handle('restore-job-order', async (event, { user, id }) => {
  const result = await queries.restoreJobOrder(id);
  if (result.success) {
    logAction(user, 'restore_job', 'job_orders', id);
  }
  return result;
});

// --- PLACEMENTS ---
ipcMain.handle('get-deleted-placements', () => {
  return queries.getDeletedPlacements();
});
ipcMain.handle('restore-placement', async (event, { user, id }) => {
  const result = await queries.restorePlacement(id);
  if (result.success) {
    logAction(user, 'restore_placement', 'placements', id);
  }
  return result;
});

// --- PASSPORTS ---
ipcMain.handle('get-deleted-passports', () => {
  return queries.getDeletedPassports();
});
ipcMain.handle('restore-passport', async (event, { user, id }) => {
  const result = await queries.restorePassport(id);
  if (result.success) {
    logAction(user, 'restore_passport', 'passport_tracking', id);
  }
  return result;
});

// --- VISAS ---
ipcMain.handle('get-deleted-visas', () => {
  return queries.getDeletedVisas();
});
ipcMain.handle('restore-visa', async (event, { user, id }) => {
  const result = await queries.restoreVisa(id);
  if (result.success) {
    logAction(user, 'restore_visa', 'visa_tracking', id);
  }
  return result;
});

// --- MEDICAL ---
ipcMain.handle('get-deleted-medical', () => {
  return queries.getDeletedMedical();
});
ipcMain.handle('restore-medical', async (event, { user, id }) => {
  const result = await queries.restoreMedical(id);
  if (result.success) {
    logAction(user, 'restore_medical', 'medical_tracking', id);
  }
  return result;
});

// --- INTERVIEWS ---
ipcMain.handle('get-deleted-interviews', () => {
  return queries.getDeletedInterviews();
});
ipcMain.handle('restore-interview', async (event, { user, id }) => {
  const result = await queries.restoreInterview(id);
  if (result.success) {
    logAction(user, 'restore_interview', 'interview_tracking', id);
  }
  return result;
});

// --- TRAVEL ---
ipcMain.handle('get-deleted-travel', () => {
  return queries.getDeletedTravel();
});
ipcMain.handle('restore-travel', async (event, { user, id }) => {
  const result = await queries.restoreTravel(id);
  if (result.success) {
    logAction(user, 'restore_travel', 'travel_tracking', id);
  }
  return result;
});

// --- PERMANENT DELETION (SUPER ADMIN ONLY) ---
ipcMain.handle('delete-permanently', async (event, { user, id, targetType }) => {
  try {
    // 🔐 SuperAdmin only
    guard(user).enforce(FEATURES.SETTINGS);
    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

    const db = getDatabase();
    let tableName;

    switch (targetType) {
      case 'required_doc':
      case 'required_docs':
        tableName = 'required_documents'; break;
      case 'candidate':
      case 'candidates':
        tableName = 'candidates'; break;
      case 'employer':
      case 'employers':
        tableName = 'employers'; break;
      case 'job':
      case 'jobs':
      case 'job_orders':
        tableName = 'job_orders'; break;
      case 'placement':
      case 'placements':
        tableName = 'placements'; break;
      case 'passport':
      case 'passports':
        tableName = 'passport_tracking'; break;
      case 'visa':
      case 'visas':
        tableName = 'visa_tracking'; break;
      case 'medical':
      case 'medical_records':
        tableName = 'medical_tracking'; break;
      case 'interview':
      case 'interviews':
        tableName = 'interview_tracking'; break;
      case 'travel':
      case 'travels':
        tableName = 'travel_tracking'; break;
      default:
        return { success: false, error: `Unknown target type: ${targetType}` };
    }

    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    logAction(user, 'permanent_delete', tableName, id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});



// ====================================================================
    // 11. FILE-SYSTEM HANDLERS (Utility, ZIP, PDF, Import)
    // ====================================================================
ipcMain.handle('read-offer-template', async (event, { user } = {}) => {
  try {
    // 🔐 Admin & SuperAdmin can read
    guard(user).enforce(FEATURES.SETTINGS);

    const templatePath = path.join(
      app.getAppPath(),
      'src-electron',
      'templates',
      'offer_letter_template.ejs'
    );

    if (!fs.existsSync(templatePath)) {
      return { success: false, error: 'Template file not found.' };
    }

    const content = fs.readFileSync(templatePath, 'utf-8');
    return { success: true, data: content };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});

   ipcMain.handle('write-offer-template', async (event, { user, content }) => {
  try {
    // 🔐 SuperAdmin only
    guard(user).enforce(FEATURES.SETTINGS);

    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

    const templatePath = path.join(
      app.getAppPath(),
      'src-electron',
      'templates',
      'offer_letter_template.ejs'
    );

    fs.writeFileSync(templatePath, content);
    logAction(user, 'update_offer_template', 'settings', 1);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});

// ===================================================

    // --- Utility to Print/Save as PDF ---
    ipcMain.handle('print-to-pdf', async (event, url) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
        try {
            await printWindow.loadURL(url);
            const date = new Date().toISOString().slice(0, 10);
       
            const defaultFileName = `Candidate_Offer_Letter_${date}.pdf`;
            const saveDialogResult = await dialog.showSaveDialog(win, {
                
                title: 'Save Generated Offer Letter as PDF',
                defaultPath: defaultFileName,
                filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
            });
            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                printWindow.close();
                return { success: false, error: 'User cancelled save operation.' };
            }
            const pdfBuffer = await printWindow.webContents.printToPDF({
                margins: { default: 'default' },
                landscape: false,
                printBackground: true,
            });
            fs.writeFileSync(saveDialogResult.filePath, pdfBuffer);
            printWindow.close();
            return { success: true, filePath: saveDialogResult.filePath };
        } catch (error) {
            console.error("PDF Generation Error:", error);
            if (printWindow) printWindow.close();
            return { success: false, error: `PDF generation failed: ${error.message}` };
        }
    });
// --- NEW: Read Absolute File Buffer Handler ---
ipcMain.handle('readAbsoluteFileBuffer', async (event, { filePath }) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: 'File not found on disk.' };
    }
    try {
        const buffer = fs.readFileSync(filePath);
        return { 
            success: true, 
            buffer: buffer,
            type: mime.getType(filePath) || (path.extname(filePath) === '.pdf' ? 'application/pdf' : 'application/octet-stream')
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
// --- Document ZIP Export ---
    ipcMain.handle('zip-candidate-documents', async (event, { user, candidateId, destinationPath }) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT fileName, filePath FROM documents WHERE candidate_id = ? AND isDeleted = 0',
                [candidateId],
             
            (err, docs) => {
                    if (err) return resolve({ success: false, error: 'Database error fetching documents.' });
                    
                    if (docs.length === 0) return resolve({ success: false, error: 'No active documents found to export.' });

        
             
                    const output = fs.createWriteStream(destinationPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });

                    output.on('close', function() {
             
                        logAction(user, 'export_documents_zip', 'candidates', candidateId, `Candidate: ${candidateId}`);
                        resolve({ success: true, filePath: destinationPath });
                    });
                    output.on('end', () => console.log('Data has been drained'));
                    archive.on('warning', (err) => {
                        if (err.code !== 'ENOENT') console.warn('Archiver warning:', err);
                    });
                    archive.on('error', (err) => {
                        console.error('Archiver error:', err);
                        resolve({ success: false, error: `Archiver failed: ${err.message}` });
                    });
                    archive.pipe(output);
                    docs.forEach(doc => {
                        if (fs.existsSync(doc.filePath)) {
                            archive.file(doc.filePath, { name: doc.fileName });
                        } else {
             
                            console.warn(`Missing physical file: ${doc.filePath}`);
                        }
                    });
                    archive.finalize();
                }
            );
        });
    });
// --- Offer Letter Generation ---
    ipcMain.handle('generate-offer-letter', async (event, { user, candidateId, jobId, templateData }) => {
        // --- THIS IS THE FIX: Await the database read to prevent the locked error ---
        const row = await queries.dbGet(db, `
            SELECT
              c.name AS candidateName, c.passportNo, c.contact, c.aadhar, c.education,
             
             j.positionTitle, j.requirements,
              e.companyName, e.contactPerson, e.contactEmail, e.country AS employerCountry
            
            FROM candidates c
            JOIN placements p ON p.candidate_id = c.id
            JOIN job_orders j ON j.id = p.job_order_id
            JOIN employers e ON e.id = j.employer_id
            WHERE c.id = ? AND j.id = ? AND c.isDeleted = 0
            LIMIT 1
            `, [candidateId, jobId]);
        
        if (!row) {
            
            return { success: false, error: 'Failed to fetch candidate/job data. (Not assigned or candidate deleted)' };
        }

        try {
            const today = new Date().toISOString().slice(0, 10);
            const data = { ...row, ...templateData, currentDate: today };

            const templatePath = path.join(app.getAppPath(), 'src-electron', 'templates', 'offer_letter_template.ejs');
            let template = fs.readFileSync(templatePath, 'utf-8');
            const htmlContent = ejs.render(template, data);
// Using os.tmpdir() and uuid for robust temp file creation
            const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.html`);
            fs.writeFileSync(tempFilePath, htmlContent);
            logAction(user, 'generate_offer_letter', 'candidates', candidateId, `Candidate: ${candidateId}, Job ID: ${jobId}`);
            return { 
                success: true, 
                tempPath: tempFilePath,
                candidateName: row.candidateName,
                position: row.positionTitle
            };
        } catch (error) {
            console.error("Offer Letter generation failed:", error);
            return { success: false, error: error.message };
        }
    });
// --- BULK IMPORT ---

    ipcMain.handle('get-csv-headers', async (event, { filePath }) => {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                return resolve({ success: false, error: 'File not found.' });
            }
            
          
            
            const headers = [];
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('headers', (hdr) => {
                
                headers.push(...hdr);
    
            
            })
                .on('data', () => {})
                .on('end', () => {
                    if(headers.length > 0) {
               
                        resolve({ success: true, headers: headers });
            
                    } else {
                        resolve({ success: false, error: 'Could not read headers from CSV.' 
            });
      
                    }
                })
      
            .on('error', (err) => {
                    resolve({ success: false, error: err.message });
            });
        });
    });
    
    ipcMain.handle('import-candidates-from-file', async (event, { user, filePath, mapping }) => {
        const db = getDatabase();
        const rows = [];
        const results = { successfulCount: 0, failedCount: 0, failures: [] };
        const requiredDbColumn = 'passportNo';

        const invertedMap = {};
        for (const csvHeader in mapping) {
            const dbColumn = mapping[csvHeader];
            if (dbColumn) invertedMap[dbColumn] = csvHeader;
        }

        if (!invertedMap[requiredDbColumn]) {
            return { success: false, error: `Required column "${requiredDbColumn}" was not mapped.` };
        }

        try {
            
            
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => rows.push(row))
                    .on('end', () => resolve())
             
            
            .on('error', (err) => reject(err));
            });
        } catch (err) {
            
            return { success: false, error: `Error reading CSV: ${err.message}` };
        }

        await queries.dbRun(db, 'BEGIN TRANSACTION', []);
        for (const [index, row] of rows.entries()) {
            const rowNum = index + 2;
            const dbRow = {
                name: row[invertedMap['name']] || null,
                education: row[invertedMap['education']] || null,
                experience: row[invertedMap['experience']] || null,
                dob: row[invertedMap['dob']] || null,
                passportNo: row[invertedMap['passportNo']] || null,
                passportExpiry: row[invertedMap['passportExpiry']] || null,
                contact: row[invertedMap['contact']] || null,
                aadhar: row[invertedMap['aadhar']] || null,
                status: row[invertedMap['status']] || 'New',
                notes: row[invertedMap['notes']] || null,
                Position: row[invertedMap['Position']] || null,
            };
            try {
                const createResult = await queries.createCandidate(dbRow);
                if (createResult.success) {
                    logAction(user, 'bulk_import_create', 'candidates', createResult.id, `Name: ${dbRow.name}, Passport: ${dbRow.passportNo}`);
                    results.successfulCount++;
                } else {
                    results.failedCount++;
// --- MODIFIED: Handle structured errors (createResult.errors) or generic error ---
                    const reason = createResult.errors 
                        ? `Row ${rowNum}: Validation failed on fields: ${Object.keys(createResult.errors).join(', ')}`
                        : `Row ${rowNum}: ${createResult.error}`;
                    results.failures.push({ data: row, reason: reason });
                }
            } catch (err) {
                results.failedCount++;
                results.failures.push({ data: row, reason: `Row ${rowNum}: ${err.message}` });
            }
        }

        await queries.dbRun(db, 'COMMIT', []);
        logAction(user, 'bulk_import_complete', 'system', 1, `Success: ${results.successfulCount}, Failed: ${results.failedCount}`);
        return { success: true, data: results };
    });

    ipcMain.handle('get-excel-sheets', async (event, { filePath }) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found.' };
            }
            const workbook = XLSX.readFile(filePath);
            return { success: true, sheets: workbook.SheetNames };
 
 
        } catch (err) {
            return { success: false, error: `Failed to read Excel file: ${err.message}` };
        }
    });
    ipcMain.handle('get-excel-headers', async (event, { filePath, sheetName }) => {
        try {
            const workbook = XLSX.readFile(filePath);
            if (!workbook.SheetNames.includes(sheetName)) {
                return { success: false, error: 'Sheet name not found in file.' };
            }
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (rows.length === 0) {
                
                return { success: false, error: 'Sheet is empty.' };
            }
 
            
            const headers = rows[0];
            return { success: true, headers: headers };
        } catch (err) {
            return { success: false, error: `Failed to read headers: ${err.message}` };
        }
    });
    ipcMain.handle('import-candidates-from-excel', async (event, { user, filePath, sheetName, mapping }) => {
        const db = getDatabase();
        const results = { successfulCount: 0, failedCount: 0, failures: [] };
        const requiredDbColumn = 'passportNo';

        const invertedMap = {};
        for (const csvHeader in mapping) {
            const dbColumn = mapping[csvHeader];
            if (dbColumn) invertedMap[dbColumn] = csvHeader;
        }

        if (!invertedMap[requiredDbColumn]) {
            return { success: false, error: `Required column "${requiredDbColumn}" was not mapped.` 
            };
        }

        let rows = [];
        try {
            const workbook = XLSX.readFile(filePath);
            const worksheet = workbook.Sheets[sheetName];
            rows = XLSX.utils.sheet_to_json(worksheet);
        } catch (err) {
            return { success: false, error: `Error reading Excel: ${err.message}` };
        }

        await queries.dbRun(db, 'BEGIN TRANSACTION', []);
        for (const [index, row] of rows.entries()) {
            const rowNum = index + 2;
            const dbRow = {
                name: row[invertedMap['name']] || null,
                education: row[invertedMap['education']] || null,
                experience: row[invertedMap['experience']] || null,
                dob: parseExcelDate(row[invertedMap['dob']]),
                passportNo: row[invertedMap['passportNo']] || null,
                passportExpiry: parseExcelDate(row[invertedMap['passportExpiry']]),
                contact: row[invertedMap['contact']] || null,
                aadhar: row[invertedMap['aadhar']] || null,
                status: row[invertedMap['status']] || 'New',
                notes: row[invertedMap['notes']] || null,
                Position: row[invertedMap['Position']] || null,
            };
            try {
                const createResult = await queries.createCandidate(dbRow);
                if (createResult.success) {
                    logAction(user, 'bulk_import_create', 'candidates', createResult.id, `Name: ${dbRow.name}, Passport: ${dbRow.passportNo}`);
                    results.successfulCount++;
                } else {
                    results.failedCount++;
// --- MODIFIED: Handle structured errors (createResult.errors) or generic error ---
                    const reason = createResult.errors 
                        ? `Row ${rowNum}: Validation failed on fields: ${Object.keys(createResult.errors).join(', ')}`
                        : `Row ${rowNum}: ${createResult.error}`;
                    results.failures.push({ data: row, reason: reason });
                }
            } catch (err) {
                results.failedCount++;
                results.failures.push({ data: row, reason: `Row ${rowNum}: ${err.message}` });
            }
        }

        await queries.dbRun(db, 'COMMIT', []);
        logAction(user, 'bulk_import_complete', 'system', 1, `(Excel) Success: ${results.successfulCount}, Failed: ${results.failedCount}`);
        return { success: true, data: results };
    });
    ipcMain.handle('download-excel-template', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);

        const headers = [
            'name', 'passportNo', 'Position', 'contact', 'aadhar', 'education',
            'experience', 'dob', 'passportExpiry', 'status', 'notes'
        ];

        try {
            const saveDialogResult = await dialog.showSaveDialog(win, {
       
            
                title: 'Save Excel Import Template',
                defaultPath: 'candidate_import_template.xlsx',
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            });

            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
       
            
                return { success: false, error: 'User cancelled save.' };
            }

            const filePath = saveDialogResult.filePath;

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([headers]); 
            XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
            XLSX.writeFile(wb, filePath);

            return { success: true, filePath: filePath };
        } catch (err) {
            console.error('Failed to create template:', err);
            return { success: false, error: err.message };
        }
    });
// --- NEW: Download Import Errors ---
    ipcMain.handle('download-import-errors', async (event, { user, failedRows }) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        
        // 1. Re-format data for Excel (data first, then reason)
        if (!failedRows || failedRows.length === 0) {
            return { success: false, error: 'No failed rows to export.' };
        }

  
        
        const headers = Object.keys(failedRows[0].data);
        headers.push("__ERROR_REASON__"); // Add error header

        const dataToExport = failedRows.map(fail => {
            return {
                ...fail.data,
                "__ERROR_REASON__": fail.reason 
            };
     
        });

        try {
            const saveDialogResult = await dialog.showSaveDialog(win, {
                title: 'Save Import Error Report',
                defaultPath: 'import_error_report.xlsx',
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
           
            });
            if (saveDialogResult.canceled || !saveDialogResult.filePath) {
                return { success: false, error: 'User cancelled save.' };
            }

            const filePath = saveDialogResult.filePath;
            const wb = XLSX.utils.book_new();
            // Create worksheet from an array of objects
            const ws = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
            XLSX.utils.book_append_sheet(wb, ws, 'Failed Rows');
            XLSX.writeFile(wb, filePath);

            logAction(user, 'export_import_errors', 'system', 1, `Exported ${failedRows.length} failed rows`);
            return { success: true, filePath: filePath };
        } catch (err) {
            console.error('Failed to create error report:', err);
            return { success: false, error: err.message };
        }
    });
} 

// ====================================================================
// 12. EMAIL AUTOMATION
// ====================================================================

// === NEW: GET EMAIL SETTINGS ===
ipcMain.handle('get-smtp-settings', async (event) => {
    // ✅ FIX: Remove role check - allow all authenticated users to view settings
    try {
        const db = getDatabase();
        const row = await queries.dbGet(db, "SELECT value FROM system_settings WHERE key = 'smtp_config'", []);
        
        if (row && row.value) {
            return { success: true, config: JSON.parse(row.value) };
        }
        // Return empty config if none exists yet
        return { success: true, config: null };
    } catch (err) {
        console.error('get-smtp-settings error:', err);
        return { success: false, error: err.message };
    }
});


    ipcMain.handle('get-admin-assigned-features', async (event, { userId }) => {
    try {
      const features = await getAdminAssignedFeatures(userId);
      return { success: true, features };
    } catch (err) {
      console.error('get-admin-assigned-features failed:', err);
      return { success: false, error: err.message };
    }
  });

    ipcMain.handle('send-email', async (event, { user, to, subject, body, attachments }) => {
    try {
        await sendEmail({ to, subject, html: body, attachments });
        // Log the action
        // logAction(user, 'sent_email', 'system', 0, `To: ${to}, Subject: ${subject}`);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
// ====================================================================
// 13. INTELLIGENCE (OCR & PARSING)
// ====================================================================

ipcMain.handle('get-machine-id', async () => {
  const machineId = os.hostname().toUpperCase() +
    '-' +
    os.type().substring(0, 3) +
    '-' +
    ip.address().split('.').slice(2).join('.');
  return { success: true, machineId };
});

// -------- LICENSE / ACTIVATION IPC --------

ipcMain.handle('get-activation-status', async () => {
  const db = getDatabase();

  return new Promise((resolve) => {
    db.get(
      "SELECT value FROM system_settings WHERE key = 'license_status'",
      [],
      (err, row) => {
        if (err) {
          console.error('getActivationStatus error:', err);
          return resolve({ success: false, data: null });
        }

        const activated = row?.value === 'activated';

        resolve({
          success: true,
          data: { activated },
        });
      }
    );
  });
});

ipcMain.handle('activate-application', async (event, code) => {
  const db = getDatabase();

  const trimmed = typeof code === 'string' ? code.trim() : '';
  if (trimmed.length !== 6) {
    return { success: false, error: 'Invalid activation code.' };
  }

  // TODO: here you can also verify code against your activations table if needed

  return new Promise((resolve) => {
    db.run(
      "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', 'activated')",
      [],
      (err) => {
        if (err) {
          console.error('activateApplication update error:', err);
          return resolve({ success: false, error: 'Failed to save license.' });
        }

        resolve({ success: true, data: { activated: true } });
      }
    );
  });
});


// -------- END LICENSE / ACTIVATION IPC --------


    const convertMRZDate = (yyMMdd) => {
        // Fix common OCR error: 'O' (letter) instead of '0' (zero)
        const clean = yyMMdd.replace(/O/g, '0');
        if (!/^\d{6}$/.test(clean)) return null;
        
        const year = parseInt(clean.substring(0, 2), 10);
        const month = clean.substring(2, 4);
        const day = clean.substring(4, 6);
// Pivot year logic: 50-99 = 1900s, 00-49 = 2000s
        const fullYear = year >= 50 ? 1900 + year : 2000 + year;
        
        return `${fullYear}-${month}-${day}`;
    };
    const parsePassportDataRobust = (rawText) => {
        if (!rawText) return null;
// 1. Aggressive Cleanup: Remove spaces and special chars, keep only Alphanumeric and <
        const cleanText = rawText.toUpperCase().replace(/[^A-Z0-9<]/g, '');
        /**
         * PASSPORT (TD3) REGEX PATTERN:
         * Group 1: Passport No (9 chars) -> [A-Z0-9<]{9}
         * Followed by: Check Digit (1) -> [\dO] (Allow 'O' error)
         * Followed by: Nationality (3) -> [A-Z<]{3}
         * Group 2: DOB (6 chars) -> [\dO]{6}
         * Followed by: Check Digit (1) -> [\dO]
    
         * Followed by: Sex (1) -> [FM<]
         * Group 3: Expiry (6 chars) -> [\dO]{6}
         */
        const pattern = /([A-Z0-9<]{9})[\dO][A-Z<]{3}([\dO]{6})[\dO][FM<]([\dO]{6})[\dO]/;
        const match = cleanText.match(pattern);

        if (match) {
            const rawPassport = match[1].replace(/</g, '');
// Remove padding '<'
            const rawDob = match[2];
            const rawExpiry = match[3];

            return {
                documentType: 'PASSPORT',
                passportNo: rawPassport,
                dob: convertMRZDate(rawDob),
                expiry: convertMRZDate(rawExpiry),
            };
        }
        
        return null;
    };
    ipcMain.handle('ocr-scan-passport', async (event, { fileBuffer }) => { 
        if (!fileBuffer) { 
            return { success: false, error: 'No file buffer provided for OCR.' };
        }
        
        const buffer = Buffer.from(fileBuffer); 
        let worker;
        
        try {
    
// Initialize Tesseract
            const repoTessPath = path.join(__dirname, '..', '..');
            const localEng = path.join(repoTessPath, 'eng.traineddata');
            const workerOptions = {};

            if (fs.existsSync(localEng)) {
                workerOptions.langPath = repoTessPath;
          
            }

            worker = await Tesseract.createWorker('eng', undefined, workerOptions);
            
            // Run OCR
            const { data: { text } } = await worker.recognize(buffer);
            
            // Use Robust Parser
       
            const passportData = parsePassportDataRobust(text);

            if (passportData) {
                return { success: true, data: { passport: passportData, rawText: text } };
            }

            return {
                success: true, // Return success true so frontend receives the "Raw Text" even if parse failed
                data: { passport: null, rawText: text }, 
                error: 'Could not detect valid Passport Pattern (MRZ) in image.',
        
            };

        } catch (err) {
            console.error("OCR FAILED - Exception:", err);
            return { success: false, error: `OCR Engine Error: ${err.message}` };
        } finally {
            if (worker) await worker.terminate();
        }
    });

// === EMAIL SETTINGS HANDLER ===
 ipcMain.handle('save-smtp-settings', async (event, { user, config }) => {
  try {
    // 🔐 SuperAdmin only
    guard(user).enforce(FEATURES.SETTINGS);

    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

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


// === MOBILE SERVER INFO ===
    ipcMain.handle('get-server-ip', () => {
        const ip = require('ip'); // We installed this earlier
        return { ip: ip.address(), port: 3000 };
    });
    
    // ============================================================================
// COMMUNICATION LOGS HANDLERS
// ============================================================================

ipcMain.handle("logCommunication", async (event, { user, candidateId, communication_type, details }) => {
  console.log("📞 logCommunication called:", { candidateId, type: communication_type, details });
  
  if (!user?.id) {
    return { success: false, error: "User not authenticated" };
  }
  
  return queries.logCommunication({
    candidateId: parseInt(candidateId),
    userId: user.id,
    type: communication_type,
    details: details
  });
});


ipcMain.handle("getCommunicationLogs", async (event, { candidateId }) => {
  console.log("📞 getCommunicationLogs called:", { candidateId });
  
  return queries.getCommunicationLogs(parseInt(candidateId));
});


    ipcMain.handle('get-comm-logs', (event, args) => queries.getCommLogs(args.candidateId));
// --- NEW: SECURE FILE PATH LOOKUP ---
ipcMain.handle('get-secure-file-path', async (event, { documentId }) => {
    try {
        const db = getDatabase(); // Access the PG pool
        // NOTE: This assumes a trusted internal tool can access the DB for this internal file path.
        const sql = 'SELECT "filePath" FROM documents WHERE id = $1';
        const row = await dbGet(db, sql, [documentId]);
        
 
        if (row && row.filePath) {
            return { success: true, filePath: row.filePath };
        }
        return { success: false, error: 'Document ID not found or path is missing.' };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
// === PASSPORT TRACKING HANDLERS ===
    ipcMain.handle('get-passport-tracking', (event, { candidateId }) => {
        return queries.getPassportTracking(candidateId);
    });
// [NEW] Restore Handler
ipcMain.handle('restore-database', async (event, { user }) => {
    if (user.role !== 'super_admin') return { success: false, error: 'Access Denied.' };

    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
        title: 'Select Backup File',
        filters: [{ name: 'Zip Backup', extensions: ['zip'] }],
        properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' };

    
    const backupPath = result.filePaths[0];
    const userDataPath = app.getPath('userData');
    const tempRestore = path.join(os.tmpdir(), 'consultancy_restore');

    try {
        // 1. Extract to temp
        await extract(backupPath, { dir: tempRestore });

        // 2. Verify structure
        if (!fs.existsSync(path.join(tempRestore, 'consultancy.db'))) {
             return { success: false, error: 'Invalid Backup: consultancy.db missing.' };
        }

        // 3. Close DB Connection (Critical)
        // You would need a mechanism to close the global DB pool here, or force a restart.
        // For simplicity in Electron, we force a restart request.
// 4. Replace Files
        fs.copyFileSync(path.join(tempRestore, 'consultancy.db'), path.join(userDataPath, 'consultancy.db'));
        
        const filesSrc = path.join(tempRestore, 'candidate_files');
        const filesDest = path.join(userDataPath, 'candidate_files');
        
        if (fs.existsSync(filesSrc)) {
            // Recursive copy logic or use fs-extra.copySync
            // fs.cpSync(filesSrc, filesDest, { recursive: true });
// (Node 16.7+)
        }

        logAction(user, 'system_restore', 'system', 1, 'Database restored from backup.');
// 5. Relaunch App
        app.relaunch();
        app.exit(0);

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});
// --- MISSING HANDLERS ADDED BELOW ---
    ipcMain.handle('update-passport-entry', async (event, { user, id, data }) => {
        const result = await queries.updatePassportEntry(id, data); // Ensure this function exists in queries.cjs
        if (result.success) {
            logAction(user, 'update_passport_entry', 'candidates', data.candidate_id, `Updated Passport ID: ${id}`);
        }
        return result;
    });
    ipcMain.handle('delete-passport-entry', async (event, { user, id }) => {
        const result = await queries.deletePassportEntry(id); // Ensure this function exists in queries.cjs
        if (result.success) {
            logAction(user, 'delete_passport_entry', 'candidates', 0, `Deleted Passport ID: ${id}`);
        }
        return result;
    });
// ------------------------------------
ipcMain.handle('test-smtp-connection', async (event, { user, config }) => {
  try {
    // 🔐 SuperAdmin only (infrastructure check)
    guard(user).enforce(FEATURES.SETTINGS);

    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: parseInt(config.port),
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// [NEW] Helper at top of file
const parseExcelDate = (excelSerial) => {
    // Check if it's actually a number (Excel Serial Date)
    if (!isNaN(excelSerial) && excelSerial > 25569) {
        const date = new Date((excelSerial - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    }
    return excelSerial;
// Return as-is if it's already a string
};

// Add this handler
ipcMain.handle('get-user-role', async (event, { userId }) => {
    const db = getDatabase();
    try {
        const row = await queries.dbGet(db, 'SELECT role FROM users WHERE id = ?', [userId]);
        if (!row) return { success: false, error: 'User not found' };
        return { success: true, role: row.role };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// [NEW] Kanban Board Handlers
    ipcMain.handle('get-all-active-visas', async () => {
        return queries.getAllActiveVisas();
    });
    ipcMain.handle('update-visa-status', async (event, { id, status }) => {
        return queries.updateVisaStatus(id, status);
    });
    const saveDocumentFromApi = async ({ candidateId, user, fileData }) => {
    try {
        const db = getDatabase();
        const filesDir = path.join(app.getPath('userData'), 'candidate_files');
        
        // Ensure directory exists
        if (!fs.existsSync(filesDir)) {
            fs.mkdirSync(filesDir, { recursive: true });
        }

        // Generate unique filename
        const uniqueName = `${uuidv4()}${path.extname(fileData.fileName)}`;
        const newFilePath = path.join(filesDir, uniqueName);

        // Write buffer to disk (Async)
        await fs.promises.writeFile(newFilePath, fileData.buffer);
// Database Insert
        const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
        return new Promise((resolve, reject) => {
            db.run(sqlDoc, [candidateId, fileData.fileType, fileData.fileName, newFilePath, fileData.category], function (err) {
                if (err) {
                    // Try to clean up file if DB insert fails
                    fs.unlink(newFilePath, () => {}); 
    
                    reject(err);
                } else {
                    logAction(user, 'add_document_mobile', 'candidates', candidateId, `File: ${fileData.fileName}`);
                    resolve({ success: true, documentId: this.lastID });
                
                }
            });
        });
    } catch (error) {
        console.error('saveDocumentFromApi failed:', error);
        return { success: false, error: error.message };
    }
};



ipcMain.handle('get-deleted-required-documents', async () => {
  return new Promise((resolve) => {
    const query = `
      SELECT
        id,
        name
      FROM required_documents
      WHERE isDeleted = 1
      ORDER BY isDeleted DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('get-deleted-required-documents error:', err);
        return resolve({ success: false, error: err.message });
      }
      resolve({ success: true, data: rows });
    });
  });
});

ipcMain.handle('restore-required-document', async (event, { id }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE required_documents
      SET isDeleted = 0
      WHERE id = ?
    `;
    db.run(sql, [id], function (err) {
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
});

ipcMain.handle('get-candidate-finance', async (event, { user, candidateId }) => {
  try {
    // 🔐 Read access allowed for Admin & SuperAdmin only
    guard(user).enforce(FEATURES.BILLING);

    logAction(
      user,
      'view_candidate_finance',
      'candidates',
      candidateId,
      `Viewed finance for candidate ID: ${candidateId}`
    );

    return await queries.getCandidateFinance(candidateId);
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});


ipcMain.handle('delete-placement-permanently', async (event, { user, id }) => {
  try {
    // 🔐 SuperAdmin only
    guard(user).enforce(FEATURES.SETTINGS);
    if (user.role !== 'super_admin') {
      return { success: false, error: 'Access Denied: Super Admin only.' };
    }

    const result = await queries.deletePlacementPermanently(id);
    if (result.success) {
      logAction(user, 'permanent_delete', 'placements', id);
    }
    return result;
  } catch (err) {
    return { success: false, error: err.code || err.message };
  }
});


ipcMain.handle("send-whatsapp-bulk", (event, payload) =>
        sendWhatsAppBulk(event, payload)
    );

    ipcMain.handle("open-whatsapp-single", (event, payload) =>
        openWhatsAppSingle(event, payload)
    );

    //ipcMain.handle("send-whatsapp-bulk", (event, payload) =>
  //sendTwilioWhatsApp(event, payload)
//);

// ====================================================================
// VISA TRACKING AUTO-FILL HANDLERS
// ====================================================================

// Handler 1: Get Candidate By ID with Position and Passport
ipcMain.handle('get-candidate-by-id', async (event, { candidateId }) => {
  const db = getDatabase();
  
  return new Promise((resolve) => {
    db.get(
      `SELECT 
        id,
        name,
        passportNo as passport_number,
        Position as position_applying_for,
        education,
        contact,
        status,
        isDeleted
       FROM candidates 
       WHERE id = ? 
       AND isDeleted = 0`,
      [candidateId],
      (err, row) => {
        if (err) {
          console.error('Error fetching candidate:', err);
          resolve({ success: false, error: err.message });
        } else if (!row) {
          resolve({ success: false, error: 'Candidate not found' });
        } else {
          resolve({ success: true, data: row });
        }
      }
    );
  });
});

// Handler 2: Get Candidate Job Placements (for country and job position)
ipcMain.handle('get-candidate-job-placements', async (event, { candidateId }) => {
  const db = getDatabase();
  
  return new Promise((resolve) => {
    db.all(
      `SELECT 
        p.id as placementId,
        p.status as placementStatus,
        p.assignedAt as assignedDate,
        p.job_order_id as jobId,
        j.positionTitle,
        j.country,
        e.companyName
       FROM placements p
       LEFT JOIN job_orders j ON p.job_order_id = j.id
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE p.candidate_id = ?
       AND p.isDeleted = 0
       ORDER BY p.assignedAt DESC`,
      [candidateId],
      (err, rows) => {
        if (err) {
          console.error('Error fetching job placements:', err);
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, data: rows || [] });
        }
      }
    );
  });
});

// Handler 3: Get Job Order By ID (for detailed job information)
ipcMain.handle('get-job-order-by-id', async (event, { jobId }) => {
  const db = getDatabase();
  
  return new Promise((resolve) => {
    db.get(
      `SELECT 
        j.*,
        e.companyName as employer_name,
        e.country as employer_country
       FROM job_orders j
       LEFT JOIN employers e ON j.employer_id = e.id
       WHERE j.id = ?
       AND j.isDeleted = 0`,
      [jobId],
      (err, row) => {
        if (err) {
          console.error('Error fetching job order:', err);
          resolve({ success: false, error: err.message });
        } else if (!row) {
          resolve({ success: false, error: 'Job order not found' });
        } else {
          resolve({ success: true, data: row });
        }
      }
    );
  });
});

ipcMain.handle('ui-can-access', async (event, { feature }) => {
    try {
        // Get canonical logged-in user from session/context
        const user = await getCanonicalUserContextFromQueries();

        if (!user) {
            return { allowed: false };
        }

        // FEATURE must exist
        if (!FEATURES[feature]) {
            return { allowed: false };
        }

        // Permission enforcement (no throw leak to UI)
        try {
            guard(user).enforce(FEATURES[feature]);
            return { allowed: true };
        } catch {
            return { allowed: false };
        }
    } catch (err) {
        return { allowed: false };
    }
});

// ============================================
// IPC HANDLER - AUDIT LOG
// ============================================

ipcMain.handle('audit:get-system-log', async (event, params) => {
  try {
    // Use globally stored user
    if (!currentAuthUser) {
      return {
        success: false,
        error: "Authentication required. Please log in again."
      };
    }
    
    // Check for admin/super_admin access
    if (currentAuthUser.role === 'superadmin' || currentAuthUser.role === 'super_admin') {
      // Super admin access granted
    } else if (currentAuthUser.role === 'admin') {
      // Admin access granted
    } else {
      return {
        success: false,
        error: `Access Denied: Only admins can access audit logs. Your role: ${currentAuthUser.role}`
      };
    }
    
    // Call your existing audit log function
    const result = await getSystemAuditLog({
      user: currentAuthUser,
      userFilter: params?.userFilter || '',
      actionFilter: params?.actionFilter || '',
      limit: params?.limit || 30,
      offset: params?.offset || 0
    });
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to fetch audit logs"
    };
  }
});


// Helper function to decode JWT token
function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('utf-8')
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("❌ Token decode error:", err);
    return null;
  }
}



    module.exports = { registerIpcHandlers , saveDocumentFromApi  , registerAnalyticsHandlers , getDatabase  };