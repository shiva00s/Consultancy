const { ipcMain, dialog } = require('electron');
const { getDb } = require('../../db/database.cjs');
const { fileManager } = require('../../utils/fileManager.cjs');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const extract = require('extract-zip');


function registerDocumentHandlers() {
  /**
   * Upload document
   */
  

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

  /**
   * Bulk import documents from a ZIP archive
   */
  ipcMain.handle('bulk-import-documents', async (event, { user, candidateIdMap, archivePath }) => {
    const db = getDb();
    const tempExtractPath = path.join(os.tmpdir(), `bulk_import_docs_${uuidv4()}`);
    let successfulImports = 0;
    let failedImports = [];

    try {
      // 1. Extract the ZIP archive
      await extract(archivePath, { dir: tempExtractPath });
      const extractedFiles = await fs.readdir(tempExtractPath);

      for (const fileName of extractedFiles) {
        const filePath = path.join(tempExtractPath, fileName);
        const fileExtension = path.extname(fileName);
        const baseName = path.basename(fileName, fileExtension);

        // Expected format: PassportNo_DocumentType.ext (e.g., A1234567_Resume.pdf)
        const parts = baseName.split('_');
        if (parts.length < 2) {
          failedImports.push({ fileName, error: 'Filename format incorrect (expected PassportNo_DocumentType.ext)' });
          continue;
        }

        const passportNo = parts[0].toLowerCase();
        const documentType = parts.slice(1).join('_'); // Re-join if doc type has underscores
        const candidateId = candidateIdMap[passportNo];

        if (!candidateId) {
          failedImports.push({ fileName, error: `No candidate found with passport number: ${passportNo}` });
          continue;
        }

        const fileBuffer = await fs.readFile(filePath);

        try {
          const fileInfo = await fileManager.saveFile(
            fileBuffer,
            fileName,
            'documents'
          );

          db.prepare(`
            INSERT INTO documents (candidate_id, document_type, document_name, file_path)
            VALUES (?, ?, ?, ?)
          `).run(candidateId, documentType, fileInfo.originalName, fileInfo.filename);

          successfulImports++;
        } catch (saveError) {
          failedImports.push({ fileName, error: saveError.message });
        }
      }
      return { success: true, successfulImports, failedImports };
    } catch (error) {
      console.error('Bulk document import failed:', error);
      return { success: false, error: error.message };
    } finally {
      // Clean up temporary extracted files
      if (fs.existsSync(tempExtractPath)) {
          await fs.rm(tempExtractPath, { recursive: true, force: true });
      }
    }
  });

}

module.exports = { registerDocumentHandlers };
