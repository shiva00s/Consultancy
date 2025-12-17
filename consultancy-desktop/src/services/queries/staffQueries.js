// src/services/queries/staffQueries.js
// 👥 Staff list for StaffSelector.jsx [file:40] + Passport Forms [file:38][file:39]

const getDatabase = require('../database.cjs');
const { dbAll } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * getStaffList → StaffSelector.jsx [file:40]
 * Returns [{name: "John Doe"}] for CustomDropdown
 */
async function getStaffList() {
  const db = getDatabase();
  const sql = `
    SELECT username as name 
    FROM users 
    WHERE isDeleted = 0 
    ORDER BY username ASC
  `;
  
  try {
    const rows = await dbAll(db, sql, []);
    return {
      success: true,
      data: rows.map(row => ({
        name: row.name || 'Unknown'
      }))
    };
  } catch (err) {
    console.error('getStaffList error:', err);
    return { 
      success: false, 
      error: mapErrorToFriendly(err),
      data: [{ name: 'System User' }] // Fallback
    };
  }
}

// 🔌 SINGLE EXPORT
module.exports = {
  getStaffList
};
