// FILE: src-electron/db/queries/core.cjs

const { getDatabase } = require('../database.cjs');
const bcrypt = require('bcrypt');

const saltRounds = 10;

// Validation helpers
const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validateRequired = (field, name) => {
  if (!field || (typeof field === 'string' && field.trim() === '')) {
    return `${name} is required.`;
  }
  return null;
};

const validatePositiveNumber = (field, name) => {
  const num = parseFloat(field);
  if (isNaN(num) || num < 0) {
    return `${name} must be a valid positive number.`;
  }
  return null;
};

// Promise-based DB helpers
const dbRun = (db, sql, params) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const dbGet = (db, sql, params) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (db, sql, params) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

// Friendly error mapper
function mapErrorToFriendly(err) {
  if (!err) return 'Unexpected error occurred.';
  const msg = typeof err === 'string' ? err : (err.message || err.toString());

  if (msg.includes('SQLITE_CONSTRAINT') || msg.includes('UNIQUE constraint')) {
    if (msg.includes('placements.candidate_id') || msg.includes('candidate_id, job_order_id')) {
      return 'This candidate is already assigned to that job.';
    }
    if (msg.toLowerCase().includes('passport')) return 'Duplicate passport number found.';
    if (msg.toLowerCase().includes('aadhar')) return 'Duplicate Aadhar number found.';
    if (msg.toLowerCase().includes('contact')) return 'Duplicate contact number found.';
    if (msg.toLowerCase().includes('username') || msg.toLowerCase().includes('users.username')) {
      return 'Username already exists.';
    }
    return 'Duplicate entry found. Please check your details.';
  }

  if (msg.toLowerCase().includes('validation failed')) {
    return 'Some fields need correction. Please review your input.';
  }

  if (msg.toLowerCase().includes('not found')) {
    return 'Record not found.';
  }

  if (msg.includes('SQLITE_ERROR') || msg.toLowerCase().includes('database')) {
    return 'Database error. Please try again.';
  }

  if (msg.includes('Cannot read properties of undefined')) {
    return 'Data loading error. Please refresh the page.';
  }

  if (msg.length > 150) {
    return 'An error occurred. Please try again.';
  }

  return msg.replace(/^Error:\s*/i, '').trim();
}

module.exports = {
  getDatabase,
  bcrypt,
  saltRounds,
  validateEmail,
  validateRequired,
  validatePositiveNumber,
  dbRun,
  dbGet,
  dbAll,
  mapErrorToFriendly,
};
