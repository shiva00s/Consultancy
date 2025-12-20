const { ipcMain, dialog } = require('electron');
const { getDb } = require('../db/database.cjs');
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
    // Get document with correct column names
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    // Delete file - use filePath or file_path depending on your schema
    const pathToDelete = document.filePath || document.file_path;
    if (pathToDelete) {
      await fileManager.deleteFile(pathToDelete, 'documents');
    }

    // Soft delete from database
    db.prepare('UPDATE documents SET isDeleted = 1 WHERE id = ?').run(docId);

    return { success: true };
  } catch (error) {
    console.error('Failed to delete document:', error);
    return { success: false, error: error.message };
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

      // Update candidate photo path
      db.prepare('UPDATE candidates SET photo_path = ? WHERE id = ?')
        .run(fileInfo.filename, candidateId);

      return {
        success: true,
        photoPath: fileInfo.filename
      };
    } catch (error) {
      console.error('Failed to upload photo:', error);
      throw error;
    }
  });
}

module.exports = { registerDocumentHandlers };
