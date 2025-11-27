const { ipcMain, dialog } = require('electron');
const { getDb } = require('../db/database.cjs');
const { fileManager } = require('../utils/fileManager.cjs');
const fs = require('fs').promises;
const path = require('path');

function registerDocumentHandlers() {
  /**
   * Upload document
   */
  ipcMain.handle('upload-document', async (event, data) => {
    const { candidateId, documentType, fileBuffer, fileName } = data;
    const db = getDb();

    try {
      // Save file
      const fileInfo = await fileManager.saveFile(
        Buffer.from(fileBuffer),
        fileName,
        'documents'
      );

      // Save to database
      const result = db.prepare(`
        INSERT INTO documents (candidate_id, document_type, document_name, file_path)
        VALUES (?, ?, ?, ?)
      `).run(candidateId, documentType, fileInfo.originalName, fileInfo.filename);

      return {
        success: true,
        document: {
          id: result.lastInsertRowid,
          ...fileInfo
        }
      };
    } catch (error) {
      console.error('Failed to upload document:', error);
      throw error;
    }
  });

  /**
   * Get candidate documents
   */
  ipcMain.handle('get-candidate-documents', async (event, candidateId) => {
    const db = getDb();

    try {
      const documents = db.prepare(`
        SELECT * FROM documents 
        WHERE candidate_id = ? 
        ORDER BY uploaded_at DESC
      `).all(candidateId);

      return { success: true, documents };
    } catch (error) {
      console.error('Failed to get documents:', error);
      throw error;
    }
  });

  /**
   * Download document
   */
  ipcMain.handle('download-document', async (event, documentId) => {
    const db = getDb();

    try {
      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      const fileBuffer = await fileManager.getFile(document.file_path, 'documents');

      return {
        success: true,
        buffer: fileBuffer,
        filename: document.document_name
      };
    } catch (error) {
      console.error('Failed to download document:', error);
      throw error;
    }
  });

  /**
   * Delete document
   */
  ipcMain.handle('delete-document', async (event, documentId) => {
    const db = getDb();

    try {
      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete file
      await fileManager.deleteFile(document.file_path, 'documents');

      // Delete from database
      db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);

      return { success: true };
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  });

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
