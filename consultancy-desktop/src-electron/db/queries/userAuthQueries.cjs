const { getDatabase } = require("../database.cjs");
const { dbRun, dbGet, dbAll } = require("./dbHelpers.cjs");
const { validateRequired } = require("./validationHelpers.cjs");
const bcrypt = require("bcrypt");
const saltRounds = 10;

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
  } catch (err) {
    console.error("getSAFlags DB Error:", err.message);
    return { success: false, error: "Failed to retrieve global policy flags." };
  }
}

async function checkAdminFeatureAccess(user, featureKey) {
  if (!user || user.role === "super_admin") return { success: true };
  if (user.role !== "admin") return { success: true };

  const globalFlagsRes = await getSuperAdminFeatureFlags();

  if (!globalFlagsRes.success || !globalFlagsRes.data[featureKey]) {
    const error = `Access Denied: Feature "${featureKey}" is disabled by Super Admin policy.`;
    console.warn(`Admin attempt blocked: ${error}`);
    return { success: false, error: error };
  }

  const adminEffectiveFlagsRes = await getAdminEffectiveFlagsDb(user.id);
  if (
    !adminEffectiveFlagsRes.success ||
    !adminEffectiveFlagsRes.data[featureKey]
  ) {
    const error = `Access Denied: Feature "${featureKey}" is not enabled for this Admin.`;
    console.warn(`Admin attempt blocked: ${error}`);
    return { success: false, error: error };
  }

  return { success: true };
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
    return { success: false, error: "Failed to retrieve user permissions." };
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
    return { success: false, error: "Failed to save user permissions." };
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
      return { success: false, error: "Invalid username or password." };
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
      return { success: false, error: "Invalid username or password." };
    }
  } catch (err) {
    console.error("Login Error:", err.message);
    return { success: false, error: "A database or bcrypt error occurred." };
  }
}

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
    return { success: false, error: "Validation failed", errors: errors };

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
      return { success: false, error: "Username already exists." };
    }
    console.error("Registration DB Run Error:", dbErr);
    return { success: false, error: dbErr.message };
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
    return { success: false, error: "Failed to fetch existing users." };
  }
}

async function addUser(username, password, role) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(username, "Username"))
    errors.username = validateRequired(username, "Username");
  if (validateRequired(password, "Password"))
    errors.password = validateRequired(password, "Password");
  if (!errors.password && password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return { success: false, error: "Validation failed", errors: errors };

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
      return { success: false, error: "Username already exists." };
    }
    console.error("Add User DB Run Error:", dbErr);
    return { success: false, error: dbErr.message };
  }
}

async function resetUserPassword(id, newPassword) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(newPassword, "New Password"))
    errors.newPassword = validateRequired(newPassword, "New Password");
  if (!errors.newPassword && newPassword.length < 6)
    errors.newPassword = "Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return { success: false, error: "Validation failed", errors: errors };

  try {
    const hash = await bcrypt.hash(newPassword, saltRounds);
    const sql = "UPDATE users SET password = ? WHERE id = ?";
    const result = await dbRun(db, sql, [hash, id]);

    if (result.changes === 0) {
      return { success: false, error: "User not found." };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function changeMyPassword(id, oldPassword, newPassword) {
  const db = getDatabase();
  const errors = {};
  if (validateRequired(newPassword, "New Password"))
    errors.newPassword = validateRequired(newPassword, "New Password");
  if (!errors.newPassword && newPassword.length < 6)
    errors.newPassword = "New Password must be at least 6 characters.";
  if (Object.keys(errors).length > 0)
    return { success: false, error: "Validation failed", errors: errors };

  try {
    const row = await dbGet(db, "SELECT password FROM users WHERE id = ?", [
      id,
    ]);
    if (!row) return { success: false, error: "User not found." };

    const match = await bcrypt.compare(oldPassword, row.password);
    if (!match) {
      return { success: false, error: "Incorrect current password." };
    }

    const hash = await bcrypt.hash(newPassword, saltRounds);
    await dbRun(db, "UPDATE users SET password = ? WHERE id = ?", [hash, id]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteUser(idToDelete, selfId) {
  const db = getDatabase();
  if (selfId === idToDelete) {
    return {
      success: false,
      error: "Validation Failed: You cannot delete your own account.",
    };
  }
  if (idToDelete === 1) {
    return {
      success: false,
      error:
        "Validation Failed: Cannot delete the primary Super Admin account.",
    };
  }

  try {
    const row = await dbGet(db, "SELECT username FROM users WHERE id = ?", [
      idToDelete,
    ]);
    if (!row) {
      return { success: false, error: "User not found." };
    }

    const deletedUsername = row.username;
    const sql = "DELETE FROM users WHERE id = ?";
    const result = await dbRun(db, sql, [idToDelete]);
    if (result.changes === 0) {
      return { success: false, error: "User not found." };
    }

    return {
      success: true,
      deletedId: idToDelete,
      deletedUsername: deletedUsername,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getCanonicalUserContext(userId) {
  const db = getDatabase();
  try {
    const sql = "SELECT id, username, role FROM users WHERE id = ?";
    const row = await dbGet(db, sql, [userId]);

    if (!row) {
      return { success: false, error: "User not found." };
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
    return { success: false, error: err.message };
  }
}

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

async function getAdminAssignedFeaturesDb(adminId) {
  const db = getDatabase();
  try {
    const rows = await dbAll(
      db,
      "SELECT feature_key, enabled FROM admin_feature_assignments WHERE admin_id = ?",
      [adminId],
    );
    const assignedFlags = {};
    rows.forEach((row) => {
      assignedFlags[row.feature_key] = !!row.enabled;
    });
    return { success: true, data: assignedFlags };
  } catch (err) {
    console.error("getAdminAssignedFeaturesDb DB Error:", err.message);
    return {
      success: false,
      error: "Failed to retrieve admin assigned features.",
    };
  }
}

async function setAdminFeatureAssignmentDb(adminId, featureKey, enabled) {
  const db = getDatabase();
  try {
    const sql = `INSERT OR REPLACE INTO admin_feature_assignments (admin_id, feature_key, enabled) VALUES (?, ?, ?)`;
    await dbRun(db, sql, [adminId, featureKey, enabled ? 1 : 0]);
    return { success: true };
  } catch (err) {
    console.error("setAdminFeatureAssignmentDb DB Error:", err.message);
    return {
      success: false,
      error: "Failed to save admin feature assignment.",
    };
  }
}

async function getAdminEffectiveFlagsDb(adminId) {
  try {
    const globalFlagsRes = await getSuperAdminFeatureFlags();
    if (!globalFlagsRes.success) return globalFlagsRes;
    const globalFlags = globalFlagsRes.data;

    const adminAssignedRes = await getAdminAssignedFeaturesDb(adminId);
    if (!adminAssignedRes.success) return adminAssignedRes;
    const adminAssignedFlags = adminAssignedRes.data;

    const effectiveFlags = {};
    Object.keys(globalFlags).forEach((key) => {
      effectiveFlags[key] =
        globalFlags[key] &&
        (adminAssignedFlags[key] !== undefined
          ? adminAssignedFlags[key]
          : true); // If not explicitly assigned, assume true based on global
    });

    return { success: true, data: effectiveFlags };
  } catch (err) {
    console.error("getAdminEffectiveFlagsDb Error:", err.message);
    return {
      success: false,
      error: "Failed to calculate admin effective flags.",
    };
  }
}

module.exports = {
  getSuperAdminFeatureFlags,
  checkAdminFeatureAccess,
  getUserPermissions,
  saveUserPermissions,
  login,
  registerNewUser,
  getAllUsers,
  addUser,
  resetUserPassword,
  changeMyPassword,
  deleteUser,
  getCanonicalUserContext,
  getJwtSecret,
  verifyActivationKey,
  getAdminAssignedFeaturesDb,
  setAdminFeatureAssignmentDb,
  getAdminEffectiveFlagsDb,
};
