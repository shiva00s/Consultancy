// ==============================
// AUTH & USER MANAGEMENT QUERIES
// ==============================
const bcrypt = require("bcrypt");
const saltRounds = 10;
const { getDatabase } = require("../db/database.cjs");
const { dbRun, dbGet, dbAll } = require("../db/dbHelpers.cjs");

// ==============================
// VALIDATION HELPERS
// ==============================
const validateRequired = (v, name) =>
    !v || (typeof v === "string" && v.trim() === "")
        ? `${name} is required.`
        : null;

const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ==============================
// PERMISSION HELPERS
// ==============================

async function getSuperAdminFeatureFlags() {
    try {
        const row = await dbGet(
            getDatabase(),
            "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1"
        );
        return { success: true, data: row?.features ? JSON.parse(row.features) : {} };
    } catch (err) {
        return { success: false, error: "Failed to load global feature flags." };
    }
}

async function getUserPermissions(userId) {
    try {
        const row = await dbGet(
            getDatabase(),
            "SELECT flags FROM user_permissions WHERE user_id = ?",
            [userId]
        );
        return { success: true, data: row ? JSON.parse(row.flags) : {} };
    } catch (err) {
        return { success: false, error: "Failed to load user permissions." };
    }
}

async function saveUserPermissions(userId, flags) {
    try {
        await dbRun(
            getDatabase(),
            "INSERT OR REPLACE INTO user_permissions (user_id, flags) VALUES (?, ?)",
            [userId, JSON.stringify(flags)]
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: "Failed to save permissions." };
    }
}

async function checkUserDelegatedAccess(user, key) {
    if (!user || user.role === "super_admin") return { success: true };

    const ceil = await getSuperAdminFeatureFlags();
    if (!ceil.success || !ceil.data[key])
        return { success: false, error: `Feature "${key}" disabled globally.` };

    const delegated = await getUserPermissions(user.id);
    if (delegated.data[key] === true) return { success: true };

    return { success: false, error: `Permission denied for "${key}".` };
}

async function checkAdminFeatureAccess(user, key) {
    return checkUserDelegatedAccess(user, key);
}

// ==============================
// AUTH FUNCTIONS
// ==============================

async function login(username, password) {
    const db = getDatabase();
    try {
        const row = await dbGet(
            db,
            "SELECT id, password, role, username FROM users WHERE username = ?",
            [username]
        );

        if (!row) return { success: false, error: "Invalid credentials." };

        const match = await bcrypt.compare(password, row.password);
        if (!match) return { success: false, error: "Invalid credentials." };

        return {
            success: true,
            id: row.id,
            username: row.username,
            role: row.role,
        };
    } catch (err) {
        return { success: false, error: "Login failed." };
    }
}

async function registerUser(username, password, role) {
    const db = getDatabase();
    const errors = {};

    const r1 = validateRequired(username, "Username");
    if (r1) errors.username = r1;

    const r2 = validateRequired(password, "Password");
    if (r2) errors.password = r2;

    if (!errors.password && password.length < 6)
        errors.password = "Password must be at least 6 characters.";

    if (Object.keys(errors).length)
        return { success: false, error: "Validation failed", errors };

    try {
        const hash = await bcrypt.hash(password, saltRounds);

        const result = await dbRun(
            db,
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            [username, hash, role]
        );

        return { success: true, data: { id: result.lastID, username, role } };
    } catch (err) {
        if (err.message.includes("UNIQUE constraint failed"))
            return { success: false, error: "Username already exists." };

        return { success: false, error: err.message };
    }
}

async function resetUserPassword(id, newPassword) {
    const db = getDatabase();
    const errors = {};

    const r = validateRequired(newPassword, "New Password");
    if (r) errors.newPassword = r;

    if (!errors.newPassword && newPassword.length < 6)
        errors.newPassword = "Password must be at least 6 characters.";

    if (Object.keys(errors).length)
        return { success: false, error: "Validation failed", errors };

    try {
        const hash = await bcrypt.hash(newPassword, saltRounds);
        const res = await dbRun(db, "UPDATE users SET password = ? WHERE id = ?", [
            hash,
            id,
        ]);

        if (!res.changes) return { success: false, error: "User not found." };

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function changeMyPassword(id, oldPass, newPass) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT password FROM users WHERE id = ?", [id]);
        if (!row) return { success: false, error: "User not found." };

        const ok = await bcrypt.compare(oldPass, row.password);
        if (!ok) return { success: false, error: "Incorrect current password." };

        const hash = await bcrypt.hash(newPass, saltRounds);
        await dbRun(db, "UPDATE users SET password = ? WHERE id = ?", [hash, id]);

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function deleteUser(idToDelete, selfId) {
    if (idToDelete === selfId)
        return { success: false, error: "You cannot delete yourself." };

    if (idToDelete === 1)
        return { success: false, error: "Cannot delete primary Super Admin." };

    try {
        const row = await dbGet(
            getDatabase(),
            "SELECT username FROM users WHERE id = ?",
            [idToDelete]
        );
        if (!row) return { success: false, error: "User not found." };

        await dbRun(getDatabase(), "DELETE FROM users WHERE id = ?", [idToDelete]);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ==============================
// JWT SECRET MANAGEMENT
// ==============================
async function getJwtSecret() {
    const db = getDatabase();
    try {
        const row = await dbGet(
            db,
            "SELECT value FROM system_settings WHERE key = 'jwt_secret'"
        );

        if (row?.value) return row.value;

        const secret = require("crypto").randomBytes(64).toString("hex");
        await dbRun(
            db,
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('jwt_secret', ?)",
            [secret]
        );
        return secret;
    } catch {
        return "fallback_secret";
    }
}

// ==============================
// ACTIVATION KEY
// ==============================
async function verifyActivationKey(inputKey) {
    try {
        const row = await dbGet(
            getDatabase(),
            "SELECT value FROM system_settings WHERE key = 'master_activation_key'"
        );

        return inputKey === (row?.value || "74482");
    } catch {
        return false;
    }
}

// ==============================
// EXPORTS
// ==============================
module.exports = {
    // Permissions
    getSuperAdminFeatureFlags,
    getUserPermissions,
    saveUserPermissions,
    checkUserDelegatedAccess,
    checkAdminFeatureAccess,

    // Auth
    login,
    registerUser,
    resetUserPassword,
    changeMyPassword,
    deleteUser,

    // Security
    getJwtSecret,
    verifyActivationKey,
};
