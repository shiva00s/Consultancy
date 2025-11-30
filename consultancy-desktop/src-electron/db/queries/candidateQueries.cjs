const { getDatabase } = require("../database.cjs");
const { dbRun, dbGet, dbAll } = require("./dbHelpers.cjs");
const {
  validateRequired,
  validatePositiveNumber,
  validateVerhoeff,
} = require("./validationHelpers.cjs");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

async function createCandidate(data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0);

  const cleanPassportNo = data.passportNo
    ? data.passportNo
        .trim()
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase()
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
    // else if (!validateVerhoeff(data.aadhar)) { // Re-enable for production if needed
    //    errors.aadhar = 'Invalid Aadhaar Number (Checksum failed). Please check for typos.';
    // }
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
    const params = [cleanPassportNo]; // Use cleanPassportNo for checking

    if (data.aadhar) {
      checkSql += " OR aadhar = ?";
      params.push(data.aadhar);
    }
    checkSql += ") AND isDeleted = 0";
    const existing = await dbGet(db, checkSql, params);
    if (existing) {
      if (existing.passportNo === cleanPassportNo) {
        errors.passportNo = `Passport No ${cleanPassportNo} already exists.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        errors.aadhar = `Aadhar No ${data.aadhar} already exists.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { success: false, error: "Validation failed", errors: errors };
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
    return { success: false, error: err.message };
  }
}

async function getSystemAuditLog(user, params) {
  // Assuming checkAdminFeatureAccess is defined in userAuthQueries.cjs and imported
  const { checkAdminFeatureAccess } = require("./userAuthQueries.cjs");
  const accessCheck = await checkAdminFeatureAccess(user, "canAccessSettings");
  if (!accessCheck.success) return accessCheck;

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
    console.error("System Audit Log Query Error:", err.message);
    return {
      success: false,
      error: "Database query failed. Please check server console.",
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
    return { success: false, error: err.message };
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
    return { success: false, error: err.message };
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
      return { success: false, error: "Candidate not found." };
    }
    const documents = await dbAll(
      db,
      "SELECT * FROM documents WHERE candidate_id = ? AND isDeleted = 0 ORDER BY category, fileName",
      [id],
    );
    return { success: true, data: { candidate, documents } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// MODIFIED: Uses structured error return for all validation/duplicate failures
async function updateCandidateText(id, data) {
  const db = getDatabase();
  const errors = {};
  const today = new Date().setHours(0, 0, 0, 0); // For date checks

  // --- 1. Basic Validation ---
  const nameValidation = validateRequired(data.name, "Candidate Name");
  if (nameValidation) errors.name = nameValidation;

  const passportValidation = validateRequired(data.passportNo, "Passport No");
  if (passportValidation) errors.passportNo = passportValidation;

  const positionValidation = validateRequired(data.Position, "Position");
  if (positionValidation) errors.Position = positionValidation;

  if (data.contact && !/^\d{10}$/.test(data.contact)) {
    errors.contact = "Contact must be exactly 10 digits.";
  }
  if (data.passportExpiry) {
    const expiryDate = new Date(data.passportExpiry).getTime();
    if (expiryDate <= today)
      errors.passportExpiry = "Passport Expiry must be in the future.";
  }
  // --- End Basic Validation ---

  // --- 2. Aadhaar Validation ---
  if (data.aadhar) {
    if (!/^\d{12}$/.test(data.aadhar)) {
      errors.aadhar = "Aadhar must be exactly 12 digits.";
    }
    // TEMPORARILY DISABLE VERHOEFF CHECK FOR STABILITY
    // else if (!validateVerhoeff(data.aadhar)) {
    //   errors.aadhar = 'Invalid Aadhaar Number (Checksum failed). Please check for typos.';
    // }
  }

  // --- 3. Finalize Validation Errors ---
  if (Object.keys(errors).length > 0) {
    return { success: false, error: "Validation failed", errors: errors };
  }

  // --- 4. Duplicate Check (Passport & Aadhar) ---
  try {
    let checkSql =
      "SELECT passportNo, aadhar FROM candidates WHERE (passportNo = ?";
    const params = [data.passportNo];

    if (data.aadhar) {
      checkSql += " OR aadhar = ?";
      params.push(data.aadhar);
    }
    checkSql += ") AND isDeleted = 0 AND id != ?";
    params.push(id);

    const existing = await dbGet(db, checkSql, params);

    if (existing) {
      const duplicateErrors = {};
      if (existing.passportNo === data.passportNo) {
        duplicateErrors.passportNo = `Passport No ${data.passportNo} already exists for another candidate.`;
      }
      if (data.aadhar && existing.aadhar === data.aadhar) {
        duplicateErrors.aadhar = `Aadhar No ${data.aadhar} already exists for another candidate.`;
      }
      if (Object.keys(duplicateErrors).length > 0) {
        return {
          success: false,
          error: "Duplicate field value detected.",
          errors: duplicateErrors,
        };
      }
    }

    // --- 5. Execute Update ---
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
      data.passportNo,
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
        error: `A unique field (like Passport) already exists.`,
        field: "passportNo",
      };
    }
    return { success: false, error: err.message };
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
    return { success: false, error: err.message };
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
      return { success: false, error: "Document not found." };
    }
    await dbRun(db, "UPDATE documents SET isDeleted = 1 WHERE id = ?", [docId]);
    return {
      success: true,
      candidateId: row.candidate_id,
      fileName: row.fileName,
    };
  } catch (err) {
    return { success: false, error: err.message };
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
      return { success: false, error: "Document not found." };
    }
    const sql = `UPDATE documents SET category = ? WHERE id = ?`;
    await dbRun(db, sql, [category, docId]);
    return {
      success: true,
      candidateId: row.candidate_id,
      fileName: row.fileName,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getAllCandidates() {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      "SELECT id, name, passportNo FROM candidates WHERE isDeleted = 0",
      [],
    );
    return { success: true, data: rows };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function saveDocumentFromApi({ candidateId, user, fileData, app }) {
  // Added 'app' dependency
  try {
    const db = getDatabase();
    const filesDir = path.join(app.getPath("userData"), "candidate_files"); // Use app.getPath

    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    const uniqueName = `${uuidv4()}${path.extname(fileData.fileName)}`;
    const newFilePath = path.join(filesDir, uniqueName);

    await fs.promises.writeFile(newFilePath, fileData.buffer);

    const sqlDoc = `INSERT INTO documents (candidate_id, fileType, fileName, filePath, category) VALUES (?, ?, ?, ?, ?)`;

    return new Promise((resolve, reject) => {
      db.run(
        sqlDoc,
        [
          candidateId,
          fileData.fileType,
          fileData.fileName,
          newFilePath,
          fileData.category,
        ],
        function (err) {
          if (err) {
            fs.unlink(newFilePath, () => {});
            reject(err);
          } else {
            const { logAction } = require("../../utils/logger.cjs"); // Lazily require logAction
            logAction(
              user,
              "add_document_mobile",
              "candidates",
              candidateId,
              `File: ${fileData.fileName}`,
            );
            resolve({ success: true, documentId: this.lastID });
          }
        },
      );
    });
  } catch (error) {
    console.error("saveDocumentFromApi failed:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createCandidate,
  getSystemAuditLog,
  getAuditLogForCandidate,
  searchCandidates,
  getCandidateDetails,
  updateCandidateText,
  deleteCandidate,
  deleteDocument,
  updateDocumentCategory,
  getAllCandidates,
  saveDocumentFromApi,
};
