const { ipcMain, dialog } = require('electron');
const { getDb } = require('../db/database.cjs');
const { fileManager } = require('../utils/fileManager.cjs');
const fs = require('fs').promises;
const path = require('path');


function registerDocumentHandlers() {
  
  /**
   * Open file picker dialog
   */
  ipcMain.handle('open-file-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters || [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }
      ]
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
