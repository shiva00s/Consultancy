const { dbGet, dbRun, getDatabase } = require("./dbHelpers.cjs");

// ------------------------------------------------------------
// SUPER ADMIN FEATURE FLAGS
// ------------------------------------------------------------
async function getSuperAdminFeatureFlags() {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT features FROM users WHERE role = 'super_admin' LIMIT 1");
        if (!row || !row.features) return { success: true, data: {} };
        return { success: true, data: JSON.parse(row.features) };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ------------------------------------------------------------
// USER DELEGATED FEATURE FLAGS
// ------------------------------------------------------------
async function getUserPermissions(userId) {
    const db = getDatabase();
    try {
        const row = await dbGet(db, "SELECT flags FROM user_permissions WHERE user_id = ?", [userId]);
        return { success: true, data: row ? JSON.parse(row.flags) : {} };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function saveUserPermissions(userId, flags) {
    const db = getDatabase();
    try {
        await dbRun(
            db,
            "INSERT OR REPLACE INTO user_permissions (user_id, flags) VALUES (?, ?)",
            [userId, JSON.stringify(flags)]
        );
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ------------------------------------------------------------
// MAIN ACCESS CHECKER
// ------------------------------------------------------------
async function checkUserDelegatedAccess(user, featureKey) {
    if (!user) return { success: false, error: "Invalid user." };

    // Super Admin always allowed
    if (user.role === "super_admin") return { success: true };

    // 1. Get global ceiling
    const ceiling = await getSuperAdminFeatureFlags();
    if (!ceiling.success || ceiling.data[featureKey] !== true) {
        return { success: false, error: `Feature "${featureKey}" disabled globally.` };
    }

    // 2. Get delegated flags
    const delegated = await getUserPermissions(user.id);
    const flags = delegated.data || {};

    // 3. Check if explicitly allowed
    if (flags[featureKey] === true) return { success: true };

    return { success: false, error: `Access Denied: No permission for "${featureKey}".` };
}

// ------------------------------------------------------------
// ALIASED CHECKER (Backward compatibility)
// ------------------------------------------------------------
async function checkAdminFeatureAccess(user, featureKey) {
    return checkUserDelegatedAccess(user, featureKey);
}

module.exports = {
    getSuperAdminFeatureFlags,
    getUserPermissions,
    saveUserPermissions,
    checkUserDelegatedAccess,
    checkAdminFeatureAccess
};
