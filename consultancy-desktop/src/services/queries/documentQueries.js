// src/services/queries/documentQueries.js
// 📁 Document Management for CandidateDocuments.jsx
// Category updates + soft delete + file handling

const getDatabase = require('../database.cjs');
const { dbGet, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

const { DOCUMENT_CATEGORIES: documentCategories } = require('../../utils/documentCategories.cjs');

/**
 * Update document category (CandidateDocuments.jsx → updateDocumentCategory)
 * Changes doc category + returns candidateId/fileName for audit
 */
async function updateDocumentCategory(user, docId, category) {
  const db = getDatabase();
  
  // Validate category
  if (!documentCategories.includes(category)) {
    return {
      success: false,
      error: mapErrorToFriendly('Invalid document category.')
    };
  }
  
  try {
    // Get existing doc info first
    const row = await dbGet(db, `
      SELECT candidateid, fileName 
      FROM documents 
      WHERE id = ? AND isDeleted = 0
    `, [docId]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Document not found.')
      };
    }
    
    // Update category
    const result = await dbRun(db, `
      UPDATE documents 
      SET category = ? 
      WHERE id = ? AND isDeleted = 0
    `, [category, docId]);
    
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly('Document not found or already deleted.')
      };
    }
    
    return {
      success: true,
      candidateId: row.candidateid,
      fileName: row.fileName
    };
  } catch (err) {
    console.error('updateDocumentCategory error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Soft delete document (CandidateDocuments.jsx → deleteDocument)
 * Moves to Recycle Bin + returns candidateId/fileName for parent refresh
 */
async function deleteDocument(user, docId) {
  const db = getDatabase();
  
  try {
    // Get existing doc info first
    const row = await dbGet(db, `
      SELECT candidateid, fileName 
      FROM documents 
      WHERE id = ? AND isDeleted = 0
    `, [docId]);
    
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Document not found.')
      };
    }
    
    // Soft delete
    const result = await dbRun(db, `
      UPDATE documents 
      SET isDeleted = 1 
      WHERE id = ?
    `, [docId]);
    
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly('Document not found or already deleted.')
      };
    }
    
    return {
      success: true,
      candidateId: row.candidateid,
      fileName: row.fileName
    };
  } catch (err) {
    console.error('deleteDocument error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from CandidateDocuments.jsx
module.exports = {
  updateDocumentCategory,
  deleteDocument,
  documentCategories
};
