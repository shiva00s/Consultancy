const { getDatabase } = require('../db/database.cjs');
const { validateVerhoeff } = require('../utils/validators.cjs');
const bcrypt = require('bcrypt');
const saltRounds = 10;
// ====================================================================
// --- VALIDATION HELPERS ---
// ====================================================================

const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// MODIFIED: Returns only the clean error message string
const validateRequired = (field, name) => {
    if (!field || (typeof field === 'string' && field.trim() === '')) {
        return `${name} is required.`;
    }
    return null;
};

// MODIFIED: Returns only the clean error message string
const validatePositiveNumber = (field, name) => {
    const num = parseFloat(field);
    if (isNaN(num) || num < 0) {
        return `${name} must be a valid positive number.`;
    }
    return null;
};

// --- Promise-based DB helpers ---
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

// ====================================================================
// 2. USER MANAGEMENT & AUTHENTICATION
// ====================================================================

// Function to fetch the SA's global feature flags (used as the policy ceiling)
async function getSuperAdminFeatureFlags() {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1", []);
        if (row && row.features) {
            return { success: true, data: JSON.parse(row.features) };
        }
        return { success: true, data: {} }; // Default to empty if not configured
    } catch (err) {
        console.error('getSAFlags DB Error:', err.message);
        return { success: false, error: 'Failed to retrieve global policy flags.' };
    }
}

// Function to enforce feature flags for the Admin role
async function checkAdminFeatureAccess(user, featureKey) {
    if (!user || user.role === 'super_admin') return { success: true };
    if (user.role !== 'admin') return { success: true }; // Staff permissions are handled on the frontend and delegated via other logic
    
    // Check if the required feature flag is enabled in the global policy
    const flagRes = await getSuperAdminFeatureFlags();
    
    if (!flagRes.success || !flagRes.data[featureKey]) {
        const error = `Access Denied: Feature "${featureKey}" is disabled by Super Admin policy.`;
        console.warn(`Admin attempt blocked: ${error}`);
        return { success: false, error: error };
    }
    return { success: true };
}

async function getUserPermissions(userId) {
    const db = getDatabase();
    try {
        // Fetch custom flags for a specific user ID
        const row = await dbGet(db, 'SELECT flags FROM user_permissions WHERE user_id = ?', [userId]);
        // Return parsed flags or null if none exist
        return { success: true, data: row ? JSON.parse(row.flags) : null };
    } catch (err) {
        console.error('getUserPermissions DB Error:', err.message);
        return { success: false, error: 'Failed to retrieve user permissions.' };
    }
}

async function saveUserPermissions(userId, flags) {
    const db = getDatabase();
    const flagsJson = JSON.stringify(flags);
    try {
        const sql = `INSERT OR REPLACE INTO user_permissions (user_id, flags) VALUES (?, ?)`;
        await dbRun(db, sql, [userId, flagsJson]);
        return { success: true };
    } catch (err) {
        console.error('saveUserPermissions DB Error:', err.message);
        return { success: false, error: 'Failed to save user permissions.' };
    }
}

async function login(username, password) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, 'SELECT id, password, role, username FROM users WHERE username = ?', [username]);
    if (!row) {
      return { success: false, error: 'Invalid username or password.' };
    }
    const match = await bcrypt.compare(password, row.password);
    if (match) {
      return { 
        success: true, 
        id: row.id, 
        username: row.username, 
        role: row.role 
      };
    } else {
      return { success: false, error: 'Invalid username or password.' };
    }
  } catch (err) {
    console.error('Login Error:', err.message);
    return { success: false, error: 'A database or bcrypt error occurred.' };
  }
}

// MODIFIED: Use structured error return
async function registerNewUser(username, password, role) {
  const db = getDatabase();
  // --- Validation ---
  const errors = {};
  if (validateRequired(username, 'Username')) errors.username = validateRequired(username, 'Username');
  if (validateRequired(password, 'Password')) errors.password = validateRequired(password, 'Password');
  if (!errors.password && password.length < 6) errors.password = 'Password must be at least 6 characters.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
    const result = await dbRun(db, sql, [username, hash, role]);
    
    return {
      success: true,
      data: { id: result.lastID, username, role },
    };
  } catch (dbErr) {
    if (dbErr.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'Username already exists.' };
    }
    console.error('Registration DB Run Error:', dbErr);
    return { success: false, error: dbErr.message };
  }
}

async function getAllUsers() {
  const db = getDatabase();
  try {
    const sql = 'SELECT id, username, role FROM users ORDER BY username ASC';
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    console.error('get-all-users DB Error:', err);
    return { success: false, error: 'Failed to fetch existing users.' };
  }
}

// MODIFIED: Use structured error return
async function addUser(username, password, role) {
  const db = getDatabase();
  // --- Validation ---
  const errors = {};
  if (validateRequired(username, 'Username')) errors.username = validateRequired(username, 'Username');
  if (validateRequired(password, 'Password')) errors.password = validateRequired(password, 'Password');
  if (!errors.password && password.length < 6) errors.password = 'Password must be at least 6 characters.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const sql = 'INSERT INTO users (password, username, role) VALUES (?, ?, ?)';
    const result = await dbRun(db, sql, [hash, username, role]);
    return {
      success: true,
      data: { id: result.lastID, username, role },
    };
  } catch (dbErr) {
    if (dbErr.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'Username already exists.' };
    }
    console.error('Add User DB Run Error:', dbErr);
    return { success: false, error: dbErr.message };
  }
}

// MODIFIED: Use structured error return
async function resetUserPassword(id, newPassword) {
  const db = getDatabase();
  // --- Validation ---
  const errors = {};
  if (validateRequired(newPassword, 'New Password')) errors.newPassword = validateRequired(newPassword, 'New Password');
  if (!errors.newPassword && newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---
  
  try {
    const hash = await bcrypt.hash(newPassword, saltRounds);
    const sql = 'UPDATE users SET password = ? WHERE id = ?';
    const result = await dbRun(db, sql, [hash, id]);
    
    if (result.changes === 0) {
      return { success: false, error: 'User not found.' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Use structured error return
async function changeMyPassword(id, oldPassword, newPassword) {
  const db = getDatabase();
  // --- Validation ---
  const errors = {};
  if (validateRequired(newPassword, 'New Password')) errors.newPassword = validateRequired(newPassword, 'New Password');
  if (!errors.newPassword && newPassword.length < 6) errors.newPassword = 'New Password must be at least 6 characters.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  try {
    const row = await dbGet(db, 'SELECT password FROM users WHERE id = ?', [id]);
    if (!row) return { success: false, error: 'User not found.' };

    const match = await bcrypt.compare(oldPassword, row.password);
    if (!match) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const hash = await bcrypt.hash(newPassword, saltRounds);
    await dbRun(db, 'UPDATE users SET password = ? WHERE id = ?', [hash, id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteUser(idToDelete, selfId) {
    const db = getDatabase();
    if (selfId === idToDelete) {
      return { success: false, error: 'Validation Failed: You cannot delete your own account.' };
    }
    if (idToDelete === 1) {
      return { success: false, error: 'Validation Failed: Cannot delete the primary Super Admin account.' };
    }
  
    try {
      const row = await dbGet(db, 'SELECT username FROM users WHERE id = ?', [idToDelete]);
      if (!row) {
        return { success: false, error: 'User not found.' };
      }
      
      const deletedUsername = row.username;
      const sql = 'DELETE FROM users WHERE id = ?';
      const result = await dbRun(db, sql, [idToDelete]);
      if (result.changes === 0) {
        return { success: false, error: 'User not found.' };
      }
      
      return { success: true, deletedId: idToDelete, deletedUsername: deletedUsername };
    } catch (err) {
        return { success: false, error: err.message };
    }
}


// ====================================================================
// 3. DASHBOARD & REPORTING
// ====================================================================


async function getReportingData(user, filters = {}) {
  // CRITICAL FIX: If user is missing (i.e., passed null before auth fully loads), 
  // immediately return an empty success object to prevent the checkAdminFeatureAccess 
  // call from failing. The frontend will show 'Loading' until user is defined.
  if (!user || !user.role) {
    return { success: true, data: {} }; 
  }

  const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const db = getDatabase();
  const { status, employer } = filters;
  
  const runQuery = (sql, params = []) => dbAll(db, sql, params);
  // --- 1. Build Base Filters for Candidates ---
  // This logic will be appended to queries related to candidates.
  let candidateWhereClause = ' WHERE c.isDeleted = 0 ';
  const candidateParams = [];
  // This JOIN is only needed if filtering by employer
  let employerJoinClause = '';
  if (status) {
    candidateWhereClause += ' AND c.status = ? ';
    candidateParams.push(status);
  }
  
  if (employer) {
    // We must join candidates to placements, then jobs, to find the employer
    employerJoinClause = `
      JOIN placements pl ON pl.candidate_id = c.id
      JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
    `;
    candidateWhereClause += ' AND j_filter.employer_id = ? ';
    candidateParams.push(employer);
  }

  // --- 2. Build Base Filters for Payments (which are linked to candidates) ---
  let paymentWhereClause = ' WHERE p.isDeleted = 0 AND c.isDeleted = 0 ';
  const paymentParams = [];
  let paymentEmployerJoinClause = '';

  if (status) {
    paymentWhereClause += ' AND c.status = ? ';
    paymentParams.push(status);
  }

  if (employer) {
    paymentEmployerJoinClause = `
      JOIN placements pl ON pl.candidate_id = c.id
      JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
    `;
    paymentWhereClause += ' AND j_filter.employer_id = ? ';
    paymentParams.push(employer);
  }

  try {
    // --- 3. Execute Queries with Filters ---

    // Total Candidates (Filtered)
    const totalCandidatesRows = await runQuery(
      `SELECT COUNT(DISTINCT c.id) as count 
       FROM candidates c 
       ${employerJoinClause} 
       ${candidateWhereClause}`,
      candidateParams
    );
    const totalCandidates = totalCandidatesRows[0]?.count || 0;
    
    // Total Employers (Global - Unfiltered)
    const totalEmployersRows = await runQuery('SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0');
    const totalEmployers = totalEmployersRows[0]?.count || 0;

    // Open Jobs (Filtered by Employer if provided)
    let openJobsSql = "SELECT SUM(openingsCount) as count FROM job_orders WHERE status = 'Open' AND isDeleted = 0";
    const openJobsParams = [];
    if (employer) {
      openJobsSql += ' AND employer_id = ?';
      openJobsParams.push(employer);
    }
    const openJobsRows = await runQuery(openJobsSql, openJobsParams);
    const openJobs = openJobsRows[0]?.count || 0;
    // Candidates by Status (Filtered)
    const candidatesByStatus = await runQuery(
      `SELECT c.status, COUNT(DISTINCT c.id) as count 
       FROM candidates c 
       ${employerJoinClause} 
       ${candidateWhereClause} 
       GROUP BY c.status`,
      candidateParams
    );
    // Top Positions (Filtered)
    const topPositions = await runQuery(
      `SELECT c.Position, COUNT(DISTINCT c.id) as count 
       FROM candidates c 
       ${employerJoinClause} 
       ${candidateWhereClause} 
       AND c.Position IS NOT NULL AND c.Position != '' 
       GROUP BY c.Position 
       ORDER BY count DESC 
       LIMIT 5`,
      candidateParams
    );

    const totalDueRows = await runQuery(
      `SELECT SUM(T1.total) as total 
       FROM (
            SELECT DISTINCT p.id, p.total_amount AS total
            FROM payments p 
            JOIN candidates c ON p.candidate_id = c.id 
            ${paymentEmployerJoinClause} 
            ${paymentWhereClause}
       ) AS T1`,
      paymentParams
    );
    const totalDue = totalDueRows[0]?.total || 0;
    
    const totalPaidRows = await runQuery(
      `SELECT SUM(T2.total_paid) as total 
       FROM (
            SELECT DISTINCT p.id, p.amount_paid AS total_paid
            FROM payments p 
            JOIN candidates c ON p.candidate_id = c.id 
            ${paymentEmployerJoinClause} 
            ${paymentWhereClause}
       ) AS T2`,
      paymentParams
    );
    const totalPaid = totalPaidRows[0]?.total || 0;
    const totalPending = totalDue - totalPaid;
    // Top Pending Candidates (Filtered)
    const topPendingCandidates = await runQuery(
      `SELECT 
         c.name, 
         SUM(p.total_amount - p.amount_paid) as pendingBalance
       FROM payments p
       JOIN candidates c ON p.candidate_id = c.id
       ${paymentEmployerJoinClause}
       ${paymentWhereClause}
       AND p.status IN ('Pending', 'Partial')
       GROUP BY c.id, c.name
       HAVING pendingBalance > 0
       ORDER BY pendingBalance DESC
       LIMIT 5
     `, paymentParams);
    // --- 4. Return Data ---
    return {
      success: true,
      data: {
        totalCandidates, totalEmployers, openJobs, candidatesByStatus,
        topPositions, totalDue, totalPaid, totalPending, topPendingCandidates
      }
    };
  } catch (err) {
    console.error("Error in getReportingData query:", err.message);
    return { success: false, error: err.message };
  }
}

async function getDetailedReportList(user, filters = {}) {
  const accessCheck = await checkAdminFeatureAccess(user, 'canViewReports');
  if (!accessCheck.success) return accessCheck; 
  
  const db = getDatabase();
  const { status, employer } = filters;
  
  // CRITICAL FIX: The base query must group by candidate ID first, 
  // and the JOINs must be optional (LEFT) to include unassigned candidates.
  let sql = `
    SELECT 
      c.id, c.name, c.passportNo, c.Position, c.status,
      e.companyName,
      COALESCE(SUM(p.total_amount), 0) as totalDue,
      COALESCE(SUM(p.amount_paid), 0) as totalPaid
    FROM candidates c
    
    -- NOTE: Placements and Jobs must be LEFT JOINs to ensure all candidates are included
    LEFT JOIN placements pl ON pl.candidate_id = c.id AND pl.isDeleted = 0
    LEFT JOIN job_orders j ON pl.job_order_id = j.id
    LEFT JOIN employers e ON j.employer_id = e.id
    LEFT JOIN payments p ON p.candidate_id = c.id AND p.isDeleted = 0
    
    WHERE c.isDeleted = 0
  `;
  const params = [];
  
  // --- Filtering Logic ---
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  
  if (employer) {
    // If filtering by employer, we must restrict the job/employer JOIN results
    // This part ensures only candidates linked to that employer are selected.
    sql += ' AND e.id = ?';
    params.push(employer);
  }
  
  // --- Final Aggregation ---
  sql += ' GROUP BY c.id ORDER BY c.name ASC';
  
  try {
    const rows = await dbAll(db, sql, params);
    return { success: true, data: rows };
  } catch (err) {
    console.error("Detailed Report Query Error (Final Fix):", err.message);
    return { success: false, error: err.message };
  }
}
// ==================================================

// ====================================================================
// 4. CANDIDATE MANAGEMENT
// ====================================================================

async function createCandidate(data) {
  const db = getDatabase();
  // // --- NEW: Centralized Validation ---
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);

  // CRITICAL FIX: Clean the Passport Number (remove spaces, convert to uppercase)
  const cleanPassportNo = data.passportNo ? 
      data.passportNo.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

  if (validateRequired(data.name, 'Name')) errors.name = validateRequired(data.name, 'Name');

  if (validateRequired(data.Position, 'Position')) errors.Position = validateRequired(data.Position, 'Position');

  if (validateRequired(cleanPassportNo, 'Passport No')) {
    errors.passportNo = validateRequired(cleanPassportNo, 'Passport No');
  } else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) {
    // This regex checks the cleaned data.
    errors.passportNo = 'Passport No must be 6-15 letters or numbers (no special characters).';
  }

  if (data.aadhar) {
      if (!/^\d{12}$/.test(data.aadhar)) {
          errors.aadhar = 'Aadhar must be exactly 12 digits.';
      } 
      // --- TEMPORARILY DISABLED FOR BULK IMPORT TESTING ---
      // else if (!validateVerhoeff(data.aadhar)) {
      //    errors.aadhar = 'Invalid Aadhaar Number (Checksum failed). Please check for typos.';
      // }
      // ----------------------------------------------------
  }


  if (data.contact && !/^\d{10}$/.test(data.contact)) {
    errors.contact = 'Contact must be exactly 10 digits.';
  }
  // Note: We check if experience exists before validating positive number
  if (data.experience && validatePositiveNumber(data.experience, 'Experience')) {
    errors.experience = validatePositiveNumber(data.experience, 'Experience');
  }
  
  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
  // if (expiryDate <= today) errors.passportExpiry = 'Passport Expiry must be in the future.';
  if (expiryDate <= today) errors.passportExpiry = 'Passport Expiry must be in the future.';
  }
  if (data.dob) {
    const dobDate = new Date(data.dob).getTime();
  // if (dobDate >= today) errors.dob = 'Date of Birth must be in the past.';
  if (dobDate >= today) errors.dob = 'Date of Birth must be in the past.';
  }
  // --- End of new validation ---

  try {
    // Check for duplicates before checking other errors
    let checkSql = 'SELECT passportNo, aadhar FROM candidates WHERE (passportNo = ?';
    const params = [data.passportNo];
    
    if (data.aadhar) {
        checkSql += ' OR aadhar = ?';
        params.push(data.aadhar);
    }
    checkSql += ') AND isDeleted = 0';
    // const existing = await dbGet(db, checkSql, params);
    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      if (existing.passportNo === data.passportNo) {
        errors.passportNo = `Passport No ${data.passportNo} already exists.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        errors.aadhar = `Aadhar No ${data.aadhar} already exists.`;
      }
    }

    // --- NEW: Return all validation errors if any exist ---
    if (Object.keys(errors).length > 0) {
      return { success: false, error: "Validation failed", errors: errors };
    }

    const sqlCandidate = `INSERT INTO candidates 
      (name, education, experience, dob, passportNo, passportExpiry, contact, aadhar, status, notes, Position) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const paramsCandidate = [
      data.name, data.education, data.experience, data.dob,
      cleanPassportNo, // <--- USE THE CLEANED PASSPORT NUMBER FOR STORAGE
      data.passportExpiry, data.contact,
      data.aadhar, data.status || 'New', data.notes || '',
      data.Position,
    ];
    
    const result = await dbRun(db, sqlCandidate, paramsCandidate);
    return { success: true, id: result.lastID };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Locate async function getSystemAuditLog(params) { ... }
async function getSystemAuditLog(user, params) {
  const accessCheck = await checkAdminFeatureAccess(user, 'canAccessSettings');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const db = getDatabase();
  // CRITICAL FIX: Destructure flattened parameters directly from params
  const { userFilter, actionFilter, limit, offset } = params;
  
  let baseQuery = 'FROM audit_log';
  // CRITICAL FIX: Initialize the parameter array once and clearly
  const dynamicParams = [];
  
  // --- Build Dynamic WHERE Clause ---
  let conditions = [];
  
  if (userFilter) {
      conditions.push('username LIKE ?');
      dynamicParams.push(`%${userFilter}%`);
  }
  if (actionFilter) {
      // Search across action, target_type, or details
      conditions.push('(action LIKE ? OR target_type LIKE ? OR details LIKE ?)');
      dynamicParams.push(`%${actionFilter}%`, `%${actionFilter}%`, `%${actionFilter}%`);
  }
  
  if (conditions.length > 0) {
      baseQuery += ' WHERE ' + conditions.join(' AND ');
  }
  
  try {
      // 1. Get Total Count (uses the dynamicParams array)
      const countRow = await dbGet(db, `SELECT COUNT(*) as totalCount ${baseQuery}`, dynamicParams);
      const totalCount = countRow.totalCount;

      // 2. Get Paginated Logs
      let fetchQuery = `SELECT * ${baseQuery} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
      
      // Final parameters: [ ...dynamicParams, limit, offset ]
      const finalParams = [...dynamicParams, limit, offset]; // Correctly concatenate limit/offset
      const rows = await dbAll(db, fetchQuery, finalParams);

      return { success: true, data: rows, totalCount: totalCount };
    } catch (err) {
        console.error('System Audit Log Query Error (Critical):', err.message);
        // Return detailed error for internal debugging
        return { success: false, error: "Database query failed. Please check server console." }; 
    }
}

async function getAuditLogForCandidate(candidateId) {
  const db = getDatabase();
  try {
    const sql = `
      SELECT * FROM audit_log
      WHERE (target_type = 'candidates' AND target_id = ?) 
         OR (details LIKE ?)
      ORDER BY timestamp DESC
    `;
    const likeQuery = `%Candidate: ${candidateId}%`;
    const rows = await dbAll(db, sql, [candidateId, likeQuery]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function searchCandidates(searchTerm, status, position, limit, offset) {
  const db = getDatabase();
  let baseQuery = 'FROM candidates WHERE isDeleted = 0';
  const params = [];
  const countParams = [];
  if (searchTerm) {
    baseQuery += ` 
        AND (
            name LIKE ? OR 
            passportNo LIKE ? OR 
            contact LIKE ? OR 
            aadhar LIKE ? OR 
            Position LIKE ? OR
            education LIKE ?
        )`;
    const term = `%${searchTerm}%`;
    // Pushes the search term for every criteria (6 total)
    params.push(term, term, term, term, term, term);
    countParams.push(term, term, term, term, term, term);
  }
  if (status) {
    baseQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (position) {
    baseQuery += ' AND Position LIKE ?';
    params.push(`%${position}%`);
    countParams.push(`%${position}%`);
  }
  
  try {
    const countRow = await dbGet(db, `SELECT COUNT(*) as totalCount ${baseQuery}`, countParams);
    const totalCount = countRow.totalCount;

    let fetchQuery = `SELECT * ${baseQuery} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const rows = await dbAll(db, fetchQuery, params);
    return { success: true, data: rows, totalCount: totalCount };
  } catch (err) {
    console.error('Search query error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getCandidateDetails(id) {
  const db = getDatabase();
  try {
    const candidate = await dbGet(db, 'SELECT * FROM candidates WHERE id = ? AND isDeleted = 0', [id]);
    if (!candidate) {
      return { success: false, error: 'Candidate not found.' };
    }
    const documents = await dbAll(db, 'SELECT * FROM documents WHERE candidate_id = ? AND isDeleted = 0 ORDER BY category, fileName', [id]);
    return { success: true, data: { candidate, documents } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Uses structured error return for all validation/duplicate failures
async function updateCandidateText(id, data) {
  const db = getDatabase();
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.name, 'Candidate Name')) errors.name = validateRequired(data.name, 'Candidate Name');
  if (validateRequired(data.passportNo, 'Passport No')) errors.passportNo = validateRequired(data.passportNo, 'Passport No');
  if (validateRequired(data.Position, 'Position')) errors.Position = validateRequired(data.Position, 'Position');
  if (Object.keys(errors).length > 0) {
      return { success: false, error: "Validation failed", errors: errors };
  }
  // --- End Validation ---

  try {
    let checkSql = 'SELECT passportNo, aadhar FROM candidates WHERE (passportNo = ?';
    const errors = {}; // Re-initialize errors for duplicates check
    const params = [data.passportNo];
    
    if (data.aadhar) {
        checkSql += ' OR aadhar = ?';
        params.push(data.aadhar);
    }
    checkSql += ') AND isDeleted = 0 AND id != ?';
    params.push(id);

    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      if (existing.passportNo === data.passportNo) {
        errors.passportNo = `Passport No ${data.passportNo} already exists for another candidate.`;
      }
      if (data.aadhar) {
      if (!/^\d{12}$/.test(data.aadhar)) {
          errors.aadhar = 'Aadhar must be exactly 12 digits.';
      } else if (!validateVerhoeff(data.aadhar)) {
          errors.aadhar = 'Invalid Aadhaar Number (Checksum failed). Please check for typos.';
      }
  }
      if (Object.keys(errors).length > 0) {
        return { success: false, error: "Duplicate field value detected.", errors: errors };
      }
    }

    const sql = `UPDATE candidates SET
      name = ?, education = ?, experience = ?, dob = ?, 
      passportNo = ?, passportExpiry = ?, contact = ?, aadhar = ?,
      status = ?, notes = ?, Position = ?
      WHERE id = ?`;
    const updateParams = [
      data.name, data.education, data.experience, data.dob,
      data.passportNo, data.passportExpiry, data.contact, data.aadhar,
      data.status, data.notes, data.Position, id,
    ];
    await dbRun(db, sql, updateParams);
    return { success: true };

  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
       return { success: false, error: `A unique field (like Passport) already exists.`, field: 'passportNo' };
    }
    return { success: false, error: err.message };
  }
}

async function deleteCandidate(id) {
  const db = getDatabase();
  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    await dbRun(db, 'UPDATE candidates SET isDeleted = 1 WHERE id = ?', [id]);
    await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE visa_tracking SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE payments SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE medical_tracking SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE interview_tracking SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'UPDATE travel_tracking SET isDeleted = 1 WHERE candidate_id = ?', [id]);
    await dbRun(db, 'COMMIT');
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return { success: false, error: err.message };
  }
}

async function deleteDocument(docId) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, fileName FROM documents WHERE id = ?', [docId]);
      if (!row) {
          return { success: false, error: 'Document not found.' };
      }
      await dbRun(db, 'UPDATE documents SET isDeleted = 1 WHERE id = ?', [docId]);
      return { success: true, candidateId: row.candidate_id, fileName: row.fileName };
  } catch (err) {
      return { success: false, error: err.message };
  }
}

async function updateDocumentCategory(docId, category) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, fileName FROM documents WHERE id = ?', [docId]);
      if (!row) {
          return { success: false, error: 'Document not found.' };
      }
      const sql = `UPDATE documents SET category = ? WHERE id = ?`;
      await dbRun(db, sql, [category, docId]);
      return { success: true, candidateId: row.candidate_id, fileName: row.fileName };
  } catch (err) {
      return { success: false, error: err.message };
  }
}

// ====================================================================
// 5. EMPLOYER MANAGEMENT
// ====================================================================

async function getEmployers() {
  const db = getDatabase();
  try {
    const rows = await dbAll(db, 'SELECT * FROM employers WHERE isDeleted = 0 ORDER BY companyName ASC', []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Use structured error return
async function addEmployer(user, data) {
  // --- Validation ---
  const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const errors = {};
  if (validateRequired(data.companyName, 'Company Name')) errors.companyName = validateRequired(data.companyName, 'Company Name');
  if (data.contactEmail && !validateEmail(data.contactEmail)) errors.contactEmail = 'Contact Email must be valid.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const sql = `INSERT INTO employers (companyName, country, contactPerson, contactEmail, notes) 
               VALUES (?, ?, ?, ?, ?)`;
  const params = [
    data.companyName, data.country, data.contactPerson,
    data.contactEmail, data.notes,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const newId = result.lastID;
    return { success: true, id: newId, data: { ...data, id: newId } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Use structured error return
async function updateEmployer(user, id, data) {
  // --- Validation ---
  const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const errors = {};
  if (validateRequired(data.companyName, 'Company Name')) errors.companyName = validateRequired(data.companyName, 'Company Name');
  if (data.contactEmail && !validateEmail(data.contactEmail)) errors.contactEmail = 'Contact Email must be valid.';
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const sql = `UPDATE employers SET 
               companyName = ?, country = ?, contactPerson = ?, contactEmail = ?, notes = ?
               WHERE id = ?`;
  const params = [
    data.companyName, data.country, data.contactPerson,
    data.contactEmail, data.notes, id,
  ];
  try {
    await dbRun(db, sql, params);
    return { success: true, id: id, data: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteEmployer(user, id) {
  const accessCheck = await checkAdminFeatureAccess(user, 'isEmployersEnabled');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled

  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    await dbRun(db, 'UPDATE employers SET isDeleted = 1 WHERE id = ?', [id]);
    await dbRun(db, 'UPDATE job_orders SET isDeleted = 1 WHERE employer_id = ?', [id]);
    await dbRun(db, 'COMMIT');
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    return { success: false, error: err.message };
  }
}

// ====================================================================
// 6. JOB ORDER MANAGEMENT
// ====================================================================

async function getJobOrders() {
  const db = getDatabase();
  try {
    const sql = `
      SELECT 
        j.*, 
        e.companyName 
      FROM job_orders j
      LEFT JOIN employers e ON j.employer_id = e.id
      WHERE j.isDeleted = 0
      ORDER BY j.createdAt DESC
    `;
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Use structured error return
async function addJobOrder(user, data) {
  // 1. Permission Check
  const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
  if (!accessCheck.success) return accessCheck;

  // 2. Validation
  const errors = {};
  if (validateRequired(data.employer_id, 'Employer ID')) errors.employer_id = 'Employer is required.';
  if (validateRequired(data.positionTitle, 'Position Title')) errors.positionTitle = 'Position Title is required.';
  // Validate openings
  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1) errors.openingsCount = 'Openings must be at least 1.';

  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

  // 3. Database Insert
  const db = getDatabase(); // <--- FIXED: Added missing db definition
  const sql = `INSERT INTO job_orders (employer_id, positionTitle, country, openingsCount, status, requirements) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.employer_id, data.positionTitle, data.country,
    data.openingsCount, data.status, data.requirements,
  ];

  try {
    const result = await dbRun(db, sql, params);
    const newJobId = result.lastID;
    
    // Fetch and return the new row with joined employer name
    const getSql = `
      SELECT j.*, e.companyName 
      FROM job_orders j
      LEFT JOIN employers e ON j.employer_id = e.id
      WHERE j.id = ?
    `;
    const row = await dbGet(db, getSql, [newJobId]);
    return { success: true, id: newJobId, data: row };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function updateJobOrder(user, id, data) {
  // 1. Permission Check
  const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
  if (!accessCheck.success) return accessCheck;

  // 2. Validation
  const errors = {};
  if (!data.employer_id) errors.employer_id = 'Employer is required.';
  if (!data.positionTitle) errors.positionTitle = 'Position Title is required.';
  
  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1) errors.openingsCount = 'Openings must be at least 1.';

  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };

  // 3. Database Update
  const db = getDatabase();
  
  // CRITICAL: Ensure the SQL string strictly uses valid column names.
  const sql = `UPDATE job_orders SET 
               employer_id = ?, positionTitle = ?, country = ?, openingsCount = ?, status = ?, requirements = ?
               WHERE id = ?`;
               
  const params = [
    data.employer_id, 
    data.positionTitle, 
    data.country,
    data.openingsCount, 
    data.status, 
    data.requirements, 
    id, // ID is the last parameter
  ];

  try {
    await dbRun(db, sql, params);
    
    // Fetch updated row to return to UI
    const getSql = `
      SELECT j.*, e.companyName 
      FROM job_orders j
      LEFT JOIN employers e ON j.employer_id = e.id
      WHERE j.id = ?
    `;
    const row = await dbGet(db, getSql, [id]);
    return { success: true, id: id, data: row };
  } catch (err) {
    console.error("Update Job Error:", err.message);
    return { success: false, error: err.message };
  }
}

async function deleteJobOrder(user, id) {
  // 1. Permission Check
  const accessCheck = await checkAdminFeatureAccess(user, 'isJobsEnabled');
  if (!accessCheck.success) return accessCheck;

  const db = getDatabase();

  try {
    await dbRun(db, 'BEGIN TRANSACTION');
    
    // Soft delete the job order
    // CRITICAL: Ensure we use 'isDeleted', NOT 'user' or any other invalid column
    await dbRun(db, 'UPDATE job_orders SET isDeleted = 1 WHERE id = ?', [id]);
    
    // Soft delete associated placements
    await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE job_order_id = ?', [id]);
    
    await dbRun(db, 'COMMIT');
    return { success: true };
  } catch (err) {
    await dbRun(db, 'ROLLBACK');
    console.error("Delete Job Error:", err.message);
    return { success: false, error: err.message };
  }
}
// ====================================================================
// 7. PLACEMENT & SUB-MODULES
// ====================================================================

// === NEW: PASSPORT TRACKING QUERIES (INJECTED) ===

async function getPassportTracking(candidateId) {
    const db = getDatabase();
    const sql = `SELECT * FROM passport_tracking 
                 WHERE candidate_id = ? AND isDeleted = 0 
                 ORDER BY createdAt DESC`;
    try {
        const rows = await dbAll(db, sql, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addPassportEntry(data) {
    // --- Validation ---
    const errors = {};
    if (data.passport_status === 'Received' && !data.received_date) errors.received_date = 'Received Date is required when status is "Received".';
    if (data.passport_status === 'Dispatched' && !data.dispatch_date) errors.dispatch_date = 'Dispatch Date is required when status is "Dispatched".';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
    // --- End Validation ---

    const db = getDatabase();
    const sql = `INSERT INTO passport_tracking 
                 (candidate_id, received_date, received_notes, dispatch_date, docket_number, 
                  dispatch_notes, passport_status, source_type, agent_contact)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
        data.candidate_id, data.received_date || null, data.received_notes || null,
        data.dispatch_date || null, data.docket_number || null, data.dispatch_notes || null,
        data.passport_status, data.source_type, data.agent_contact || null,
    ];
    try {
        const result = await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM passport_tracking WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

// NOTE: No update/delete implemented yet, as a dispatch record is usually immutable.
async function getCandidatePlacements(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      p.id as placementId, p.status as placementStatus,
      j.id as jobId, j.positionTitle, 
      e.companyName, e.country
    FROM placements p
    JOIN job_orders j ON p.job_order_id = j.id
    JOIN employers e ON j.employer_id = e.id
    WHERE p.candidate_id = ? AND p.isDeleted = 0
  `;
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) {
      return { success: false, error: err.message };
  }
}

async function getUnassignedJobs(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT 
      j.id, j.positionTitle, 
      e.companyName, e.country
    FROM job_orders j
    JOIN employers e ON j.employer_id = e.id
    WHERE j.isDeleted = 0 AND j.id NOT IN (
      SELECT job_order_id FROM placements WHERE candidate_id = ? AND isDeleted = 0
    )
    ORDER BY e.companyName, j.positionTitle
  `;
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) {
      return { success: false, error: err.message };
  }
}

async function assignCandidateToJob(candidateId, jobId) {
  const db = getDatabase();
  const sql = `INSERT INTO placements (candidate_id, job_order_id) VALUES (?, ?)`;
  try {
      const result = await dbRun(db, sql, [candidateId, jobId]);
      const newPlacementId = result.lastID;
      const getSql = `
        SELECT 
          p.id as placementId, p.status as placementStatus,
          j.id as jobId, j.positionTitle, 
          e.companyName, e.country
        FROM placements p
        JOIN job_orders j ON p.job_order_id = j.id
        JOIN employers e ON j.employer_id = e.id
        WHERE p.id = ?
      `;
      const row = await dbGet(db, getSql, [newPlacementId]);
      return { success: true, data: row };
  } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
          return { success: false, error: 'Candidate already assigned to this job.' };
      }
      return { success: false, error: err.message };
  }
}

async function removeCandidateFromJob(placementId) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, job_order_id FROM placements WHERE id = ?', [placementId]);
      if (!row) {
          return { success: false, error: 'Placement not found.' };
      }
      await dbRun(db, 'UPDATE placements SET isDeleted = 1 WHERE id = ?', [placementId]);
      return { success: true, candidateId: row.candidate_id, jobId: row.job_order_id };
  } catch (err) {
      return { success: false, error: err.message };
  }
}

// MODIFIED: Use structured error return
async function getVisaTracking(candidateId) {
  const db = getDatabase();
  const sql = `SELECT * FROM visa_tracking WHERE candidate_id = ?
    AND isDeleted = 0 ORDER BY application_date DESC`;
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

// // MODIFIED: Use structured error return
async function addVisaEntry(data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.country, 'Country')) errors.country = validateRequired(data.country, 'Country');
  if (validateRequired(data.application_date, 'Application Date')) errors.application_date = validateRequired(data.application_date, 'Application Date');
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  // FINAL CLEAN SQL
  const sql = `INSERT INTO visa_tracking (candidate_id, country, visa_type, application_date, status, notes,
               position, passport_number, travel_date, contact_type, agent_contact)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id, data.country, data.visa_type || null,
    data.application_date, data.status, data.notes || null,
    data.position || null, data.passport_number || null, data.travel_date || null,
    data.contact_type, data.agent_contact || null,
  ];

  try {
      const result = await dbRun(db, sql, params);
      const row = await dbGet(db, 'SELECT * FROM visa_tracking WHERE id = ?', [result.lastID]);
      return { success: true, data: row };
  } catch (err) { 
      console.error("addVisaEntry DB Error:", err.message);
  // Ensure the error message includes the original SQL error detail
      return { success: false, error: err.message || "Database execution failed during INSERT." };
  }
}

async function updateVisaEntry(id, data) {
    // --- Validation (Retained) ---
    const errors = {};
    if (validateRequired(data.country, 'Country')) errors.country = validateRequired(data.country, 'Country');
    if (validateRequired(data.application_date, 'Application Date')) errors.application_date = validateRequired(data.application_date, 'Application Date');
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
    // --- End Validation ---

    const db = getDatabase();
    
    // CRITICAL FIX: Clean SQL string.
    // Notes, position, and travel_date are often null.
    const sql = `UPDATE visa_tracking SET 
               country = ?, visa_type = ?, application_date = ?, status = ?, notes = ?,
               position = ?, passport_number = ?, travel_date = ?, contact_type = ?, agent_contact = ?
               WHERE id = ? AND isDeleted = 0`;
    
    const params = [
        data.country, data.visa_type, data.application_date,
        data.status, data.notes,
        data.position, data.passport_number, data.travel_date, data.contact_type, data.agent_contact,
        id,
    ];
    try {
        const result = await dbRun(db, sql, params);
        if (result.changes === 0) {
            return { success: false, error: 'Visa entry not found or already deleted.' };
        }
        
        // Fetch the updated row
        const updatedRow = await dbGet(db, 'SELECT * FROM visa_tracking WHERE id = ?', [id]);
        return { success: true, data: updatedRow };
    } catch (err) { 
        return { success: false, error: err.message };
    }
}

async function deleteVisaEntry(id) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, country FROM visa_tracking WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Entry not found.' };
      await dbRun(db, 'UPDATE visa_tracking SET isDeleted = 1 WHERE id = ?', [id]);
      return { success: true, candidateId: row.candidate_id, country: row.country };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function getMedicalTracking(candidateId) {
  const db = getDatabase();
  const sql = 'SELECT * FROM medical_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY test_date DESC';
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function addMedicalEntry(data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.test_date, 'Test Date')) errors.test_date = validateRequired(data.test_date, 'Test Date');

  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `INSERT INTO medical_tracking (candidate_id, test_date, certificate_path, status, notes)
               VALUES (?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id, data.test_date, data.certificate_path,
    data.status, data.notes,
  ];
  try {
      const result = await dbRun(db, sql, params);
      const row = await dbGet(db, 'SELECT * FROM medical_tracking WHERE id = ?', [result.lastID]);
      return { success: true, data: row };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function updateMedicalEntry(id, data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.test_date, 'Test Date')) errors.test_date = validateRequired(data.test_date, 'Test Date');
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `UPDATE medical_tracking SET 
               test_date = ?, certificate_path = ?, status = ?, notes = ?
               WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.test_date, data.certificate_path || null, data.status, data.notes || null, id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
        return { success: false, error: 'Medical entry not found or already deleted.' };
    }
    const updatedRow = await dbGet(db, 'SELECT * FROM medical_tracking WHERE id = ?', [id]);
    return { success: true, data: updatedRow };
  } catch (err) { return { success: false, error: err.message }; }
}

async function deleteMedicalEntry(id) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, test_date, status FROM medical_tracking WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Entry not found.' };
      await dbRun(db, 'UPDATE medical_tracking SET isDeleted = 1 WHERE id = ?', [id]);
      return { success: true, candidateId: row.candidate_id, test_date: row.test_date, status: row.status };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function getTravelTracking(candidateId) {
  const db = getDatabase();
  const sql = 'SELECT * FROM travel_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY travel_date DESC';
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function addTravelEntry(data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.travel_date, 'Travel Date')) errors.travel_date = validateRequired(data.travel_date, 'Travel Date');
  if (validateRequired(data.departure_city, 'Departure City')) errors.departure_city = validateRequired(data.departure_city, 'Departure City');
  if (validateRequired(data.arrival_city, 'Arrival City')) errors.arrival_city = validateRequired(data.arrival_city, 'Arrival City');

  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `INSERT INTO travel_tracking (candidate_id, pnr, travel_date, ticket_file_path, departure_city, arrival_city, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id, data.pnr || null, data.travel_date,
    data.ticket_file_path || null, data.departure_city || null,
    data.arrival_city || null, data.notes || null,
  ];
  try {
      const result = await dbRun(db, sql, params);
      const row = await dbGet(db, 'SELECT * FROM travel_tracking WHERE id = ?', [result.lastID]);
      return { success: true, data: row };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function updateTravelEntry(id, data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.travel_date, 'Travel Date')) errors.travel_date = validateRequired(data.travel_date, 'Travel Date');
  if (validateRequired(data.departure_city, 'Departure City')) errors.departure_city = validateRequired(data.departure_city, 'Departure City');
  if (validateRequired(data.arrival_city, 'Arrival City')) errors.arrival_city = validateRequired(data.arrival_city, 'Arrival City');

  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `UPDATE travel_tracking SET 
               pnr = ?, travel_date = ?, ticket_file_path = ?, departure_city = ?, arrival_city = ?, notes = ?
               WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.pnr || null, data.travel_date, data.ticket_file_path || null, data.departure_city, 
    data.arrival_city, data.notes || null, id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
        return { success: false, error: 'Travel entry not found or already deleted.' };
    }
    const updatedRow = await dbGet(db, 'SELECT * FROM travel_tracking WHERE id = ?', [id]);
    return { success: true, data: updatedRow };
  } catch (err) { return { success: false, error: err.message }; }
}

async function deleteTravelEntry(id) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, travel_date FROM travel_tracking WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Entry not found.' };
      await dbRun(db, 'UPDATE travel_tracking SET isDeleted = 1 WHERE id = ?', [id]);
      return { success: true, candidateId: row.candidate_id, travel_date: row.travel_date };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function getInterviewTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT i.*, j.positionTitle, e.companyName
    FROM interview_tracking i
    LEFT JOIN job_orders j ON i.job_order_id = j.id
    LEFT JOIN employers e ON j.employer_id = e.id
    WHERE i.candidate_id = ? AND i.isDeleted = 0
    ORDER BY i.interview_date DESC
  `;
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function addInterviewEntry(data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.job_order_id, 'Job Order')) errors.job_order_id = validateRequired(data.job_order_id, 'Job Order');
  if (validateRequired(data.interview_date, 'Interview Date')) errors.interview_date = validateRequired(data.interview_date, 'Interview Date');
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `INSERT INTO interview_tracking (candidate_id, job_order_id, interview_date, round, status, notes)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id, data.job_order_id, data.interview_date,
    data.round, data.status, data.notes,
  ];
  try {
      const result = await dbRun(db, sql, params);
      const getSql = `
        SELECT i.*, j.positionTitle, e.companyName
        FROM interview_tracking i
        LEFT JOIN job_orders j ON i.job_order_id = j.id
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE i.id = ?
      `;
      const row = await dbGet(db, getSql, [result.lastID]);
      return { success: true, data: row };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function updateInterviewEntry(id, data) {
  // --- Validation ---
  const errors = {};
  if (validateRequired(data.job_order_id, 'Job Order')) errors.job_order_id = validateRequired(data.job_order_id, 'Job Order');
  if (validateRequired(data.interview_date, 'Interview Date')) errors.interview_date = validateRequired(data.interview_date, 'Interview Date');
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `UPDATE interview_tracking SET 
               job_order_id = ?, interview_date = ?, round = ?, status = ?, notes = ?
               WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.job_order_id, data.interview_date, data.round || null, data.status, data.notes || null, id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
        return { success: false, error: 'Interview entry not found or already deleted.' };
    }
    // Fetch the updated row, including joined job/employer details for the UI
    const getSql = `
        SELECT i.*, j.positionTitle, e.companyName
        FROM interview_tracking i
        LEFT JOIN job_orders j ON i.job_order_id = j.id
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE i.id = ?
    `;
    const updatedRow = await dbGet(db, getSql, [id]);
    return { success: true, data: updatedRow };
  } catch (err) { return { success: false, error: err.message }; }
}

async function deleteInterviewEntry(id) {
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, interview_date, round FROM interview_tracking WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Entry not found.' };
      await dbRun(db, 'UPDATE interview_tracking SET isDeleted = 1 WHERE id = ?', [id]);
      return { success: true, candidateId: row.candidate_id, interview_date: row.interview_date, round: row.round };
  } catch (err) { return { success: false, error: err.message }; }
}

// ====================================================================
// 9. FINANCIAL TRACKING
// ====================================================================

async function getCandidatePayments(candidateId) {
  const db = getDatabase();
  const sql = `SELECT * FROM payments WHERE candidate_id = ? AND isDeleted = 0 ORDER BY created_at DESC`;
  try {
      const rows = await dbAll(db, sql, [candidateId]);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

// MODIFIED: Use structured error return
async function addPayment(user, data) {
  // --- Validation ---
  const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const errors = {};
  if (validateRequired(data.description, 'Description')) errors.description = validateRequired(data.description, 'Description');
  if (validateRequired(data.total_amount, 'Total Amount')) errors.total_amount = validateRequired(data.total_amount, 'Total Amount');
  // Overwrite if general error was already set
  if (!errors.total_amount && validatePositiveNumber(data.total_amount, 'Total Amount')) errors.total_amount = validatePositiveNumber(data.total_amount, 'Total Amount');
  if (data.amount_paid && validatePositiveNumber(data.amount_paid, 'Amount Paid')) errors.amount_paid = validatePositiveNumber(data.amount_paid, 'Amount Paid');
  if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
  // --- End Validation ---

  const db = getDatabase();
  const sql = `INSERT INTO payments (candidate_id, description, total_amount, amount_paid, status, due_date)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id, data.description, data.total_amount,
    data.amount_paid, data.status, data.due_date,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [result.lastID]);
    return { success: true, data: row };
  } catch (err) { return { success: false, error: err.message }; }
}

// This file is likely located at ../db/queries.cjs

// Assuming helper functions like validatePositiveNumber are imported/available
// and dbGet/dbRun are available (or imported/destructured from getDatabase())

async function updatePayment(data) {
   const { user, id, total_amount, amount_paid, status } = data; // Destructure user
   
    const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
    if (!accessCheck.success) return accessCheck; // Block if feature disabled
    
    // 💥 CRITICAL FIX: Initialize the errors object here!
    const errors = {};
    
    // --- Validation ---
    if (!id) errors.id = 'Payment ID is required.';
    if (total_amount !== undefined && total_amount !== null) {
        const parsedTotal = parseFloat(total_amount);
    // Assuming validatePositiveNumber is a helper that returns a string error or null/undefined
        if (isNaN(parsedTotal) || parsedTotal <= 0) {
            errors.total_amount = 'Total Amount must be a positive number.';
        }
    }

    // Assuming you have access to a validation helper function 'validatePositiveNumber'
    if (amount_paid !== undefined && amount_paid !== null) {
        const parsedPaid = parseFloat(amount_paid);
        if (isNaN(parsedPaid) || parsedPaid < 0) {
            errors.amount_paid = 'Amount Paid must be a valid non-negative number.';
        }
    } else {
        // NOTE: Keeping this validation for the modal scenario where amount_paid is required.
        errors.amount_paid = 'Amount Paid value is required for update.';
    }

    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors: errors };
    // --- End Validation ---
    
    const db = getDatabase();
    try {
        const row = await dbGet(db, 'SELECT candidate_id, description FROM payments WHERE id = ?', [id]);
        if (!row) return { success: false, error: 'Payment not found.' };
        // The values passed to SQL must be null if they are undefined/null in JS, 
        // allowing COALESCE to use the existing DB value.
        const totalValue = total_amount === undefined || total_amount === null ? null : parseFloat(total_amount);
        const paidValue = amount_paid === undefined || amount_paid === null ? null : parseFloat(amount_paid);
        const sql = `UPDATE payments SET 
                         total_amount = COALESCE(?, total_amount),
                         amount_paid = COALESCE(?, amount_paid), 
                         status = COALESCE(?, status) 
                         WHERE id = ?`;
        // Note: paidValue is used here.
        await dbRun(db, sql, [totalValue, paidValue, status, id]);
        const updatedRow = await dbGet(db, 'SELECT * FROM payments WHERE id = ?', [id]);
        return { success: true, data: updatedRow, candidateId: row.candidate_id, description: row.description };
    } catch (err) { 
        return { success: false, error: err.message || 'Database execution failed.' }; 
    }
}

async function deletePayment(user, id) {
  const accessCheck = await checkAdminFeatureAccess(user, 'isFinanceTrackingEnabled');
  if (!accessCheck.success) return accessCheck; // Block if feature disabled
  
  const db = getDatabase();
  try {
      const row = await dbGet(db, 'SELECT candidate_id, description, total_amount FROM payments WHERE id = ?', [id]);
      if (!row) return { success: false, error: 'Payment not found.' };
      await dbRun(db, 'UPDATE payments SET isDeleted = 1 WHERE id = ?', [id]);
      return { success: true, candidateId: row.candidate_id, description: row.description, total_amount: row.total_amount };
  } catch (err) { return { success: false, error: err.message }; }
}

// ====================================================================
// 10. RECYCLE BIN MANAGEMENT
// ====================================================================

async function getDeletedCandidates() {
  const db = getDatabase();
  const sql = 'SELECT id, name, Position, createdAt, isDeleted FROM candidates WHERE isDeleted = 1 ORDER BY createdAt DESC';
  try {
      const rows = await dbAll(db, sql, []);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

async function restoreCandidate(id) {
  const db = getDatabase();
  try {
      await dbRun(db, 'BEGIN TRANSACTION');
      await dbRun(db, 'UPDATE candidates SET isDeleted = 0 WHERE id = ?', [id]);
      await dbRun(db, 'UPDATE documents SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE placements SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE visa_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE payments SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE medical_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE interview_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'UPDATE travel_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'COMMIT');
      return { success: true };
  } catch (err) {
      await dbRun(db, 'ROLLBACK');
      return { success: false, error: err.message };
  }
}

async function getDeletedEmployers() {
  const db = getDatabase();
  const sql = 'SELECT * FROM employers WHERE isDeleted = 1 ORDER BY companyName ASC';
  try {
      const rows = await dbAll(db, sql, []);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

async function restoreEmployer(id) {
  const db = getDatabase();
  try {
      await dbRun(db, 'BEGIN TRANSACTION');
      await dbRun(db, 'UPDATE employers SET isDeleted = 0 WHERE id = ?', [id]);
      await dbRun(db, 'UPDATE job_orders SET isDeleted = 0 WHERE employer_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'COMMIT');
      return { success: true };
  } catch (err) {
      await dbRun(db, 'ROLLBACK');
      return { success: false, error: err.message };
  }
}

async function getDeletedJobOrders() {
  const db = getDatabase();
  const sql = `
    SELECT j.*, e.companyName 
    FROM job_orders j
    LEFT JOIN employers e ON j.employer_id = e.id
    WHERE j.isDeleted = 1 
    ORDER BY j.positionTitle ASC
  `;
  try {
      const rows = await dbAll(db, sql, []);
      return { success: true, data: rows };
  } catch (err) { return { success: false, error: err.message }; }
}

async function restoreJobOrder(id) {
  const db = getDatabase();
  try {
      await dbRun(db, 'BEGIN TRANSACTION');
      await dbRun(db, 'UPDATE job_orders SET isDeleted = 0 WHERE id = ?', [id]);
      await dbRun(db, 'UPDATE placements SET isDeleted = 0 WHERE job_order_id = ? AND isDeleted = 1', [id]);
      await dbRun(db, 'COMMIT');
      return { success: true };
  } catch (err) {
      await dbRun(db, 'ROLLBACK');
      return { success: false, error: err.message };
  }
}

async function deletePermanently(id, targetType) {
  const db = getDatabase();
  let sql;
  let identifier;

  switch (targetType) {
    case 'candidates':
      sql = 'DELETE FROM candidates WHERE id = ?';
      identifier = 'candidate';
      break;
    case 'employers':
      sql = 'DELETE FROM employers WHERE id = ?';
      identifier = 'employer';
      break;
    case 'job_orders':
      sql = 'DELETE FROM job_orders WHERE id = ?';
      identifier = 'job order';
      break;
    default:
      return { success: false, error: 'Invalid target type for permanent deletion.' };
  }

  try {
    const result = await dbRun(db, sql, [id]);
    if (result.changes === 0) {
      return { success: false, error: `${identifier} not found.` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getRequiredDocuments() {
    const db = getDatabase();
    try {
        const rows = await dbAll(db, 'SELECT * FROM required_documents WHERE isDeleted = 0 ORDER BY name ASC', []);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message }; }
}

async function addRequiredDocument(name) {
    const db = getDatabase();
    if (!name || name.trim() === '') {
        return { success: false, error: 'Document name is required.' };
    }
    try {
        const result = await dbRun(db, 'INSERT INTO required_documents (name) VALUES (?)', [name]);
        const row = await dbGet(db, 'SELECT * FROM required_documents WHERE id = ?', [result.lastID]);
        return { success: true, data: row };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return { success: false, error: 'Document name already exists.' };
        }
        return { success: false, error: err.message };
    }
}

async function deleteRequiredDocument(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'UPDATE required_documents SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
}


// ====================================================================
// 11. LICENSING/ACTIVATION FUNCTIONS (NEW)
// ====================================================================

async function getActivationStatus() {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'license_status'", []);
        if (row && row.value) {
            return { success: true, status: JSON.parse(row.value) };
        }
        // Default to not activated on clean install
        return { success: true, status: { activated: false, machineId: null } }; 
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function setActivationStatus(statusData) {
    const db = getDatabase();
    const statusJson = JSON.stringify(statusData);
    return new Promise((resolve, reject) => {
        db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', ?)", [statusJson], (err) => {
            if (err) reject(err);
            else resolve({ success: true });
        });
    });
}

// --- NEW: PASSPORT CRUD HELPERS ---
async function updatePassportEntry(id, data) {
    const db = getDatabase();
    
    // Validation
    const errors = {};
    if (data.passport_status === 'Received' && !data.received_date) errors.received_date = 'Received Date is required.';
    if (data.passport_status === 'Dispatched' && !data.dispatch_date) errors.dispatch_date = 'Dispatch Date is required.';
    if (Object.keys(errors).length > 0) return { success: false, error: "Validation failed", errors };

    const sql = `UPDATE passport_tracking SET 
                 received_date = ?, received_notes = ?, dispatch_date = ?, docket_number = ?, 
                 dispatch_notes = ?, passport_status = ?, source_type = ?, agent_contact = ?
                 WHERE id = ? AND isDeleted = 0`;
                 
    const params = [
        data.received_date || null, data.received_notes || null,
        data.dispatch_date || null, data.docket_number || null, data.dispatch_notes || null,
        data.passport_status, data.source_type, data.agent_contact || null,
        id
    ];

    try {
        await dbRun(db, sql, params);
        const row = await dbGet(db, 'SELECT * FROM passport_tracking WHERE id = ?', [id]);
        return { success: true, data: row };
    } catch (err) { return { success: false, error: err.message }; }
}

async function deletePassportEntry(id) {
    const db = getDatabase();
    try {
        await dbRun(db, 'UPDATE passport_tracking SET isDeleted = 1 WHERE id = ?', [id]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
}

// --- KANBAN BOARD FUNCTIONS ---

// 1. Get All Active Visas (Fixed isDeleted Logic)
async function getAllActiveVisas() {
  const db = getDatabase();
  const sql = `
    SELECT 
      v.id, v.candidate_id, v.country, v.visa_type, v.status, v.application_date,
      c.name as candidateName, 
      c.passportNo
    FROM visa_tracking v
    JOIN candidates c ON v.candidate_id = c.id
    WHERE v.isDeleted = 0 AND c.isDeleted = 0
    ORDER BY v.application_date DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 2. Update Visa Status (Used by Drag & Drop)
async function updateVisaStatus(id, status) {
  const db = getDatabase();
  try {
    // Update status directly
    await dbRun(db, 'UPDATE visa_tracking SET status = ? WHERE id = ?', [status, id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function logCommunication(user, candidateId, type, details) {
    const db = getDatabase();
    try {
        await dbRun(db, 'INSERT INTO communication_logs (candidate_id, user_id, type, details) VALUES (?, ?, ?, ?)', 
            [candidateId, user.id, type, details]);
        return { success: true };
    } catch (err) { return { success: false, error: err.message };
    }
}

async function getCommLogs(candidateId) {
    const db = getDatabase();
    try {
        const rows = await dbAll(db, `
            SELECT c.*, u.username 
            FROM communication_logs c 
            LEFT JOIN users u ON c.user_id = u.id 
            WHERE c.candidate_id = ? ORDER BY c.timestamp DESC`, [candidateId]);
        return { success: true, data: rows };
    } catch (err) { return { success: false, error: err.message };
    }
}

const saveDocumentFromApi = async ({ candidateId, user, fileData }) => {
    const filesDir = path.join(app.getPath('userData'), 'candidate_files');
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    
    try {
        const db = getDatabase();
        const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
        const uniqueName = `${uuidv4()}${path.extname(fileData.fileName)}`;
        const newFilePath = path.join(filesDir, uniqueName);
        
        fs.writeFileSync(newFilePath, Buffer.from(fileData.buffer));
        const result = await dbRun(db, sqlDoc, [
            candidateId, fileData.fileType, fileData.fileName, newFilePath, fileData.category
        ]);
        return { success: true, documentId: result.lastID };
    } catch (err) {
        console.error('saveDocumentFromApi error:', err.message);
        return { success: false, error: err.message };
    }
};

async function getCanonicalUserContext(userId) {
    const db = getDatabase();
    try {
        const sql = 'SELECT id, username, role FROM users WHERE id = $1';
        const row = await dbGet(db, sql, [userId]);
        
        if (!row) {
            return { success: false, error: 'User not found.' };
        }
        
        return { success: true, user: { 
            id: row.id, 
            username: row.username, 
            role: row.role 
        }};
    } catch (err) {
        return { success: false, error: err.message };
    }
}

const proxyRequest = async (user, method, endpoint, data = null, params = {}) => {
    try {
        const lookup = await getCanonicalUserContext(user.id);
        if (!lookup.success) {
            return { success: false, error: 'Authentication Failed: Invalid User ID.' };
        }
        const canonicalUser = lookup.user;

        const headers = {
            'Authorization': `Bearer ${canonicalUser.id}:${canonicalUser.role}`, 
            'User-Context': JSON.stringify(canonicalUser) 
        };
        const url = `${API_URL_BASE}${endpoint}`;

        const config = {
            method: method.toLowerCase(),
            url: url,
            headers: headers,
            params: params,
            data: data
        };
        const response = await axios(config);
        return response.data;

    } catch (error) {
        console.error(`Remote API Error (${method} ${endpoint}):`, error.response?.data?.error || error.message);
        return { success: false, error: error.response?.data?.error || 'Could not connect to remote API.' };
    }
};

// [NEW] Securely get or create the JWT Secret
async function getJwtSecret() {
  const db = getDatabase();
  try {
    const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'jwt_secret'", []);
    if (row && row.value) return row.value;

    const newSecret = require('crypto').randomBytes(64).toString('hex');
    await dbRun(db, "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('jwt_secret', ?)", [newSecret]);
    return newSecret;
  } catch (err) {
    console.error('JWT Secret Error:', err);
    return 'fallback_secret_change_me_immediately'; 
  }
}

// [NEW] Securely verify Activation Key
async function verifyActivationKey(inputKey) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, "SELECT value FROM system_settings WHERE key = 'master_activation_key'", []);
    const validKey = row ? row.value : '74482'; 
    return inputKey === validKey;
  } catch (err) {
    return false;
  }
}

// [NEW] Optimized Dashboard Stats
async function getDashboardStats() {
    const db = getDatabase();
    try {
        const counts = await dbGet(db, `
            SELECT 
                (SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL) as candidates,
                (SELECT COUNT(*) FROM job_orders WHERE status = 'Open' AND IsDeleted IS NULL) as jobs,
                (SELECT COUNT(*) FROM employers WHERE deleted_at IS NULL) as employers,
                (SELECT COUNT(*) FROM candidates WHERE status = 'New' AND IsDeleted IS NULL) as newCandidates
        `, []);
        return { success: true, data: counts };
    } catch (err) {
        return { success: false, error: err.message };
    }
}


module.exports = {
  // DB Helpers
  dbRun,
  dbGet,
  dbAll,

  // User & Auth Functions
  getJwtSecret, // [NEW]
  verifyActivationKey, // [NEW]
  getCanonicalUserContext,
  updatePassportEntry, 
  deletePassportEntry, 
  proxyRequest,
  login,
  saveDocumentFromApi,
  registerNewUser,
  getUserPermissions,
  saveUserPermissions,
  getAllUsers,
  addUser,
  resetUserPassword,
  changeMyPassword,
  deleteUser,

  // Reports & Dashboard
  getReportingData,
  getDashboardStats, // [NEW]
  getSystemAuditLog,
  getDetailedReportList,

  // Candidate & Docs
  createCandidate,
  getAuditLogForCandidate,
  searchCandidates,
  getCandidateDetails,
  updateCandidateText,
  deleteCandidate,
  deleteDocument,
  updateDocumentCategory,
  
  // Employers & Jobs
  getEmployers,
  addEmployer,
  updateEmployer,
  deleteEmployer,
  getJobOrders,
  addJobOrder,
  updateJobOrder,
  deleteJobOrder,
  getCandidatePlacements,
  getUnassignedJobs,
  assignCandidateToJob,
  removeCandidateFromJob,
  
  // Sub-Modules & Tracking
  getAllActiveVisas, // [NEW]
  updateVisaStatus,  // [NEW]
  getVisaTracking,
  getPassportTracking,
  addPassportEntry,
  updateVisaEntry,
  addVisaEntry,
  deleteVisaEntry,
  getMedicalTracking,
  updateMedicalEntry,
  addMedicalEntry,
  deleteMedicalEntry,
  getTravelTracking,
  updateTravelEntry,
  addTravelEntry,
  deleteTravelEntry,
  getInterviewTracking,
  updateInterviewEntry,
  addInterviewEntry,
  deleteInterviewEntry,
  getDeletedJobOrders,
  restoreJobOrder,

  // Financial
  getCandidatePayments,
  addPayment,
  updatePayment,
  deletePayment,
  getRequiredDocuments,
  addRequiredDocument,
  deleteRequiredDocument,

  // Recycle Bin
  getDeletedCandidates,
  restoreCandidate,
  getDeletedEmployers,
  restoreEmployer,
  getDeletedJobOrders,
  restoreJobOrder,
  deletePermanently,

  // System & Utils
  getActivationStatus, 
  setActivationStatus, 
  getSuperAdminFeatureFlags,
  logCommunication,
  getCommLogs,
};