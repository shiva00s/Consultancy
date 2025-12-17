// src/services/queries/permissionQueries.js
// 🔧 Module Permissions for ModulesPage.jsx
// SuperAdmin: getAllModules/bulkToggleModules | Admin: getEnabledModules/bulkUpdatePermissions

const getDatabase = require('../database.cjs');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly } = require('./utils.cjs');

/**
 * Get ALL modules (SuperAdmin → getAllModules)
 * Returns complete modules list with isEnabled flags
 */
async function getAllModules() {
  const db = getDatabase();
  try {
    // Static modules config (matches frontend expectations)
    const modules = [
      // Menu Items
      { modulekey: 'dashboard', modulename: 'Dashboard', moduletype: 'menu', route: '/dashboard', isenabled: true },
      { modulekey: 'candidates', modulename: 'Candidates', moduletype: 'menu', route: '/candidates', isenabled: true },
      { modulekey: 'employers', modulename: 'Employers', moduletype: 'menu', route: '/employers', isenabled: true },
      { modulekey: 'joborders', modulename: 'Job Orders', moduletype: 'menu', route: '/joborders', isenabled: true },
      { modulekey: 'placements', modulename: 'Placements', moduletype: 'menu', route: '/placements', isenabled: true },
      
      // Submenus
      { modulekey: 'candidate-add', modulename: 'Add Candidate', moduletype: 'submenu', route: '/candidates/add', isenabled: true },
      { modulekey: 'candidate-detail', modulename: 'Candidate Detail', moduletype: 'submenu', route: '/candidates/:id', isenabled: true },
      
      // Candidate Tabs
      { modulekey: 'documents-tab', modulename: 'Documents Tab', moduletype: 'tab', route: 'documents', isenabled: true },
      { modulekey: 'visa-tab', modulename: 'Visa Tab', moduletype: 'tab', route: 'visa', isenabled: true },
      { modulekey: 'passport-tab', modulename: 'Passport Tab', moduletype: 'tab', route: 'passport', isenabled: true },
      { modulekey: 'medical-tab', modulename: 'Medical Tab', moduletype: 'tab', route: 'medical', isenabled: true },
      { modulekey: 'interviews-tab', modulename: 'Interviews Tab', moduletype: 'tab', route: 'interviews', isenabled: true },
      { modulekey: 'travel-tab', modulename: 'Travel Tab', moduletype: 'tab', route: 'travel', isenabled: true },
      
      // Features
      { modulekey: 'reports', modulename: 'Reports', moduletype: 'feature', route: null, isenabled: true },
      { modulekey: 'recyclebin', modulename: 'Recycle Bin', moduletype: 'feature', route: '/recycle-bin', isenabled: true },
      { modulekey: 'bulkimport', modulename: 'Bulk Import', moduletype: 'feature', route: '/bulk-import', isenabled: true },
      { modulekey: 'modules', modulename: 'Modules Page', moduletype: 'feature', route: '/modules', isenabled: true }
    ];

    return {
      success: true,
      data: modules
    };
  } catch (err) {
    console.error('getAllModules error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Get ENABLED modules only (Admin → getEnabledModules)
 * Filters modules where isEnabled = true
 */
async function getEnabledModules() {
  try {
    const allModules = await getAllModules();
    if (!allModules.success) {
      return allModules;
    }

    const enabled = allModules.data.filter(module => module.isenabled);
    
    return {
      success: true,
      data: enabled
    };
  } catch (err) {
    console.error('getEnabledModules error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err),
      data: []
    };
  }
}

/**
 * Bulk toggle modules (SuperAdmin → bulkToggleModules)
 * Updates SA's features JSON in users table
 */
async function bulkToggleModules(user, updates) {
  const db = getDatabase();
  try {
    // Get current SA features
    const saRow = await dbGet(db, `
      SELECT features FROM users WHERE role = 'superadmin' LIMIT 1
    `);
    
    let currentFeatures = {};
    if (saRow && saRow.features) {
      currentFeatures = JSON.parse(saRow.features);
    }

    // Apply updates
    updates.forEach(([moduleKey, isEnabled]) => {
      currentFeatures[moduleKey] = isEnabled;
    });

    // Save back to SA user
    const featuresJson = JSON.stringify(currentFeatures);
    await dbRun(db, `
      UPDATE users 
      SET features = ? 
      WHERE role = 'superadmin'
    `, [featuresJson]);

    return {
      success: true,
      message: `${updates.length} modules updated`
    };
  } catch (err) {
    console.error('bulkToggleModules error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Bulk update user permissions (Admin → bulkUpdatePermissions)
 * Saves user-specific flags to userpermissions table
 */
async function bulkUpdatePermissions(user, userId, moduleKeys) {
  const db = getDatabase();
  try {
    // Convert moduleKeys array to flags object
    const flags = {};
    moduleKeys.forEach(key => {
      flags[key] = true;
    });

    const flagsJson = JSON.stringify(flags);
    const sql = `
      INSERT OR REPLACE INTO userpermissions (userid, flags) 
      VALUES (?, ?)
    `;
    
    await dbRun(db, sql, [userId, flagsJson]);

    return {
      success: true,
      message: `${moduleKeys.length} permissions updated`
    };
  } catch (err) {
    console.error('bulkUpdatePermissions error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Get SuperAdmin feature flags (Policy ceiling)
 */
async function getSuperAdminFeatureFlags() {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT features FROM users WHERE role = 'superadmin' LIMIT 1
    `);

    if (row && row.features) {
      return {
        success: true,
        data: JSON.parse(row.features)
      };
    }

    return {
      success: true,
      data: {} // Default empty
    };
  } catch (err) {
    console.error('getSuperAdminFeatureFlags DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to retrieve global policy flags.')
    };
  }
}

/**
 * Get user permissions (Delegation check)
 */
async function getUserPermissions(userId) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT flags FROM userpermissions WHERE userid = ?
    `, [userId]);

    return {
      success: true,
      data: row ? JSON.parse(row.flags) : null
    };
  } catch (err) {
    console.error('getUserPermissions DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to retrieve user permissions.')
    };
  }
}

/**
 * Save user permissions
 */
async function saveUserPermissions(userId, flags) {
  const db = getDatabase();
  const flagsJson = JSON.stringify(flags);
  
  try {
    const sql = `
      INSERT OR REPLACE INTO userpermissions (userid, flags) 
      VALUES (?, ?)
    `;
    await dbRun(db, sql, [userId, flagsJson]);
    
    return { success: true };
  } catch (err) {
    console.error('saveUserPermissions DB Error:', err.message);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to save user permissions.')
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from ModulesPage.jsx
module.exports = {
  // SuperAdmin
  getAllModules,
  bulkToggleModules,
  
  // Admin
  getEnabledModules,
  bulkUpdatePermissions,
  
  // Shared
  getSuperAdminFeatureFlags,
  getUserPermissions,
  saveUserPermissions
};
