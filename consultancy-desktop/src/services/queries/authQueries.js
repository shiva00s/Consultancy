// src/services/queries/authQueries.js
// 🔐 Authentication & User Management for LoginPage.jsx
// login → getAllUsers → addUser → resetUserPassword → changeMyPassword

const getDatabase = require('../database.cjs');
const bcrypt = require('bcrypt');
const { saltRounds } = require('../config');
const { dbGet, dbAll, dbRun } = require('./dbHelpers.cjs');
const { mapErrorToFriendly, validateRequired } = require('./utils.cjs');

/**
 * User login (LoginPage.jsx → window.electronAPI.login)
 * Returns {id, username, role} on success
 */
async function login(username, password) {
  const db = getDatabase();
  try {
    const row = await dbGet(db, `
      SELECT id, password, role, username 
      FROM users 
      WHERE username = ?
    `, [username]);

    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('Invalid username or password.')
      };
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
      return {
        success: false,
        error: mapErrorToFriendly('Invalid username or password.')
      };
    }
  } catch (err) {
    console.error('login error:', err);
    return {
      success: false,
      error: mapErrorToFriendly('A database or password error occurred.')
    };
  }
}

/**
 * Get all users (Admin panel)
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
 * Add new user (Admin panel → addUser)
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
    const result = await dbRun(db, sql, [username, hash, role]);
    
    return {
      success: true,
      data: {
        id: result.lastID,
        username,
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

/**
 * Reset user password (Admin panel → resetUserPassword)
 */
async function resetUserPassword(id, newPassword) {
  const db = getDatabase();
  
  const errors = {};
  if (validateRequired(newPassword, 'New Password')) {
    errors.newPassword = validateRequired(newPassword, 'New Password');
  }
  if (!errors.newPassword && newPassword.length < 6) {
    errors.newPassword = 'Password must be at least 6 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  try {
    const hash = await bcrypt.hash(newPassword, saltRounds);
    const sql = `
      UPDATE users 
      SET password = ? 
      WHERE id = ?
    `;
    const result = await dbRun(db, sql, [hash, id]);
    
    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly('User not found.')
      };
    }

    return {
      success: true
    };
  } catch (err) {
    console.error('resetUserPassword error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Change own password (User settings → changeMyPassword)
 */
async function changeMyPassword(id, oldPassword, newPassword) {
  const db = getDatabase();
  
  const errors = {};
  if (validateRequired(newPassword, 'New Password')) {
    errors.newPassword = validateRequired(newPassword, 'New Password');
  }
  if (!errors.newPassword && newPassword.length < 6) {
    errors.newPassword = 'New Password must be at least 6 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: mapErrorToFriendly('Validation failed', errors),
      errors
    };
  }

  try {
    // Verify old password
    const row = await dbGet(db, `
      SELECT password FROM users WHERE id = ?
    `, [id]);

    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('User not found.')
      };
    }

    const match = await bcrypt.compare(oldPassword, row.password);
    if (!match) {
      return {
        success: false,
        error: mapErrorToFriendly('Incorrect current password.')
      };
    }

    // Update password
    const hash = await bcrypt.hash(newPassword, saltRounds);
    await dbRun(db, `
      UPDATE users 
      SET password = ? 
      WHERE id = ?
    `, [hash, id]);

    return {
      success: true
    };
  } catch (err) {
    console.error('changeMyPassword error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

/**
 * Delete user (Admin panel → selfId protection)
 */
async function deleteUser(idToDelete, selfId) {
  const db = getDatabase();
  
  // Safety checks
  if (selfId === idToDelete) {
    return {
      success: false,
      error: mapErrorToFriendly('You cannot delete your own account.')
    };
  }
  
  if (idToDelete === 1) {
    return {
      success: false,
      error: mapErrorToFriendly('Cannot delete the primary Super Admin account.')
    };
  }

  try {
    const row = await dbGet(db, `
      SELECT username FROM users WHERE id = ?
    `, [idToDelete]);

    if (!row) {
      return {
        success: false,
        error: mapErrorToFriendly('User not found.')
      };
    }

    const result = await dbRun(db, `
      DELETE FROM users WHERE id = ?
    `, [idToDelete]);

    if (result.changes === 0) {
      return {
        success: false,
        error: mapErrorToFriendly('User not found.')
      };
    }

    return {
      success: true,
      deletedId: idToDelete,
      deletedUsername: row.username
    };
  } catch (err) {
    console.error('deleteUser error:', err);
    return {
      success: false,
      error: mapErrorToFriendly(err)
    };
  }
}

// 🔒 EXPORTS - Exact IPC handler names from LoginPage.jsx + Admin
module.exports = {
  login,
  getAllUsers,
  addUser,
  resetUserPassword,
  changeMyPassword,
  deleteUser
};
