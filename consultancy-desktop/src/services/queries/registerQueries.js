// src/services/queries/registerQueries.js
// 👤 User Registration for RegisterPage.jsx
// registerNewUser → getAllUsers (admin view)

const getDatabase = require('../database.cjs');
const bcrypt = require('bcrypt');
const { saltRounds } = require('../config');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * Register new user (RegisterPage.jsx → registerNewUser)
 * Self-registration: staff (default), admin selectable
 */
async function registerNewUser(username, password, role) {
  const db = getDatabase();
  const errors = {};

  // Validation
  if (validateRequired(username, 'Username')) {
    errors.username = validateRequired(username, 'Username');
  }
  if (validateRequired(password, 'Password')) {
    errors.password = validateRequired(password, 'Password');
  }
  if (!errors.password && password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  // Role validation (self-reg can't create superadmin)
  const allowedRoles = ['staff', 'admin'];
  if (!allowedRoles.includes(role)) {
    errors.role = 'Invalid role selected.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  try {
    // Hash password
    const hash = await bcrypt.hash(password, saltRounds);
    
    // Insert user
    const sql = `
      INSERT INTO users (username, password, role) 
      VALUES (?, ?, ?)
    `;
    const result = await dbRun(db, sql, [username.trim(), hash, role]);
    
    return {
      success: true,
      data: {
        id: result.lastID,
        username: username.trim(),
        role
      }
    };
  } catch (dbErr) {
    if (dbErr.message.includes('UNIQUE constraint failed')) {
      return {
        success: false,
        error: mapErrorToFriendly('Username already exists.')
      };
    }
    console.error('registerNewUser DB Error:', dbErr);
    return {
      success: false,
      error: mapErrorToFriendly(dbErr)
    };
  }
}

/**
 * Get all users (Admin panel → list existing users)
 */
async function getAllUsers() {
  const db = getDatabase();
  try {
    const sql = `
      SELECT id, username, role 
      FROM users 
      ORDER BY username ASC
    `;
    const rows = await dbAll(db, sql);
    
    return {
      success: true,
      data: rows
    };
  } catch (err) {
    console.error('getAllUsers error:', err);
    return {
      success: false,
      error: mapErrorToFriendly('Failed to fetch existing users.')
    };
  }
}

/**
 * Add user (Admin panel → addUser, superset of registerNewUser)
 * Allows superadmin creation (admin-only)
 */
async function addUser(username, password, role) {
  const db = getDatabase();
  
  // Validation
  const errors = {};
  if (validateRequired(username, 'Username')) {
    errors.username = validateRequired(username, 'Username');
  }
  if (validateRequired(password, 'Password')) {
    errors.password = validateRequired(password, 'Password');
  }
  if (!errors.password && password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  try {
    // Hash password
    const hash = await bcrypt.hash(password, saltRounds);
    
    // Insert user
    const sql = `
      INSERT INTO users (username, password, role) 
      VALUES (?, ?, ?)
    `;
    const result = await dbRun(db, sql, [username.trim(), hash, role]);
    
    return {
      success: true,
      data: {
        id: result.lastID,
        username: username.trim(),
        role
      }
    };
  } catch (dbErr) {
    if (dbErr.message.includes('UNIQUE constraint failed')) {
      return {
        success: false,
        error: mapErrorToFriendly('Username already exists.')
      };
    }
    console.error('addUser DB Error:', dbErr);
    return {
      success: false,
      error: mapErrorToFriendly(dbErr)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from RegisterPage.jsx
module.exports = {
  registerNewUser,
  getAllUsers,
  addUser
};
