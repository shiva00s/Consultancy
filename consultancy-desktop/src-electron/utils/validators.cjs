function validateVerhoeff(aadhaarNumber) {
    // Multiplication table
    const d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];
    
    // Permutation table
    const p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];
    
    // Input validation
    if (typeof aadhaarNumber !== 'string') {
        return false;
    }
    
    // Remove all non-digit characters
    const cleanNumber = aadhaarNumber.replace(/\D/g, '');
    
    if (cleanNumber.length !== 12) {
        return false;
    }
    
    // Verhoeff algorithm
    let c = 0;
    const invertedArray = cleanNumber.split('').map(Number).reverse();
    
    for (let i = 0; i < invertedArray.length; i++) {
        c = d[c][p[(i % 8)][invertedArray[i]]];
    }
    
    return c === 0;
}

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

module.exports = { validateVerhoeff };