// src-electron/db/whatsappQueries.cjs

const { getDatabase } = require('./database.cjs');

/**
 * Promise-based DB helpers
 */
const dbRun = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (db, sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

/**
 * Get all candidates with contact numbers for WhatsApp
 * Maps 'contact' column to 'phone_number' for compatibility
 */
async function getCandidatesForWhatsApp() {
  const db = getDatabase();
  
  try {
    const sql = `
      SELECT 
        id,
        name,
        contact AS phone_number,
        contact,
        education,
        experience,
        dob,
        passportNo,
        passportExpiry,
        aadhar,
        status,
        notes,
        Position,
        createdAt
      FROM candidates
      WHERE isDeleted = 0
        AND contact IS NOT NULL
        AND contact != ''
      ORDER BY name ASC
    `;
    
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    console.error('getCandidatesForWhatsApp error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getCandidatesForWhatsApp,
  dbRun,
  dbGet,
  dbAll
};
