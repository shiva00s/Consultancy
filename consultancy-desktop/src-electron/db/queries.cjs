const { getDatabase } = require("../db/database.cjs");
const { validateVerhoeff } = require("../utils/validators.cjs");
const bcrypt = require("bcrypt");
const saltRounds = 10;

// ====================================================================
// --- VALIDATION HELPERS ---
// ====================================================================

const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Returns only the clean error message string
const validateRequired = (field, name) => {
  if (!field || (typeof field === "string" && field.trim() === "")) {
    return `${name} is required.`;
  }
  return null;
};

// Returns only the clean error message string
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
// LOCAL FRIENDLY ERROR MAPPER (for toast messages)
// ====================================================================
function mapErrorToFriendly(err) {
  if (!err) return "Unexpected error occurred.";

  const msg = typeof err === "string" ? err : (err.message || err.toString());

  // UNIQUE / CONSTRAINT
  if (msg.includes("SQLITE_CONSTRAINT") || msg.includes("UNIQUE constraint")) {
    if (
      msg.includes("placements.candidate_id") ||
      msg.includes("candidate_id, job_order_id")
    ) {
      return "This candidate is already assigned to that job.";
    }
    if (msg.toLowerCase().includes("passport")) {
      return "Duplicate passport number found.";
    }
    if (msg.toLowerCase().includes("aadhar")) {
      return "Duplicate Aadhar number found.";
    }
    if (msg.toLowerCase().includes("contact")) {
      return "Duplicate contact number found.";
    }
    if (msg.toLowerCase().includes("username")) {
      return "Username already exists.";
    }
    return "Duplicate entry found. Please check your details.";
  }

  // Validation
  if (msg.toLowerCase().includes("validation failed")) {
    return "Some fields need correction. Please review your input.";
  }

  // Not found
  if (msg.toLowerCase().includes("not found")) {
    return "Record not found.";
  }

  // Database generic
  if (msg.includes("SQLITE_ERROR") || msg.toLowerCase().includes("database")) {
    return "Database error. Please try again.";
  }

  // Typical undefined access
  if (msg.includes("Cannot read properties of undefined")) {
    return "Data loading error. Please refresh the page.";
  }

  // Too long messages
  if (msg.length > 150) {
    return "An error occurred. Please try again.";
  }

  return msg.replace(/^Error:\s*/i, "").trim();
}

// ====================================================================
// 2. USER MANAGEMENT & AUTHENTICATION
// ====================================================================

// Function to fetch the SA's global feature flags (used as the policy ceiling)
async function getSuperAdminFeatureFlags() {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1",
      [],
    );
    if (row && row.features) {
      return { success: true, data: JSON.parse(row.features) };
    }
    return { success: true, data: {} };
    // Default to empty if not configured
  } catch (err) {
    console.error("getSAFlags DB Error:", err.message);
    return {
      success: false,
      error: mapErrorToFriendly("Failed to retrieve global policy flags."),
    };
  }
}

// --- NEW FUNCTION: Enforces Delegation for Admin & Staff (Replaces checkAdminFeatureAccess for CRUD) ---
async function checkUserDelegatedAccess(user, featureKey) {
  if (!user || user.role === "super_admin") return { success: true };

  // 1. Get the global ceiling (SA's policy)
  const ceilingRes = await getSuperAdminFeatureFlags();
  if (!ceilingRes.success || !ceilingRes.data[featureKey]) {
    return {
      success: false,
      error: mapErrorToFriendly(
        `Access Denied: Global policy has disabled feature "${featureKey}".`,
      ),
    };
  }

  if (user.role === "admin" || user.role === "staff") {
    // 2. Get the user's specific delegated flags
    const delegatedRes = await getUserPermissions(user.id);
    const delegatedFlags = delegatedRes.data || {};

    // 3. Delegation Check: If the user's delegated flags explicitly enable it, allow.
    if (delegatedFlags[featureKey] === true) {
      return { success: true };
    }

    // 4. Default Block: If no specific delegation is found (or it's false), block access.
    return {
      success: false,
      error: mapErrorToFriendly(
        `Access Denied: You do not have delegated permission for "${featureKey}".`,
      ),
    };
  }

  return {
    success: false,
    error: mapErrorToFriendly("Access Denied: Invalid user role."),
  };
}

async function checkAdminFeatureAccess(user, featureKey) {
  if (featureKey === "canViewReports" || featureKey === "canAccessSettings") {
    return checkUserDelegatedAccess(user, featureKey);
  }
  return checkUserDelegatedAccess(user, featureKey);
}

async function getUserPermissions(userId) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT flags FROM user_permissions WHERE user_id = ?",
      [userId],
    );
    return { success: true, data: row ? JSON.parse(row.flags) : null };
  } catch (err) {
    console.error("getUserPermissions DB Error:", err.message);
    return {
      success: false,
      error: mapErrorToFriendly("Failed to retrieve user permissions."),
    };
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
    console.error("saveUserPermissions DB Error:", err.message);
    return {
      success: false,
      error: mapErrorToFriendly("Failed to save user permissions."),
    };
  }
}

async function login(username, password) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT id, password, role, username FROM users WHERE username = ?",
      [username],
    );
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("Invalid username or password."),
      };
    }
    const match = await bcrypt.compare(password, row.password);
    if (match) {
      return {
        success: true,
        id: row.id,
        username: row.username,
        role: row.role,
      };
    } else {
      return {
        success: false,
        error: mapErrorToFriendly("Invalid username or password."),
      };
    }
  } catch (err) {
    console.error("Login Error:", err.message);
    return {
      success: false,
      error: mapErrorToFriendly("A database or password error occurred."),
    };
  }
}

// MODIFIED: Use structured error return
async function registerNewUser(username, password, role) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(username, "Username"))
    errors.username = validateRequired(username, "Username");
  if (validateRequired(password, "Password"))
    errors.password = validateRequired(password, "Password");
  if (!errors.password && password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
    const result = await dbRun(db, sql, [username, hash, role]);

    return {
      success: true,
      data: { id: result.lastID, username, role },
    };
  } catch (dbErr) {
    if (dbErr.message.includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: mapErrorToFriendly("Username already exists."),
      };
    }
    console.error("Registration DB Run Error:", dbErr);
    return { success: false, error: mapErrorToFriendly(dbErr) };
  }
}

async function getAllUsers() {
  const db = getDatabase();
  try {
    const sql = "SELECT id, username, role FROM users ORDER BY username ASC";
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    console.error("get-all-users DB Error:", err);
    return {
      success: false,
      error: mapErrorToFriendly("Failed to fetch existing users."),
    };
  }
}

// MODIFIED: Use structured error return
async function addUser(username, password, role) {
  const db = getDatabase();
  if (callingUser.role === "admin") {
    if (role !== "staff") {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Access Denied: Admins can only create Staff accounts.",
        ),
      };
    }
  } else if (callingUser.role === "staff") {
    return {
      success: false,
      error: mapErrorToFriendly("Access Denied: Staff cannot add new users."),
    };
  }
  const errors = {};
  if (validateRequired(username, "Username"))
    errors.username = validateRequired(username, "Username");
  if (validateRequired(password, "Password"))
    errors.password = validateRequired(password, "Password");
  if (!errors.password && password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    const sql = "INSERT INTO users (password, username, role) VALUES (?, ?, ?)";
    const result = await dbRun(db, sql, [hash, username, role]);
    return {
      success: true,
      data: { id: result.lastID, username, role },
    };
  } catch (dbErr) {
    if (dbErr.message.includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: mapErrorToFriendly("Username already exists."),
      };
    }
    console.error("Add User DB Run Error:", dbErr);
    return { success: false, error: mapErrorToFriendly(dbErr) };
  }
}

// MODIFIED: Use structured error return
async function resetUserPassword(id, newPassword) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(newPassword, "New Password"))
    errors.newPassword = validateRequired(newPassword, "New Password");
  if (!errors.newPassword && newPassword.length < 6)
    errors.newPassword = "Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  try {
    const hash = await bcrypt.hash(newPassword, saltRounds);
    const sql = "UPDATE users SET password = ? WHERE id = ?";
    const result = await dbRun(db, sql, [hash, id]);

    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly("User not found."),
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// MODIFIED: Use structured error return
async function changeMyPassword(id, oldPassword, newPassword) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(newPassword, "New Password"))
    errors.newPassword = validateRequired(newPassword, "New Password");
  if (!errors.newPassword && newPassword.length < 6)
    errors.newPassword = "New Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  try {
    const row = await dbGet(db, "SELECT password FROM users WHERE id = ?", [
      id,
    ]);
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("User not found."),
      };

    const match = await bcrypt.compare(oldPassword, row.password);
    if (!match) {
      return {
        success: false,
        error: mapErrorToFriendly("Incorrect current password."),
      };
    }

    const hash = await bcrypt.hash(newPassword, saltRounds);
    await dbRun(db, "UPDATE users SET password = ? WHERE id = ?", [hash, id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteUser(idToDelete, selfId) {
  const db = getDatabase();
  if (selfId === idToDelete) {
    return {
      success: false,
      error: mapErrorToFriendly(
        "You cannot delete your own account.",
      ),
    };
  }
  if (idToDelete === 1) {
    return {
      success: false,
      error: mapErrorToFriendly(
        "Cannot delete the primary Super Admin account.",
      ),
    };
  }

  try {
    const row = await dbGet(db, "SELECT username FROM users WHERE id = ?", [
      idToDelete,
    ]);
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("User not found."),
      };
    }

    const deletedUsername = row.username;
    const sql = "DELETE FROM users WHERE id = ?";
    const result = await dbRun(db, sql, [idToDelete]);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly("User not found."),
      };
    }

    return {
      success: true,
      deletedId: idToDelete,
      deletedUsername: deletedUsername,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ====================================================================
// 3. DASHBOARD & REPORTING
// ====================================================================

async function getReportingData(user, filters = {}) {
  if (!user || !user.role) {
    return { success: true, data: {} };
  }

  const accessCheck = await checkAdminFeatureAccess(user, "canViewReports");
  if (!accessCheck.success) {
    return {
      success: false,
      error: mapErrorToFriendly(accessCheck.error),
    };
  }

  const db = getDatabase();
  const { status, employer } = filters;
  const runQuery = (sql, params = []) => dbAll(db, sql, params);

  let candidateWhereClause = " WHERE c.isDeleted = 0 ";
  const candidateParams = [];
  let employerJoinClause = "";
  if (status) {
    candidateWhereClause += " AND c.status = ? ";
    candidateParams.push(status);
  }

  if (employer) {
    employerJoinClause = `
      JOIN placements pl ON pl.candidate_id = c.id
      JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
    `;
    candidateWhereClause += " AND j_filter.employer_id = ? ";
    candidateParams.push(employer);
  }

  let paymentWhereClause = " WHERE p.isDeleted = 0 AND c.isDeleted = 0 ";
  const paymentParams = [];
  let paymentEmployerJoinClause = "";

  if (status) {
    paymentWhereClause += " AND c.status = ? ";
    paymentParams.push(status);
  }

  if (employer) {
    paymentEmployerJoinClause = `
      JOIN placements pl ON pl.candidate_id = c.id
      JOIN job_orders j_filter ON j_filter.id = pl.job_order_id
    `;
    paymentWhereClause += " AND j_filter.employer_id = ? ";
    paymentParams.push(employer);
  }

  try {
    const totalCandidatesRows = await runQuery(
      `SELECT COUNT(DISTINCT c.id) as count
       FROM candidates c
       ${employerJoinClause}
       ${candidateWhereClause}`,
      candidateParams,
    );
    const totalCandidates = totalCandidatesRows[0]?.count || 0;

    const totalEmployersRows = await runQuery(
      "SELECT COUNT(*) as count FROM employers WHERE isDeleted = 0",
    );
    const totalEmployers = totalEmployersRows[0]?.count || 0;

    let openJobsSql =
      "SELECT COALESCE(SUM(openingsCount), 0) as count FROM job_orders WHERE status = 'Open' AND isDeleted = 0";
    const openJobsParams = [];
    if (employer) {
      openJobsSql += " AND employer_id = ?";
      openJobsParams.push(employer);
    }

    const openJobsRow = await dbGet(db, openJobsSql, openJobsParams);
    const openJobs = openJobsRow?.count || 0;

    const candidatesByStatus = await runQuery(
      `SELECT c.status, COUNT(DISTINCT c.id) as count
       FROM candidates c
       ${employerJoinClause}
       ${candidateWhereClause}
       GROUP BY c.status`,
      candidateParams,
    );
    const topPositions = await runQuery(
      `SELECT c.Position, COUNT(DISTINCT c.id) as count
       FROM candidates c
       ${employerJoinClause}
       ${candidateWhereClause}
       AND c.Position IS NOT NULL AND c.Position != ''
       GROUP BY c.Position
       ORDER BY count DESC
       LIMIT 5`,
      candidateParams,
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
      paymentParams,
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
      paymentParams,
    );
    const totalPaid = totalPaidRows[0]?.total || 0;
    const totalPending = totalDue - totalPaid;

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
     `,
      paymentParams,
    );

    return {
      success: true,
      data: {
        totalCandidates,
        totalEmployers,
        openJobs,
        candidatesByStatus,
        topPositions,
        totalDue,
        totalPaid,
        totalPending,
        topPendingCandidates,
      },
    };
  } catch (err) {
    console.error("Error in getReportingData query:", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getDetailedReportList(user, filters = {}) {
  const accessCheck = await checkAdminFeatureAccess(user, "canViewReports");
  if (!accessCheck.success) {
    return {
      success: false,
      error: mapErrorToFriendly(accessCheck.error),
    };
  }
  const db = getDatabase();
  const { status, employer } = filters;

  let sql = `
    SELECT
      c.id, c.name, c.passportNo, c.Position, c.status,c.contact,
      e.companyName,
      COALESCE(SUM(p.total_amount), 0) as totalDue,
      COALESCE(SUM(p.amount_paid), 0) as totalPaid
    FROM candidates c
    LEFT JOIN placements pl ON pl.candidate_id = c.id AND pl.isDeleted = 0
    LEFT JOIN job_orders j ON pl.job_order_id = j.id
    LEFT JOIN employers e ON j.employer_id = e.id
    LEFT JOIN payments p ON p.candidate_id = c.id AND p.isDeleted = 0
    WHERE c.isDeleted = 0
  `;
  const params = [];

  if (status) {
    sql += " AND c.status = ?";
    params.push(status);
  }

  if (employer) {
    sql += " AND e.id = ?";
    params.push(employer);
  }

  sql += " GROUP BY c.id ORDER BY c.name ASC";
  try {
    const rows = await dbAll(db, sql, params);
    return { success: true, data: rows };
  } catch (err) {
    console.error("Detailed Report Query Error (Final Fix):", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ====================================================================
// 4. CANDIDATE MANAGEMENT
// ====================================================================

async function createCandidate(data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);

  const cleanPassportNo = data.passportNo
    ? data.passportNo.trim().replace(/[^A-Z0-9]/gi, "").toUpperCase()
    : "";

  if (validateRequired(data.name, "Name"))
    errors.name = validateRequired(data.name, "Name");

  if (validateRequired(data.Position, "Position"))
    errors.Position = validateRequired(data.Position, "Position");

  if (validateRequired(cleanPassportNo, "Passport No")) {
    errors.passportNo = validateRequired(cleanPassportNo, "Passport No");
  } else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) {
    errors.passportNo =
      "Passport No must be 6-15 letters or numbers (no special characters).";
  }

  if (data.aadhar) {
    if (!/^\d{12}$/.test(data.aadhar)) {
      errors.aadhar = "Aadhar must be exactly 12 digits.";
    }
  }

  if (data.contact && !/^\d{10}$/.test(data.contact)) {
    errors.contact = "Contact must be exactly 10 digits.";
  }

  if (
    data.experience &&
    validatePositiveNumber(data.experience, "Experience")
  ) {
    errors.experience = validatePositiveNumber(data.experience, "Experience");
  }

  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (expiryDate <= today)
      errors.passportExpiry = "Passport Expiry must be in the future.";
  }
  if (data.dob) {
    const dobDate = new Date(data.dob).getTime();
    if (dobDate >= today) errors.dob = "Date of Birth must be in the past.";
  }

  try {
    let checkSql =
      "SELECT passportNo, aadhar FROM candidates WHERE (passportNo = ?";
    const params = [data.passportNo];

    if (data.aadhar) {
      checkSql += " OR aadhar = ?";
      params.push(data.aadhar);
    }
    checkSql += ") AND isDeleted = 0";
    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      if (existing.passportNo === data.passportNo) {
        errors.passportNo = `Passport No ${data.passportNo} already exists.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        errors.aadhar = `Aadhar No ${data.aadhar} already exists.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        error: mapErrorToFriendly("Validation failed"),
        errors: errors,
      };
    }

    const sqlCandidate = `INSERT INTO candidates
      (name, education, experience, dob, passportNo, passportExpiry, contact, aadhar, status, notes, Position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const paramsCandidate = [
      data.name,
      data.education,
      data.experience,
      data.dob,
      cleanPassportNo,
      data.passportExpiry,
      data.contact,
      data.aadhar,
      data.status || "New",
      data.notes || "",
      data.Position,
    ];
    const result = await dbRun(db, sqlCandidate, paramsCandidate);
    return { success: true, id: result.lastID };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getSystemAuditLog(user, params) {
  const accessCheck = await checkAdminFeatureAccess(user, "canAccessSettings");
  if (!accessCheck.success)
    return {
      success: false,
      error: mapErrorToFriendly(accessCheck.error),
    };

  const db = getDatabase();
  const { userFilter, actionFilter, limit, offset } = params;
  let baseQuery = "FROM audit_log";
  const dynamicParams = [];
  let conditions = [];
  if (userFilter) {
    conditions.push("username LIKE ?");
    dynamicParams.push(`%${userFilter}%`);
  }
  if (actionFilter) {
    conditions.push("(action LIKE ? OR target_type LIKE ? OR details LIKE ?)");
    dynamicParams.push(
      `%${actionFilter}%`,
      `%${actionFilter}%`,
      `%${actionFilter}%`,
    );
  }

  if (conditions.length > 0) {
    baseQuery += " WHERE " + conditions.join(" AND ");
  }

  try {
    const countRow = await dbGet(
      db,
      `SELECT COUNT(*) as totalCount ${baseQuery}`,
      dynamicParams,
    );
    const totalCount = countRow.totalCount;

    let fetchQuery = `SELECT * ${baseQuery} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    const finalParams = [...dynamicParams, limit, offset];
    const rows = await dbAll(db, fetchQuery, finalParams);
    return { success: true, data: rows, totalCount: totalCount };
  } catch (err) {
    console.error("System Audit Log Query Error (Critical):", err.message);
    return {
      success: false,
      error: mapErrorToFriendly(
        "Database query failed. Please check server console.",
      ),
    };
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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function searchCandidates(searchTerm, status, position, limit, offset) {
  const db = getDatabase();
  let baseQuery = "FROM candidates WHERE isDeleted = 0";
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
    params.push(term, term, term, term, term, term);
    countParams.push(term, term, term, term, term, term);
  }
  if (status) {
    baseQuery += " AND status = ?";
    params.push(status);
    countParams.push(status);
  }
  if (position) {
    baseQuery += " AND Position LIKE ?";
    params.push(`%${position}%`);
    countParams.push(`%${position}%`);
  }

  try {
    const countRow = await dbGet(
      db,
      `SELECT COUNT(*) as totalCount ${baseQuery}`,
      countParams,
    );
    const totalCount = countRow.totalCount;

    let fetchQuery = `SELECT * ${baseQuery} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const rows = await dbAll(db, fetchQuery, params);
    return { success: true, data: rows, totalCount: totalCount };
  } catch (err) {
    console.error("Search query error:", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getCandidateDetails(id) {
  const db = getDatabase();
  try {
    const candidate = await dbGet(
      db,
      "SELECT * FROM candidates WHERE id = ? AND isDeleted = 0",
      [id],
    );
    if (!candidate) {
      return {
        success: false,
        error: mapErrorToFriendly("Candidate not found."),
      };
    }
    const documents = await dbAll(
      db,
      "SELECT * FROM documents WHERE candidate_id = ? AND isDeleted = 0 ORDER BY category, fileName",
      [id],
    );
    return { success: true, data: { candidate, documents } };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateCandidateText(user, id, data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);

  const cleanPassportNo = data.passportNo
    ? data.passportNo.trim().replace(/[^A-Z0-9]/gi, "").toUpperCase()
    : "";

  const nameValidation = validateRequired(data.name, "Candidate Name");
  if (nameValidation) errors.name = nameValidation;

  if (validateRequired(data.education, "Education"))
    errors.education = validateRequired(data.education, "Education");
  const educationValidation = validateRequired(data.education, "Education");
  if (educationValidation) errors.education = educationValidation;

  const positionValidation = validateRequired(data.Position, "Position");
  if (positionValidation) errors.Position = positionValidation;

  const passportRequiredValidation = validateRequired(
    cleanPassportNo,
    "Passport No",
  );
  if (passportRequiredValidation) {
    errors.passportNo = passportRequiredValidation;
  } else if (!/^[A-Z0-9]{6,15}$/.test(cleanPassportNo)) {
    errors.passportNo =
      "Passport No must be 6-15 letters or numbers (no special characters).";
  }

  if (data.contact && !/^\d{10}$/.test(data.contact)) {
    errors.contact = "Contact must be exactly 10 digits.";
  }

  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (isNaN(expiryDate) || expiryDate <= today)
      errors.passportExpiry =
        "Passport Expiry must be a valid date in the future.";
  }

  if (data.aadhar) {
    if (!/^\d{12}$/.test(data.aadhar)) {
      errors.aadhar = "Aadhar must be exactly 12 digits.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };
  }

  try {
    let checkSql =
      "SELECT passportNo, aadhar FROM candidates WHERE (passportNo = ?";
    const params = [cleanPassportNo];

    if (data.aadhar) {
      checkSql += " OR aadhar = ?";
      params.push(data.aadhar);
    }
    checkSql += ") AND isDeleted = 0 AND id != ?";
    params.push(id);

    const existing = await dbGet(db, checkSql, params);

    if (existing) {
      const duplicateErrors = {};
      if (existing.passportNo === cleanPassportNo) {
        duplicateErrors.passportNo = `Passport No ${cleanPassportNo} already exists for another candidate.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        duplicateErrors.aadhar = `Aadhar No ${data.aadhar} already exists for another candidate.`;
      }
      if (Object.keys(duplicateErrors).length > 0) {
        return {
          success: false,
          error: mapErrorToFriendly(
            "Duplicate field value detected.",
          ),
          errors: duplicateErrors,
        };
      }
    }

    const sql = `UPDATE candidates SET
      name = ?, education = ?, experience = ?, dob = ?,
      passportNo = ?, passportExpiry = ?, contact = ?, aadhar = ?,
      status = ?, notes = ?, Position = ?
    WHERE id = ?`;

    const updateParams = [
      data.name,
      data.education,
      data.experience,
      data.dob,
      cleanPassportNo,
      data.passportExpiry,
      data.contact,
      data.aadhar,
      data.status,
      data.notes,
      data.Position,
      id,
    ];
    await dbRun(db, sql, updateParams);
    return { success: true };
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "A unique field (like Passport) already exists.",
        ),
        field: "passportNo",
      };
    }
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteCandidate(id) {
  const db = getDatabase();

  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE candidates SET isDeleted = 1 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE documents SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE placements SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE visa_tracking SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE payments SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE medical_tracking SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE interview_tracking SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(
      db,
      "UPDATE travel_tracking SET isDeleted = 1 WHERE candidate_id = ?",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteDocument(docId) {
  const db = getDatabase();

  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, fileName FROM documents WHERE id = ?",
      [docId],
    );
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("Document not found."),
      };
    }
    await dbRun(db, "UPDATE documents SET isDeleted = 1 WHERE id = ?", [docId]);
    return {
      success: true,
      candidateId: row.candidate_id,
      fileName: row.fileName,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateDocumentCategory(docId, category) {
  const db = getDatabase();

  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, fileName FROM documents WHERE id = ?",
      [docId],
    );
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("Document not found."),
      };
    }
    const sql = `UPDATE documents SET category = ? WHERE id = ?`;
    await dbRun(db, sql, [category, docId]);
    return {
      success: true,
      candidateId: row.candidate_id,
      fileName: row.fileName,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}




// ====================================================================
// 7. PLACEMENT & SUB-MODULES
// ====================================================================

// === NEW: PASSPORT TRACKING QUERIES (INJECTED) ===

async function getPassportTracking(candidateId) {
  const db = getDatabase();
  const sql = `SELECT * FROM passport_tracking
                 WHERE candidate_id = ?
    AND isDeleted = 0
                 ORDER BY createdAt DESC`;
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addPassportEntry(data) {
  const errors = {};
  if (data.passport_status === "Received" && !data.received_date)
    errors.received_date =
      'Received Date is required when status is "Received".';
  if (data.passport_status === "Dispatched" && !data.dispatch_date)
    errors.dispatch_date =
      'Dispatch Date is required when status is "Dispatched".';
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO passport_tracking
                 (candidate_id, received_date, received_notes, dispatch_date, docket_number,
                  dispatch_notes, passport_status, source_type, agent_contact)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.received_date || null,
    data.received_notes || null,
    data.dispatch_date || null,
    data.docket_number || null,
    data.dispatch_notes || null,
    data.passport_status,
    data.source_type,
    data.agent_contact || null,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(
      db,
      "SELECT * FROM passport_tracking WHERE id = ?",
      [result.lastID],
    );
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

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
    WHERE p.candidate_id = ?
    AND p.isDeleted = 0
  `;
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function assignCandidateToJob(candidateId, jobOrderId) {
  const db = getDatabase();

  const checkSql = `
    SELECT id FROM placements
    WHERE candidate_id = ?
      AND job_order_id = ?
      AND isDeleted = 0
  `;

  const existing = await dbGet(db, checkSql, [candidateId, jobOrderId]);

  if (existing) {
    return {
      success: false,
      error: mapErrorToFriendly("Candidate already assigned to this job."),
    };
  }

  const insertSql = `
    INSERT INTO placements (candidate_id, job_order_id, assignedAt, status)
    VALUES (?, ?, datetime('now'), 'Assigned')
  `;

  try {
    await dbRun(db, insertSql, [candidateId, jobOrderId]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function removeCandidateFromJob(placementId) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, job_order_id FROM placements WHERE id = ?",
      [placementId],
    );
    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("Placement not found."),
      };
    }
    await dbRun(db, "UPDATE placements SET isDeleted = 1 WHERE id = ?", [
      placementId,
    ]);
    return {
      success: true,
      candidateId: row.candidate_id,
      jobId: row.job_order_id,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getVisaTracking(candidateId) {
  const db = getDatabase();
  const sql = `SELECT * FROM visa_tracking WHERE candidate_id = ?
    AND isDeleted = 0 ORDER BY application_date DESC`;
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addVisaEntry(data) {
  const errors = {};
  if (validateRequired(data.country, "Country"))
    errors.country = validateRequired(data.country, "Country");
  if (validateRequired(data.application_date, "Application Date"))
    errors.application_date = validateRequired(
      data.application_date,
      "Application Date",
    );
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO visa_tracking (candidate_id, country, visa_type, application_date, status, notes,
               position, passport_number, travel_date, contact_type, agent_contact)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.country,
    data.visa_type || null,
    data.application_date,
    data.status,
    data.notes || null,
    data.position || null,
    data.passport_number || null,
    data.travel_date || null,
    data.contact_type,
    data.agent_contact || null,
  ];

  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, "SELECT * FROM visa_tracking WHERE id = ?", [
      result.lastID,
    ]);
    return { success: true, data: row };
  } catch (err) {
    console.error("addVisaEntry DB Error:", err.message);
    return {
      success: false,
      error: mapErrorToFriendly(
        err.message || "Database execution failed during INSERT.",
      ),
    };
  }
}

async function updateVisaEntry(id, data) {
  const errors = {};
  if (validateRequired(data.country, "Country"))
    errors.country = validateRequired(data.country, "Country");
  if (validateRequired(data.application_date, "Application Date"))
    errors.application_date = validateRequired(
      data.application_date,
      "Application Date",
    );
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();

  const sql = `UPDATE visa_tracking SET
               country = ?, visa_type = ?, application_date = ?, status = ?, notes = ?,
               position = ?, passport_number = ?, travel_date = ?, contact_type = ?, agent_contact = ?
    WHERE id = ? AND isDeleted = 0`;

  const params = [
    data.country,
    data.visa_type,
    data.application_date,
    data.status,
    data.notes,
    data.position,
    data.passport_number,
    data.travel_date,
    data.contact_type,
    data.agent_contact,
    id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Visa entry not found or already deleted.",
        ),
      };
    }

    const updatedRow = await dbGet(
      db,
      "SELECT * FROM visa_tracking WHERE id = ?",
      [id],
    );
    return { success: true, data: updatedRow };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteVisaEntry(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, country FROM visa_tracking WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Entry not found."),
      };
    await dbRun(db, "UPDATE visa_tracking SET isDeleted = 1 WHERE id = ?", [
      id,
    ]);
    return {
      success: true,
      candidateId: row.candidate_id,
      country: row.country,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getMedicalTracking(candidateId) {
  const db = getDatabase();
  const sql =
    "SELECT * FROM medical_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY test_date DESC";
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addMedicalEntry(data) {
  const errors = {};
  if (validateRequired(data.test_date, "Test Date"))
    errors.test_date = validateRequired(data.test_date, "Test Date");

  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO medical_tracking (candidate_id, test_date, certificate_path, status, notes)
               VALUES (?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.test_date,
    data.certificate_path,
    data.status,
    data.notes,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, "SELECT * FROM medical_tracking WHERE id = ?", [
      result.lastID,
    ]);
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateMedicalEntry(id, data) {
  const errors = {};
  if (validateRequired(data.test_date, "Test Date"))
    errors.test_date = validateRequired(data.test_date, "Test Date");
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `UPDATE medical_tracking SET
               test_date = ?, certificate_path = ?, status = ?, notes = ?
    WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.test_date,
    data.certificate_path || null,
    data.status,
    data.notes || null,
    id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Medical entry not found or already deleted.",
        ),
      };
    }
    const updatedRow = await dbGet(
      db,
      "SELECT * FROM medical_tracking WHERE id = ?",
      [id],
    );
    return { success: true, data: updatedRow };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteMedicalEntry(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, test_date, status FROM medical_tracking WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Entry not found."),
      };
    await dbRun(db, "UPDATE medical_tracking SET isDeleted = 1 WHERE id = ?", [
      id,
    ]);
    return {
      success: true,
      candidateId: row.candidate_id,
      test_date: row.test_date,
      status: row.status,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getTravelTracking(candidateId) {
  const db = getDatabase();
  const sql =
    "SELECT * FROM travel_tracking WHERE candidate_id = ? AND isDeleted = 0 ORDER BY travel_date DESC";
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addTravelEntry(data) {
  const errors = {};
  if (validateRequired(data.travel_date, "Travel Date"))
    errors.travel_date = validateRequired(data.travel_date, "Travel Date");
  if (validateRequired(data.departure_city, "Departure City"))
    errors.departure_city = validateRequired(
      data.departure_city,
      "Departure City",
    );
  if (validateRequired(data.arrival_city, "Arrival City"))
    errors.arrival_city = validateRequired(data.arrival_city, "Arrival City");

  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO travel_tracking (candidate_id, pnr, travel_date, ticket_file_path, departure_city, arrival_city, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.pnr || null,
    data.travel_date,
    data.ticket_file_path || null,
    data.departure_city || null,
    data.arrival_city || null,
    data.notes || null,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, "SELECT * FROM travel_tracking WHERE id = ?", [
      result.lastID,
    ]);
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateTravelEntry(id, data) {
  const errors = {};
  if (validateRequired(data.travel_date, "Travel Date"))
    errors.travel_date = validateRequired(data.travel_date, "Travel Date");
  if (validateRequired(data.departure_city, "Departure City"))
    errors.departure_city = validateRequired(
      data.departure_city,
      "Departure City",
    );
  if (validateRequired(data.arrival_city, "Arrival City"))
    errors.arrival_city = validateRequired(data.arrival_city, "Arrival City");

  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `UPDATE travel_tracking SET
               pnr = ?, travel_date = ?, ticket_file_path = ?, departure_city = ?, arrival_city = ?, notes = ?
    WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.pnr || null,
    data.travel_date,
    data.ticket_file_path || null,
    data.departure_city,
    data.arrival_city,
    data.notes || null,
    id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Travel entry not found or already deleted.",
        ),
      };
    }
    const updatedRow = await dbGet(
      db,
      "SELECT * FROM travel_tracking WHERE id = ?",
      [id],
    );
    return { success: true, data: updatedRow };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteTravelEntry(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, travel_date FROM travel_tracking WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Entry not found."),
      };
    await dbRun(db, "UPDATE travel_tracking SET isDeleted = 1 WHERE id = ?", [
      id,
    ]);
    return {
      success: true,
      candidateId: row.candidate_id,
      travel_date: row.travel_date,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getInterviewTracking(candidateId) {
  const db = getDatabase();
  const sql = `
    SELECT i.*, j.positionTitle, e.companyName
    FROM interview_tracking i
    LEFT JOIN job_orders j ON i.job_order_id = j.id
    LEFT JOIN employers e ON j.employer_id = e.id
    WHERE i.candidate_id = ?
    AND i.isDeleted = 0
    ORDER BY i.interview_date DESC
  `;
  try {
    const rows = await dbAll(db, sql, [candidateId]);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addInterviewEntry(data) {
  const errors = {};
  if (validateRequired(data.job_order_id, "Job Order"))
    errors.job_order_id = validateRequired(data.job_order_id, "Job Order");
  if (validateRequired(data.interview_date, "Interview Date"))
    errors.interview_date = validateRequired(
      data.interview_date,
      "Interview Date",
    );
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO interview_tracking (candidate_id, job_order_id, interview_date, round, status, notes)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.job_order_id,
    data.interview_date,
    data.round,
    data.status,
    data.notes,
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
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateInterviewEntry(id, data) {
  const errors = {};
  if (validateRequired(data.job_order_id, "Job Order"))
    errors.job_order_id = validateRequired(data.job_order_id, "Job Order");
  if (validateRequired(data.interview_date, "Interview Date"))
    errors.interview_date = validateRequired(
      data.interview_date,
      "Interview Date",
    );
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `UPDATE interview_tracking SET
               job_order_id = ?, interview_date = ?, round = ?, status = ?, notes = ?
    WHERE id = ? AND isDeleted = 0`;
  const params = [
    data.job_order_id,
    data.interview_date,
    data.round || null,
    data.status,
    data.notes || null,
    id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Interview entry not found or already deleted.",
        ),
      };
    }
    const getSql = `
        SELECT i.*, j.positionTitle, e.companyName
        FROM interview_tracking i
        LEFT JOIN job_orders j ON i.job_order_id = j.id
        LEFT JOIN employers e ON j.employer_id = e.id
        WHERE i.id = ?
    `;
    const updatedRow = await dbGet(db, getSql, [id]);
    return { success: true, data: updatedRow };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteInterviewEntry(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, interview_date, round FROM interview_tracking WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Entry not found."),
      };
    await dbRun(
      db,
      "UPDATE interview_tracking SET isDeleted = 1 WHERE id = ?",
      [id],
    );
    return {
      success: true,
      candidateId: row.candidate_id,
      interview_date: row.interview_date,
      round: row.round,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
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
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addPayment(user, data) {
  const errors = {};
  if (validateRequired(data.description, "Description"))
    errors.description = validateRequired(data.description, "Description");
  if (validateRequired(data.total_amount, "Total Amount"))
    errors.total_amount = validateRequired(data.total_amount, "Total Amount");
  if (
    !errors.total_amount &&
    validatePositiveNumber(data.total_amount, "Total Amount")
  )
    errors.total_amount = validatePositiveNumber(
      data.total_amount,
      "Total Amount",
    );
  if (
    data.amount_paid &&
    validatePositiveNumber(data.amount_paid, "Amount Paid")
  )
    errors.amount_paid = validatePositiveNumber(
      data.amount_paid,
      "Amount Paid",
    );
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO payments (candidate_id, description, total_amount, amount_paid, status, due_date)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.candidate_id,
    data.description,
    data.total_amount,
    data.amount_paid,
    data.status,
    data.due_date,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const row = await dbGet(db, "SELECT * FROM payments WHERE id = ?", [
      result.lastID,
    ]);
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updatePayment(data) {
  const { user, id, total_amount, amount_paid, status } = data;

  const errors = {};

  if (!id) errors.id = "Payment ID is required.";
  if (total_amount !== undefined && total_amount !== null) {
    const parsedTotal = parseFloat(total_amount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      errors.total_amount = "Total Amount must be a positive number.";
    }
  }

  if (amount_paid !== undefined && amount_paid !== null) {
    const parsedPaid = parseFloat(amount_paid);
    if (isNaN(parsedPaid) || parsedPaid < 0) {
      errors.amount_paid = "Amount Paid must be a valid non-negative number.";
    }
  } else {
    errors.amount_paid = "Amount Paid value is required for update.";
  }

  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, description FROM payments WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Payment not found."),
      };

    const totalValue =
      total_amount === undefined || total_amount === null
        ? null
        : parseFloat(total_amount);
    const paidValue =
      amount_paid === undefined || amount_paid === null
        ? null
        : parseFloat(amount_paid);
    const sql = `UPDATE payments SET
                         total_amount = COALESCE(?, total_amount),
                         amount_paid = COALESCE(?, amount_paid),
                         status = COALESCE(?, status)
                         WHERE id = ?`;
    await dbRun(db, sql, [totalValue, paidValue, status, id]);
    const updatedRow = await dbGet(db, "SELECT * FROM payments WHERE id = ?", [
      id,
    ]);
    return {
      success: true,
      data: updatedRow,
      candidateId: row.candidate_id,
      description: row.description,
    };
  } catch (err) {
    return {
      success: false,
      error: mapErrorToFriendly(err || "Database execution failed."),
    };
  }
}

async function deletePayment(user, id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id, description, total_amount FROM payments WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Payment not found."),
      };
    await dbRun(db, "UPDATE payments SET isDeleted = 1 WHERE id = ?", [id]);
    return {
      success: true,
      candidateId: row.candidate_id,
      description: row.description,
      total_amount: row.total_amount,
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ====================================================================
// 10. RECYCLE BIN MANAGEMENT (COMPLETE)
// ====================================================================

// ---------- CANDIDATES ----------
async function getDeletedCandidates() {
  const db = getDatabase();
  const sql =
    "SELECT id, name, Position, createdAt, isDeleted FROM candidates WHERE isDeleted = 1 ORDER BY createdAt DESC";
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreCandidate(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE candidates SET isDeleted = 0 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE documents SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE placements SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE visa_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE passport_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE payments SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE medical_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE interview_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(
      db,
      "UPDATE travel_tracking SET isDeleted = 0 WHERE candidate_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- EMPLOYERS ----------
async function getDeletedEmployers() {
  const db = getDatabase();
  const sql =
    "SELECT * FROM employers WHERE isDeleted = 1 ORDER BY companyName ASC";
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreEmployer(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE employers SET isDeleted = 0 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE job_orders SET isDeleted = 0 WHERE employer_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- JOB ORDERS ----------
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
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreJobOrder(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE job_orders SET isDeleted = 0 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE placements SET isDeleted = 0 WHERE job_order_id = ? AND isDeleted = 1",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- REQUIRED DOCUMENTS ----------
async function getRequiredDocuments() {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      "SELECT * FROM required_documents WHERE isDeleted = 0 ORDER BY name ASC",
      [],
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addRequiredDocument(name) {
  const db = getDatabase();
  if (!name || name.trim() === "") {
    return {
      success: false,
      error: mapErrorToFriendly("Document name is required."),
    };
  }
  name = name.trim();

  try {
    const existingActive = await dbGet(
      db,
      "SELECT id FROM required_documents WHERE name = ? AND isDeleted = 0",
      [name],
    );
    if (existingActive) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Document name already exists in the active required list.",
        ),
      };
    }

    const existingDeleted = await dbGet(
      db,
      "SELECT id FROM required_documents WHERE name = ? AND isDeleted = 1",
      [name],
    );
    if (existingDeleted) {
      await dbRun(
        db,
        "UPDATE required_documents SET isDeleted = 0 WHERE id = ?",
        [existingDeleted.id],
      );
      const revived = await dbGet(
        db,
        "SELECT * FROM required_documents WHERE id = ?",
        [existingDeleted.id],
      );
      return { success: true, data: revived };
    }

    const result = await dbRun(
      db,
      "INSERT INTO required_documents (name, isDeleted) VALUES (?, 0)",
      [name],
    );
    const row = await dbGet(
      db,
      "SELECT * FROM required_documents WHERE id = ?",
      [result.lastID],
    );
    return { success: true, data: row };
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error: mapErrorToFriendly("Document name already exists."),
      };
    }
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteRequiredDocument(id) {
  const db = getDatabase();
  try {
    await dbRun(
      db,
      "UPDATE required_documents SET isDeleted = 1 WHERE id = ?",
      [id],
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
      "SELECT id, name FROM required_documents WHERE isDeleted = 1 ORDER BY name ASC",
      [],
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
      "UPDATE required_documents SET isDeleted = 0 WHERE id = ?",
      [id],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- PLACEMENTS ----------
async function getDeletedPlacements() {
  const db = getDatabase();
  const sql = `
    SELECT
      p.id,
      c.name as candidateName,
      j.positionTitle as jobTitle,
      j.companyName,
      j.country,
      p.assignedAt,
      p.status,
      p.createdAt
    FROM placements p
    LEFT JOIN candidates c ON p.candidate_id = c.id
    LEFT JOIN job_orders j ON p.job_order_id = j.id
    WHERE p.isDeleted = 1
    ORDER BY p.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    console.log("🗑️ Found", rows.length, "deleted placements");
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restorePlacement(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE placements SET isDeleted = 0 WHERE id = ?", [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- PASSPORT TRACKING ----------
async function getDeletedPassports() {
  const db = getDatabase();
  const sql = `
    SELECT
      pt.id,
      c.name AS candidateName,
      pt.received_date,
      pt.dispatch_date,
      pt.docket_number,
      pt.passport_status,
      pt.source_type,
      pt.agent_contact,
      pt.createdAt
    FROM passport_tracking pt
    LEFT JOIN candidates c ON pt.candidate_id = c.id
    WHERE pt.isDeleted = 1
    ORDER BY pt.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restorePassport(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE passport_tracking SET isDeleted = 0 WHERE id = ?", [
      id,
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- VISA TRACKING ----------
async function getDeletedVisas() {
  const db = getDatabase();
  const sql = `
    SELECT
      vt.id,
      c.name as candidateName,
      vt.visaType,
      vt.status,
      vt.createdAt
    FROM visa_tracking vt
    LEFT JOIN candidates c ON vt.candidate_id = c.id
    WHERE vt.isDeleted = 1
    ORDER BY vt.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreVisa(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE visa_tracking SET isDeleted = 0 WHERE id = ?", [
      id,
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- MEDICAL / INTERVIEW / TRAVEL ----------
async function getDeletedMedical() {
  const db = getDatabase();
  const sql = `
    SELECT
      m.id,
      c.name AS candidateName,
      m.status,
      m.test_date AS testDate,
      m.createdAt
    FROM medical_tracking m
    LEFT JOIN candidates c ON m.candidate_id = c.id
    WHERE m.isDeleted = 1
    ORDER BY m.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreMedical(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE medical_tracking SET isDeleted = 0 WHERE id = ?", [
      id,
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getDeletedVisas() {
  const db = getDatabase();
  const sql = `
    SELECT
      vt.id,
      c.name AS candidateName,
      vt.country,
      vt.visa_type AS visaType,
      vt.status,
      vt.application_date,
      vt.position,
      vt.passport_number,
      vt.travel_date,
      vt.contact_type,
      vt.agent_contact,
      vt.createdAt
    FROM visa_tracking vt
    LEFT JOIN candidates c ON vt.candidate_id = c.id
    WHERE vt.isDeleted = 1
    ORDER BY vt.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreInterview(id) {
  const db = getDatabase();
  const sql = `UPDATE interview_tracking SET isDeleted = 0 WHERE id = ?`;

  try {
    const result = await dbRun(db, sql, [id]);
    return { success: result.changes > 0 };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getDeletedTravel() {
  const db = getDatabase();
  const sql = `
    SELECT
      t.id,
      c.name AS candidateName,
      t.pnr,
      t.travel_date,
      t.departure_city,
      t.arrival_city,
      t.createdAt
    FROM travel_tracking t
    LEFT JOIN candidates c ON t.candidate_id = c.id
    WHERE t.isDeleted = 1
    ORDER BY t.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function restoreTravel(id) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE travel_tracking SET isDeleted = 0 WHERE id = ?", [
      id,
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getDeletedInterviews() {
  const db = getDatabase();
  const sql = `
    SELECT
      i.id,
      c.name AS candidateName,
      i.status,
      i.interview_date AS interviewDate,
      i.round,
      i.createdAt
    FROM interview_tracking i
    LEFT JOIN candidates c ON i.candidate_id = c.id
    WHERE i.isDeleted = 1
    ORDER BY i.createdAt DESC
  `;
  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ---------- PERMANENT DELETE ----------
async function deletePermanently(id, targetType) {
  const db = getDatabase();
  let sql;
  let identifier;

  switch (targetType) {
    case "candidates":
      sql = "DELETE FROM candidates WHERE id = ?";
      identifier = "candidate";
      break;
    case "employers":
      sql = "DELETE FROM employers WHERE id = ?";
      identifier = "employer";
      break;
    case "job_orders":
      sql = "DELETE FROM job_orders WHERE id = ?";
      identifier = "job order";
      break;
    case "required_docs":
      sql = "DELETE FROM required_documents WHERE id = ?";
      identifier = "required document";
      break;
    case "placements":
      sql = "DELETE FROM placements WHERE id = ?";
      identifier = "placement";
      break;
    case "passports":
      sql = "DELETE FROM passport_tracking WHERE id = ?";
      identifier = "passport";
      break;
    case "visas":
      sql = "DELETE FROM visa_tracking WHERE id = ?";
      identifier = "visa";
      break;
    case "medical":
      sql = "DELETE FROM medical_tracking WHERE id = ?";
      identifier = "medical record";
      break;
    case "interviews":
      sql = "DELETE FROM interview_tracking WHERE id = ?";
      identifier = "interview record";
      break;
    case "travel":
      sql = "DELETE FROM travel_tracking WHERE id = ?";
      identifier = "travel record";
      break;
    default:
      return {
        success: false,
        error: mapErrorToFriendly(
          "Invalid target type for permanent deletion.",
        ),
      };
  }

  try {
    const result = await dbRun(db, sql, [id]);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(`${identifier} not found.`),
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// ====================================================================
// 11. LICENSING/ACTIVATION FUNCTIONS (NEW)
// ====================================================================

async function setActivationStatus(statusData) {
  const db = getDatabase();
  const statusJson = JSON.stringify(statusData);
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('license_status', ?)",
      [statusJson],
      (err) => {
        if (err) reject(err);
        else resolve({ success: true });
      },
    );
  });
}

async function updatePassportEntry(id, data) {
  const db = getDatabase();
  const errors = {};
  if (data.passport_status === "Received" && !data.received_date)
    errors.received_date = "Received Date is required.";
  if (data.passport_status === "Dispatched" && !data.dispatch_date)
    errors.dispatch_date = "Dispatch Date is required.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors,
    };
  const sql = `UPDATE passport_tracking SET
                 received_date = ?, received_notes = ?, dispatch_date = ?, docket_number = ?,
                 dispatch_notes = ?, passport_status = ?, source_type = ?, agent_contact = ?
                 WHERE id = ? AND isDeleted = 0`;

  const params = [
    data.received_date || null,
    data.received_notes || null,
    data.dispatch_date || null,
    data.docket_number || null,
    data.dispatch_notes || null,
    data.passport_status,
    data.source_type,
    data.agent_contact || null,
    id,
  ];
  try {
    const result = await dbRun(db, sql, params);
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Passport entry not found or already deleted.",
        ),
      };
    }
    const row = await dbGet(
      db,
      "SELECT * FROM passport_tracking WHERE id = ?",
      [id],
    );
    return { success: true, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deletePassportEntry(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT candidate_id FROM passport_tracking WHERE id = ?",
      [id],
    );
    if (!row)
      return {
        success: false,
        error: mapErrorToFriendly("Entry not found."),
      };

    await dbRun(db, "UPDATE passport_tracking SET isDeleted = 1 WHERE id = ?", [
      id,
    ]);

    return { success: true, candidateId: row.candidate_id };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

// --- KANBAN BOARD FUNCTIONS ---

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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateVisaStatus(id, status) {
  const db = getDatabase();
  try {
    await dbRun(db, "UPDATE visa_tracking SET status = ? WHERE id = ?", [
      status,
      id,
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function logCommunication(user, candidateId, type, details) {
  const db = getDatabase();
  try {
    await dbRun(
      db,
      "INSERT INTO communication_logs (candidate_id, user_id, type, details) VALUES (?, ?, ?, ?)",
      [candidateId, user.id, type, details],
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getCommLogs(candidateId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      `
            SELECT c.*, u.username
            FROM communication_logs c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.candidate_id = ? ORDER BY c.timestamp DESC`,
      [candidateId],
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

const saveDocumentFromApi = async ({ candidateId, user, fileData }) => {
  const filesDir = path.join(app.getPath("userData"), "candidate_files");
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  try {
    const db = getDatabase();
    const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;
    const uniqueName = `${uuidv4()}${path.extname(fileData.fileName)}`;
    const newFilePath = path.join(filesDir, uniqueName);

    fs.writeFileSync(newFilePath, Buffer.from(fileData.buffer));
    const result = await dbRun(db, sqlDoc, [
      candidateId,
      fileData.fileType,
      fileData.fileName,
      newFilePath,
      fileData.category,
    ]);
    return { success: true, documentId: result.lastID };
  } catch (err) {
    console.error("saveDocumentFromApi error:", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
};

async function getCanonicalUserContext(userId) {
  const db = getDatabase();
  try {
    const sql = "SELECT id, username, role FROM users WHERE id = $1";
    const row = await dbGet(db, sql, [userId]);

    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly("User not found."),
      };
    }

    return {
      success: true,
      user: {
        id: row.id,
        username: row.username,
        role: row.role,
      },
    };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

const proxyRequest = async (
  user,
  method,
  endpoint,
  data = null,
  params = {},
) => {
  try {
    const lookup = await getCanonicalUserContext(user.id);
    if (!lookup.success) {
      return {
        success: false,
        error: mapErrorToFriendly(
          "Authentication Failed: Invalid User ID.",
        ),
      };
    }
    const canonicalUser = lookup.user;
    const headers = {
      Authorization: `Bearer ${canonicalUser.id}:${canonicalUser.role}`,
      "User-Context": JSON.stringify(canonicalUser),
    };
    const url = `${API_URL_BASE}${endpoint}`;

    const config = {
      method: method.toLowerCase(),
      url: url,
      headers: headers,
      params: params,
      data: data,
    };
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(
      `Remote API Error (${method} ${endpoint}):`,
      error.response?.data?.error || error.message,
    );
    return {
      success: false,
      error: mapErrorToFriendly(
        error.response?.data?.error ||
          "Could not connect to remote API.",
      ),
    };
  }
};

async function getJwtSecret() {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT value FROM system_settings WHERE key = 'jwt_secret'",
      [],
    );
    if (row && row.value) return row.value;

    const newSecret = require("crypto").randomBytes(64).toString("hex");
    await dbRun(
      db,
      "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('jwt_secret', ?)",
      [newSecret],
    );
    return newSecret;
  } catch (err) {
    console.error("JWT Secret Error:", err);
    return "fallback_secret_change_me_immediately";
  }
}

async function verifyActivationKey(inputKey) {
  const db = getDatabase();
  try {
    const row = await dbGet(
      db,
      "SELECT value FROM system_settings WHERE key = 'master_activation_key'",
      [],
    );
    const validKey = row ? row.value : "74482";
    return inputKey === validKey;
  } catch (err) {
    return false;
  }
}

async function getDashboardStats() {
  const db = getDatabase();
  try {
    const counts = await dbGet(
      db,
      `
            SELECT
                (SELECT COUNT(*) FROM candidates WHERE deleted_at IS NULL) as candidates,
                (SELECT COUNT(*) FROM job_orders WHERE status = 'Open' AND IsDeleted IS NULL) as jobs,
                (SELECT COUNT(*) FROM employers WHERE deleted_at IS NULL) as employers,
                (SELECT COUNT(*) FROM candidates WHERE status = 'New' AND IsDeleted IS NULL) as newCandidates
        `,
      [],
    );
    return { success: true, data: counts };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function savePendingActivation({ machineId, code, email }) {
  const sql = `
    INSERT INTO activations (machineId, code, activated, createdAt)
    VALUES (?, ?, 0, datetime('now'))
    ON CONFLICT(machineId) DO UPDATE SET
      code = excluded.code,
      activated = 0,
      createdAt = excluded.createdAt
  `;
  await dbRun(getDatabase(), sql, [machineId, code]);
  return { success: true };
}

async function getPendingActivation(machineId) {
  const row = await dbGet(
    getDatabase(),
    "SELECT * FROM activations WHERE machineId = ?",
    [machineId],
  );
  return row || null;
}

async function markActivationUsed(machineId) {
  await dbRun(
    getDatabase(),
    "UPDATE activations SET activated = 1 WHERE machineId = ?",
    [machineId],
  );
  return { success: true };
}

async function getActivationStatus() {
  const db = getDatabase();
  const row = await dbGet(
    db,
    "SELECT machineId, activated FROM activations LIMIT 1",
    [],
  );
  if (!row) {
    return { success: true, activated: 0, machineId: null };
  }
  return {
    success: true,
    activated: row.activated,
    machineId: row.machineId,
  };
}

async function getDeletedPlacements() {
  const db = getDatabase();

  const sql = `
    SELECT
      p.id,
      p.candidate_id,
      p.job_order_id,
      c.name as candidateName,
      j.positionTitle as jobTitle,
      p.assignedAt,
      p.status,
      p.isDeleted
    FROM placements p
    LEFT JOIN candidates c ON p.candidate_id = c.id
    LEFT JOIN job_orders j ON p.job_order_id = j.id
    WHERE p.isDeleted = 1
    ORDER BY p.status DESC
  `;

  try {
    const rows = await dbAll(db, sql, []);
    console.log(`🗑️ Found ${rows.length} deleted placements`);
    return { success: true, data: rows };
  } catch (err) {
    console.error("❌ Error fetching deleted placements:", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function getPlacements() {
  const db = getDatabase();

  const sql = `
    SELECT
      p.id,
      p.candidate_id,
      p.job_order_id,
      c.name as candidateName,
      j.positionTitle as jobTitle,
      p.assignedAt,
      p.status
    FROM placements p
    LEFT JOIN candidates c ON p.candidate_id = c.id
    LEFT JOIN job_orders j ON p.job_order_id = j.id
    WHERE p.isDeleted = 0
    ORDER BY p.assignedAt DESC
  `;

  try {
    const rows = await dbAll(db, sql, []);
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function softDeletePlacement(id) {
  const db = getDatabase();

  const sql = `UPDATE placements SET isDeleted = 1 WHERE id = ?`;

  try {
    await dbRun(db, sql, [id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function permanentDeletePlacement(id) {
  const db = getDatabase();
  const sql = "DELETE FROM placements WHERE id = ?";
  const result = await dbRun(db, sql, [id]);
  return {
    success: result.changes > 0,
    error: result.changes ? null : mapErrorToFriendly("Placement not found."),
  };
}

async function getAdminAssignedFeatures(userId) {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    const sql = `
      SELECT f.key
      FROM feature_flags f
      INNER JOIN user_features uf ON uf.feature_id = f.id
      WHERE uf.user_id = ?
        AND f.isDeleted = 0
    `;
    db.all(sql, [userId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => r.key));
    });
  });
}

async function checkPlacementExists(id) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, "SELECT id FROM placements WHERE id = ?", [id]);
    return !!row;
  } catch (err) {
    return false;
  }
}

// ====================================================================
// 5. EMPLOYER MANAGEMENT
// ====================================================================

async function getEmployers() {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      "SELECT * FROM employers WHERE isDeleted = 0 ORDER BY companyName ASC",
      [],
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addEmployer(user, data) {
  const errors = {};
  if (validateRequired(data.companyName, "Company Name"))
    errors.companyName = validateRequired(data.companyName, "Company Name");
  if (data.contactEmail && !validateEmail(data.contactEmail))
    errors.contactEmail = "Contact Email must be valid.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const sql = `INSERT INTO employers (companyName, country, contactPerson, contactEmail, notes)
               VALUES (?, ?, ?, ?, ?)`;
  const params = [
    data.companyName,
    data.country,
    data.contactPerson,
    data.contactEmail,
    data.notes,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const newId = result.lastID;
    return { success: true, id: newId, data: { ...data, id: newId } };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateEmployer(user, id, data) {
  const errors = {};
  if (validateRequired(data.companyName, "Company Name"))
    errors.companyName = validateRequired(data.companyName, "Company Name");
  if (data.contactEmail && !validateEmail(data.contactEmail))
    errors.contactEmail = "Contact Email must be valid.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const sql = `UPDATE employers SET
               companyName = ?, country = ?, contactPerson = ?, contactEmail = ?, notes = ?
    WHERE id = ?`;
  const params = [
    data.companyName,
    data.country,
    data.contactPerson,
    data.contactEmail,
    data.notes,
    id,
  ];
  try {
    await dbRun(db, sql, params);
    return { success: true, id: id, data: data };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteEmployer(user, id) {
  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE employers SET isDeleted = 1 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE job_orders SET isDeleted = 1 WHERE employer_id = ?",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    return { success: false, error: mapErrorToFriendly(err) };
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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function addJobOrder(user, data) {
  const errors = {};
  if (validateRequired(data.employer_id, "Employer ID"))
    errors.employer_id = "Employer is required.";
  if (validateRequired(data.positionTitle, "Position Title"))
    errors.positionTitle = "Position Title is required.";
  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1)
    errors.openingsCount = "Openings must be at least 1.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
  const sql = `INSERT INTO job_orders (employer_id, positionTitle, country, openingsCount, status, requirements)
               VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [
    data.employer_id,
    data.positionTitle,
    data.country,
    data.openingsCount,
    data.status,
    data.requirements,
  ];
  try {
    const result = await dbRun(db, sql, params);
    const newJobId = result.lastID;
    const getSql = `
      SELECT j.*, e.companyName
      FROM job_orders j
      LEFT JOIN employers e ON j.employer_id = e.id
      WHERE j.id = ?
    `;
    const row = await dbGet(db, getSql, [newJobId]);
    return { success: true, id: newJobId, data: row };
  } catch (err) {
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function updateJobOrder(user, id, data) {
  const errors = {};
  if (!data.employer_id) errors.employer_id = "Employer is required.";
  if (!data.positionTitle) errors.positionTitle = "Position Title is required.";

  const openings = parseInt(data.openingsCount, 10);
  if (isNaN(openings) || openings < 1)
    errors.openingsCount = "Openings must be at least 1.";
  if (Object.keys(errors).length > 0)
    return {
      success: false,
      error: mapErrorToFriendly("Validation failed"),
      errors: errors,
    };

  const db = getDatabase();
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
    id,
  ];
  try {
    await dbRun(db, sql, params);

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
    return { success: false, error: mapErrorToFriendly(err) };
  }
}

async function deleteJobOrder(user, id) {
  const db = getDatabase();

  try {
    await dbRun(db, "BEGIN TRANSACTION");
    await dbRun(db, "UPDATE job_orders SET isDeleted = 1 WHERE id = ?", [id]);
    await dbRun(
      db,
      "UPDATE placements SET isDeleted = 1 WHERE job_order_id = ?",
      [id],
    );
    await dbRun(db, "COMMIT");
    return { success: true };
  } catch (err) {
    await dbRun(db, "ROLLBACK");
    console.error("Delete Job Error:", err.message);
    return { success: false, error: mapErrorToFriendly(err) };
  }
}


module.exports = {
  // DB Helpers
  dbRun,
  dbGet,
  dbAll,
  getAdminAssignedFeatures,
  savePendingActivation,
  getPendingActivation,
  markActivationUsed,
  getActivationStatus,
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
  updateVisaStatus, // [NEW]
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

  getDeletedRequiredDocuments,
  restoreRequiredDocument,

  // Recycle Bin - Candidates
  getDeletedCandidates,
  restoreCandidate,

  // Recycle Bin - Employers
  getDeletedEmployers,
  restoreEmployer,

  // Recycle Bin - Job Orders
  getDeletedJobOrders,
  restoreJobOrder,
  getPlacements,

  // Recycle Bin - Placements
  getDeletedPlacements,
  restorePlacement,
  softDeletePlacement,
  // Recycle Bin - Passports
  getDeletedPassports,
  restorePassport,

  // Recycle Bin - Visas
  getDeletedVisas,
  restoreVisa,
  permanentDeletePlacement,
  checkPlacementExists,
  setActivationStatus,
  getSuperAdminFeatureFlags,
  logCommunication,
  getCommLogs,

  getDeletedMedical,
  restoreMedical,
  getDeletedInterviews,
  restoreInterview,
  getDeletedTravel,
  restoreTravel,
};
