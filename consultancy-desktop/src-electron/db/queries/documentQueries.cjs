// documentQueries.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime');
const { getDatabase } = require('../db/database.cjs');

// Promise DB helpers (expect same style as rest of queries file)
const dbRun = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) return reject(err);
    resolve(this);
  });
});
const dbGet = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err);
    resolve(row);
  });
});
const dbAll = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err);
    resolve(rows);
  });
});

// Base files dir helper (app userData path is available in handlers; replicate a safe default)
function getFilesDir() {
  try {
    // Try to re-use electron app path if available
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'candidate_files');
  } catch (e) {
    // Fallback to temp dir when running outside electron (for tests)
    return path.join(os.tmpdir(), 'consultancy_candidate_files');
  }
}

// Ensure the candidate files directory exists
function ensureFilesDir() {
  const dir = getFilesDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// -----------------------------------------------
// Add a single document (fileBuffer is a Buffer)
// fileData: { candidateId, fileName, fileType, buffer, category }
// Returns inserted DB row
// -----------------------------------------------
async function addDocument(fileData) {
  try {
    ensureFilesDir();
    const db = getDatabase();

    // Validate minimum fields
    if (!fileData || !fileData.candidateId || !fileData.fileName || !fileData.buffer) {
      return { success: false, error: 'candidateId, fileName and buffer are required.' };
    }

    const uniqueName = `${uuidv4()}${path.extname(fileData.fileName) || ''}`;
    const destPath = path.join(getFilesDir(), uniqueName);

    // Write file to disk (async)
    await fs.promises.writeFile(destPath, Buffer.from(fileData.buffer));

    const fileType = fileData.fileType || mime.getType(fileData.fileName) || 'application/octet-stream';
    const category = fileData.category || 'Uncategorized';

    const sql = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category, isDeleted, createdAt)
                 VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`;
    const res = await dbRun(db, sql, [fileData.candidateId, fileType, fileData.fileName, destPath, category]);

    const row = await dbGet(db, 'SELECT * FROM documents WHERE id = ?', [res.lastID]);
    return { success: true, data: row };
  } catch (err) {
    // Attempt cleanup if file exists and DB insert failed
    try { if (destPath && fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch(e){}
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Add multiple documents (files array)
// files: [{ candidateId, fileName, fileType, buffer, category }]
// Returns array of inserted rows
// -----------------------------------------------
async function addDocumentsBulk(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, error: 'No files provided.' };
  }
  const inserted = [];
  const db = getDatabase();
  ensureFilesDir();

  // Use transaction for safety
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    for (const f of files) {
      if (!f.candidateId || !f.fileName || !f.buffer) {
        // skip invalid
        continue;
      }
      const uniqueName = `${uuidv4()}${path.extname(f.fileName) || ''}`;
      const destPath = path.join(getFilesDir(), uniqueName);
      await fs.promises.writeFile(destPath, Buffer.from(f.buffer));
      const fileType = f.fileType || mime.getType(f.fileName) || 'application/octet-stream';
      const category = f.category || 'Uncategorized';

      const sql = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category, isDeleted, createdAt)
                   VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`;
      const res = await dbRun(db, sql, [f.candidateId, fileType, f.fileName, destPath, category]);
      const row = await dbGet(db, 'SELECT * FROM documents WHERE id = ?', [res.lastID]);
      inserted.push(row);
    }
    await dbRun(db, 'COMMIT');
    return { success: true, data: inserted };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    // Best-effort cleanup of any files we wrote (attempt only)
    // (We don't know all destPaths here if error occurred before push; ignore)
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// List documents for a candidate (active only)
// -----------------------------------------------
async function getDocumentsByCandidate(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, 'SELECT * FROM documents WHERE candidate_id = ? AND isDeleted = 0 ORDER BY category, fileName', [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Soft-delete a document (mark isDeleted = 1)
// -----------------------------------------------
async function softDeleteDocument(docId) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, 'SELECT candidate_id, filePath, fileName FROM documents WHERE id = ?', [docId]);
    if (!row) return { success: false, error: 'Document not found.' };

    await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE id = ?', [docId]);
    return { success: true, candidateId: row.candidate_id, fileName: row.fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Update document category
// -----------------------------------------------
async function updateDocumentCategory(docId, category) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, 'SELECT candidate_id, fileName FROM documents WHERE id = ?', [docId]);
    if (!row) return { success: false, error: 'Document not found.' };

    await dbRun(db, 'UPDATE documents SET category = ? WHERE id = ?', [category, docId]);
    return { success: true, candidateId: row.candidate_id, fileName: row.fileName };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Get secure file path by documentId (for handlers)
// Returns absolute path only if record exists
// -----------------------------------------------
async function getSecureFilePath(documentId) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, 'SELECT filePath FROM documents WHERE id = ?', [documentId]);
    if (!row || !row.filePath) return { success: false, error: 'Document not found.' };
    if (!fs.existsSync(row.filePath)) return { success: false, error: 'Physical file missing.' };
    return { success: true, filePath: row.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Get document as base64 (used by handlers)
// -----------------------------------------------
async function getDocumentBase64(documentId) {
  try {
    const res = await getSecureFilePath(documentId);
    if (!res.success) return res;
    const filePath = res.filePath;
    const data = fs.readFileSync(filePath, { encoding: 'base64' });
    const fileType = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (fileType === '.pdf') mimeType = 'application/pdf';
    else if (['.png', '.jpg', '.jpeg', '.gif'].includes(fileType)) mimeType = `image/${fileType.substring(1)}`;
    return { success: true, data: `data:${mimeType};base64,${data}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Get image as base64 when UI requests by path
// (keeps behavior similar to handler version but DB-aware is preferred)
// -----------------------------------------------
async function getImageBase64ByPath(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { success: false, error: 'File not found.' };
    const data = fs.readFileSync(filePath, { encoding: 'base64' });
    const fileType = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (fileType === '.png') mimeType = 'image/png';
    else if (fileType === '.gif') mimeType = 'image/gif';
    return { success: true, data: `data:${mimeType};base64,${data}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// List deleted documents (recycle bin)
// -----------------------------------------------
async function getDeletedDocuments() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, 'SELECT id, candidate_id, fileName, category, createdAt FROM documents WHERE isDeleted = 1 ORDER BY createdAt DESC', []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Restore document (soft-undelete)
// -----------------------------------------------
async function restoreDocument(id) {
  const db = getDatabase();
  try {
    const res = await dbRun(db, 'UPDATE documents SET isDeleted = 0 WHERE id = ?', [id]);
    if (!res.changes) return { success: false, error: 'Document not found.' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Permanently delete document record & file
// (SuperAdmin UI should call this carefully)
// -----------------------------------------------
async function deleteDocumentPermanently(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, 'SELECT filePath FROM documents WHERE id = ?', [id]);
    if (!row) return { success: false, error: 'Document not found.' };

    // Attempt file deletion (best-effort)
    try {
      if (row.filePath && fs.existsSync(row.filePath)) {
        fs.unlinkSync(row.filePath);
      }
    } catch (e) {
      // log but continue to remove DB row
      console.warn('Warning: could not delete file on disk for document id', id, e.message);
    }

    const res = await dbRun(db, 'DELETE FROM documents WHERE id = ?', [id]);
    if (!res.changes) return { success: false, error: 'Document not deleted.' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------
// Bulk import helper used by handlers' bulk-import-documents
// Accepts: tempFolderPath, candidateIdMap (passportNo -> candidateId)
// Copies files inside temp folder into candidate_files and writes DB rows
// -----------------------------------------------
async function bulkImportDocumentsFromFolder(tempFolderPath, candidateIdMap) {
  const db = getDatabase();
  ensureFilesDir();

  if (!fs.existsSync(tempFolderPath)) return { success: false, error: 'Temp folder not found.' };

  const files = fs.readdirSync(tempFolderPath);
  let successful = 0;
  let failed = 0;
  const details = [];

  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    for (const fileName of files) {
      if (!fileName || fileName.startsWith('.') || fileName.startsWith('__')) continue;
      const parsed = path.parse(fileName);
      const nameOnly = parsed.name;
      const ext = parsed.ext || '';
      // Heuristic: file names like PASSPORT123_category.ext OR PASSPORT123.ext
      const parts = nameOnly.split('_');
      const passportNo = parts[0].trim().toUpperCase();
      const category = parts.length > 1 ? parts.slice(1).join('_') : 'Uncategorized';
      const candidateId = candidateIdMap[passportNo];

      if (!candidateId) {
        failed++;
        details.push({ fileName, reason: `No candidate map for passport: ${passportNo}` });
        continue;
      }

      const uniqueName = `${uuidv4()}${ext}`;
      const src = path.join(tempFolderPath, fileName);
      const dest = path.join(getFilesDir(), uniqueName);

      try {
        fs.copyFileSync(src, dest);
        const fileType = mime.getType(fileName) || 'application/octet-stream';
        const sql = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category, isDeleted, createdAt)
                     VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`;
        await dbRun(db, sql, [candidateId, fileType, fileName, dest, category]);
        successful++;
      } catch (err) {
        failed++;
        details.push({ fileName, reason: err.message });
        // cleanup dest if written
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch(e){}
      }
    }

    await dbRun(db, 'COMMIT');
    return { success: true, data: { successful, failed, details } };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return { success: false, error: err.message, data: { successful, failed, details } };
  }
}

module.exports = {
  addDocument,
  addDocumentsBulk,
  getDocumentsByCandidate,
  softDeleteDocument,
  updateDocumentCategory,
  getSecureFilePath,
  getDocumentBase64,
  getImageBase64ByPath,
  getDeletedDocuments,
  restoreDocument,
  deleteDocumentPermanently,
  bulkImportDocumentsFromFolder
};
