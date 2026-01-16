const { ipcMain, dialog } = require('electron');
const { getDb, dbGet, dbRun } = require('../db/database.cjs');
const { fileManager } = require('../utils/fileManager.cjs');
const fs = require('fs').promises;
const path = require('path');


function registerDocumentHandlers() {
  /**
   * Upload document
   */
  

 
  /**
   * Delete document
   */
  ipcMain.handle('delete-document', async (event, { user, docId }) => {
  const db = getDb();

  try {
    // Get document with correct column names using async helper
    const document = await dbGet(db, 'SELECT * FROM documents WHERE id = ?', [docId]);
    if (!document) {
      throw new Error('Document not found');
    }

    const pathToDelete = document.filePath || document.file_path;

    // Soft delete from database
    await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE id = ?', [docId]);

    // Move file to recycle area instead of permanently deleting (best-effort)
    try {
      if (pathToDelete) {
        const filename = path.basename(pathToDelete);
        const fromCategory = document.category || 'documents';
        await fileManager.moveFile(filename, fromCategory, 'recycle');
      }
    } catch (moveErr) {
      console.warn('Failed to move file to recycle, file left in place:', moveErr && moveErr.message);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    return { success: false, error: error.message };
  }
});

  /**
   * Batch delete (soft) - accepts array of doc IDs and processes them atomically.
   * Returns { success: true, processed: n, errors: [...] }
   */
  ipcMain.handle('delete-documents-bulk', async (event, { user, docIds = [] }) => {
    const db = getDb();
    const results = { success: true, processed: 0, errors: [] };
    if (!Array.isArray(docIds) || docIds.length === 0) return { success: false, error: 'No document IDs provided' };

    const moves = [];

    try {
      // Begin transaction
      await dbRun(db, 'BEGIN TRANSACTION');

      for (const id of docIds) {
        try {
          const doc = await dbGet(db, 'SELECT * FROM documents WHERE id = ?', [id]);
          if (!doc) {
            results.errors.push({ id, error: 'not found' });
            continue;
          }

          await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE id = ?', [id]);
          results.processed += 1;

          const pathToDelete = doc.filePath || doc.file_path;
          if (pathToDelete) {
            const filename = path.basename(pathToDelete);
            const fromCategory = doc.category || 'documents';
            moves.push({ filename, fromCategory });
          }
        } catch (innerErr) {
          console.warn('Error processing doc id', id, innerErr && innerErr.message);
          results.errors.push({ id, error: innerErr && innerErr.message });
        }
      }

      // Commit transaction
      await dbRun(db, 'COMMIT');

      // After commit, try moving files to recycle (best-effort)
      for (const m of moves) {
        try {
          await fileManager.moveFile(m.filename, m.fromCategory, 'recycle');
        } catch (moveErr) {
          console.warn('bulk move to recycle failed for', m.filename, moveErr && moveErr.message);
          results.errors.push({ filename: m.filename, error: moveErr && moveErr.message });
        }
      }

      return results;
    } catch (err) {
      console.error('delete-documents-bulk error', err);
      try {
        await dbRun(db, 'ROLLBACK');
      } catch (rbErr) {
        console.error('rollback failed', rbErr);
      }
      return { success: false, error: err.message, processed: results.processed, errors: results.errors };
    }
  });

  /**
   * Open file picker dialog
   */
  const { safeShowOpenDialog } = require('../utils/dialogHelpers.cjs');

  ipcMain.handle('open-file-dialog', async (event, options) => {
    const result = await safeShowOpenDialog(null, {
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
      ],
      bypassNative: options?.bypassNative
    });

    if (result.canceled) {
      return { success: false };
    }

    const filePath = result.filePaths[0];
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    return {
      success: true,
      fileBuffer: Array.from(fileBuffer),
      fileName,
      filePath
    };
  });

  /**
   * Upload resume with parsing
   */
  ipcMain.handle('upload-resume', async (event, data) => {
    const { candidateId, fileBuffer, fileName } = data;
    const db = getDb();

    try {
      // Save resume
      const fileInfo = await fileManager.saveFile(
        Buffer.from(fileBuffer),
        fileName,
        'resumes'
      );

      // Update candidate resume path
      db.prepare('UPDATE candidates SET resume_path = ? WHERE id = ?')
        .run(fileInfo.filename, candidateId);

      // Save to documents table
      const result = db.prepare(`
        INSERT INTO documents (candidate_id, document_type, document_name, file_path)
        VALUES (?, ?, ?, ?)
      `).run(candidateId, 'resume', fileInfo.originalName, fileInfo.filename);

      return {
        success: true,
        resumePath: fileInfo.filename,
        document: {
          id: result.lastInsertRowid,
          ...fileInfo
        }
      };
    } catch (error) {
      console.error('Failed to upload resume:', error);
      throw error;
    }
  });

  /**
   * Upload candidate photo
   */
  ipcMain.handle('upload-photo', async (event, data) => {
    const { candidateId, fileBuffer, fileName } = data;
    const db = getDb();

    try {
      // Save photo
      const fileInfo = await fileManager.saveFile(
        Buffer.from(fileBuffer),
        fileName,
        'photos'
      );

      // Update candidate photo path (store absolute path so renderer can load via getImageBase64)
      db.prepare('UPDATE candidates SET photo_path = ? WHERE id = ?')
        .run(fileInfo.path, candidateId);

      return {
        success: true,
        // return full absolute path for consistent rendering via getImageBase64
        photoPath: fileInfo.path
      };
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw error;
    }
  });
}

module.exports = { registerDocumentHandlers };
