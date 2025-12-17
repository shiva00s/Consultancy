// src/services/queries/documentRequirementQueries.js
// For DocumentRequirementManager.jsx – manage required document master list

const getDatabase = require('../database.cjs');
const { dbGet, dbRun, dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

async function getRequiredDocuments() {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      'SELECT * FROM required_documents WHERE isDeleted = 0 ORDER BY name ASC',
      []
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addRequiredDocument(name) {
  const db = getDatabase();
  if (!name || name.trim() === '') {
    return { success: false, error: mapErrorToFriendly('Document name is required.') };
  }
  name = name.trim();
  try {
    const existingActive = await dbGet(
      db,
      'SELECT id FROM required_documents WHERE name = ? AND isDeleted = 0',
      [name]
    );
    if (existingActive) {
      return { success: false, error: mapErrorToFriendly('Document name already exists.') };
    }

    const existingDeleted = await dbGet(
      db,
      'SELECT id FROM required_documents WHERE name = ? AND isDeleted = 1',
      [name]
    );
    if (existingDeleted) {
      await dbRun(
        db,
        'UPDATE required_documents SET isDeleted = 0 WHERE id = ?',
        [existingDeleted.id]
      );
      const revived = await dbGet(
        db,
        'SELECT * FROM required_documents WHERE id = ?',
        [existingDeleted.id]
      );
      return { success: true, data: revived };
    }

    const result = await dbRun(
      db,
      'INSERT INTO required_documents (name, isDeleted) VALUES (?, 0)',
      [name]
    );
    const row = await dbGet(
      db,
      'SELECT * FROM required_documents WHERE id = ?',
      [result.lastID]
    );
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteRequiredDocument(id) {
  const db = getDatabase();
  try {
    await dbRun(
      db,
      'UPDATE required_documents SET isDeleted = 1 WHERE id = ?',
      [id]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getDeletedRequiredDocuments() {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      'SELECT id, name FROM required_documents WHERE isDeleted = 1 ORDER BY name ASC',
      []
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreRequiredDocument(id) {
  const db = getDatabase();
  try {
    await dbRun(
      db,
      'UPDATE required_documents SET isDeleted = 0 WHERE id = ?',
      [id]
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

module.exports = {
  getRequiredDocuments,
  addRequiredDocument,
  deleteRequiredDocument,
  getDeletedRequiredDocuments,
  restoreRequiredDocument,
};
