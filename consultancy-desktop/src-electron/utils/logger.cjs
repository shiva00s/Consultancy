const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function ensureLogsDir() {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch (e) {
    return null;
  }
}

function writeErrorToFile(message) {
  try {
    const dir = ensureLogsDir();
    if (!dir) return;
    const file = path.join(dir, 'errors.log');
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(file, line, { encoding: 'utf8' });
  } catch (e) {
    // swallow
  }
}

const SHOULD_SHOW_LOGS = process.env.APP_LOGS === 'true';

function info(...args) {
  if (SHOULD_SHOW_LOGS) console.info(...args);
}

function debug(...args) {
  if (SHOULD_SHOW_LOGS) console.debug(...args);
}

function warn(...args) {
  if (SHOULD_SHOW_LOGS) console.warn(...args);
}

function error(...args) {
  try {
    const msg = args.map((a) => (a && a.stack) ? a.stack : String(a)).join(' ');
    // Always persist errors to file in production so we can diagnose crashes
    if (process.env.NODE_ENV === 'production') {
      writeErrorToFile(msg);
    }
    // Only print to console if explicitly enabled
    if (SHOULD_SHOW_LOGS) console.error(...args);
  } catch (e) {
    // swallow
  }
}

module.exports = { info, debug, warn, error };
// src-electron/db/audit.cjs
const { getDatabase } = require('./database.cjs');

const logAction = (user, action, target_type, target_id, details = null) => {
  try {
    const db = getDatabase();
    if (!db) {
      console.error('Audit Log: Database is not initialized.');
      return;
    }

    // ✅ validate user
    if (!user || !user.id) {
      console.warn('⚠️ Audit log skipped: Invalid user object', {
        action,
        target_type,
        target_id,
      });
      return;
    }

    const safeUsername = user.username || `User_${user.id}`;

    const sql = `
      INSERT INTO audit_log (user_id, username, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [user.id, safeUsername, action, target_type, target_id, details], (err) => {
      if (err) {
        console.error('Failed to write to audit_log:', err.message);
      }
    });
  } catch (e) {
    console.error('Critical error in logAction:', e.message);
  }
};

module.exports = { logAction };
