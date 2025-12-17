// src/services/queries/candidateListQueries.js
// 🔍 Search + Pagination for CandidateListPage.jsx (20/page)
// Multi-field search: Name, Passport, Contact, Aadhar, Position, Education

const getDatabase = require('../database.cjs');
const { dbGet, dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

const ITEMS_PER_PAGE = 20;

/**
 * Main search handler (CandidateListPage.jsx → searchCandidates)
 * Multi-field search + pagination + filters
 */
async function searchCandidates(searchTerm = '', status = '', position = '', limit = ITEMS_PER_PAGE, offset = 0) {
  const db = getDatabase();
  let baseQuery = 'FROM candidates WHERE isDeleted = 0';
  const params = [];
  const countParams = [];

  // Multi-field search (Name, Passport, Contact, Aadhar, Position, Education)
  if (searchTerm) {
    baseQuery += ' AND (' +
      'name LIKE ? OR ' +
      'passportNo LIKE ? OR ' +
      'contact LIKE ? OR ' +
      'aadhar LIKE ? OR ' +
      'Position LIKE ? OR ' +
      'education LIKE ?)';
    
    const term = `%${searchTerm}%`;
    params.push(term, term, term, term, term, term);
    countParams.push(term, term, term, term, term, term);
  }

  // Status filter
  if (status && status !== 'All Statuses') {
    baseQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  // Position filter
  if (position) {
    baseQuery += ' AND Position LIKE ?';
    params.push(`%${position}%`);
    countParams.push(`%${position}%`);
  }

  try {
    // Get total count for pagination
    const countRow = await dbGet(db, `
      SELECT COUNT(*) as totalCount ${baseQuery}
    `, countParams);
    const totalCount = countRow ? countRow.totalCount : 0;

    // Get paginated results
    const fetchQuery = `
      SELECT * ${baseQuery} 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    
    const rows = await dbAll(db, fetchQuery, params);

    return {
      success: true,
      data: rows,
      totalCount
    };
  } catch (err) {
    console.error('Search query error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: [],
      totalCount: 0
    };
  }
}

/**
 * Get candidates by status (for stats/summary)
 */
async function getCandidatesByStatus() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT status, COUNT(*) as count 
      FROM candidates 
      WHERE isDeleted = 0 
      GROUP BY status 
      ORDER BY count DESC
    `);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Get top positions for filter dropdown
 */
async function getTopPositions(limit = 20) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT DISTINCT Position, COUNT(*) as count 
      FROM candidates 
      WHERE isDeleted = 0 AND Position IS NOT NULL AND Position != '' 
      GROUP BY Position 
      ORDER BY count DESC 
      LIMIT ?
    `, [limit]);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Get recent candidates (dashboard/homepage)
 */
async function getRecentCandidates(limit = 10) {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, `
      SELECT id, name, passportNo, Position, status, createdAt 
      FROM candidates 
      WHERE isDeleted = 0 
      ORDER BY createdAt DESC 
      LIMIT ?
    `, [limit]);

    return {
      success: true,
      data: rows
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Bulk status update (select multiple → change status)
 */
async function bulkUpdateStatus(candidateIds, newStatus) {
  const db = getDatabase();
  try {
    if (!candidateIds || candidateIds.length === 0) {
      return { success: false, error: 'No candidates selected' };
    }

    const placeholders = candidateIds.map(() => '?').join(',');
    await dbRun(db, `
      UPDATE candidates 
      SET status = ? 
      WHERE id IN (${placeholders}) AND isDeleted = 0
    `, [newStatus, ...candidateIds]);

    return {
      success: true,
      updatedCount: candidateIds.length
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Export candidates to CSV (search results)
 */
async function exportCandidatesToCsv(searchTerm = '', status = '') {
  const db = getDatabase();
  let query = `
    SELECT id, name, passportNo, Position, status, contact, aadhar, 
           education, experience, dob, passportExpiry, notes, createdAt
    FROM candidates 
    WHERE isDeleted = 0
  `;
  const params = [];

  if (searchTerm) {
    query += ' AND (name LIKE ? OR passportNo LIKE ? OR contact LIKE ? OR aadhar LIKE ? OR Position LIKE ?)';
    const term = `%${searchTerm}%`;
    params.push(term, term, term, term, term);
  }

  if (status && status !== 'All Statuses') {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY name ASC';

  try {
    const rows = await dbAll(db, query, params);
    return {
      success: true,
      data: rows,
      recordCount: rows.length
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler name from CandidateListPage.jsx
module.exports = {
  // Main search (20/page pagination)
  searchCandidates,
  
  // Stats & filters
  getCandidatesByStatus,
  getTopPositions,
  
  // Dashboard
  getRecentCandidates,
  
  // Bulk actions
  bulkUpdateStatus,
  
  // Export
  exportCandidatesToCsv,
  
  // Legacy compatibility (exact match queries.cjs)
  searchCandidates  // Already exists - enhanced version
};
