// FILE: src-electron/db/database.cjs

const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const saltRounds = 10;

const { setupDatabaseSchema } = require('./schema/mainSchema.cjs');
const { runMigrations } = require('./migrations.cjs');
const { seedFeatureFlags, seedInitialData } = require('./seeders/initialDataSeeder.cjs');

// ============================================================================
// DEFAULT USER SETUP (Shiva00s admin)
// ============================================================================

async function ensureInitialUserAndRoles(dbInstance) {
  const superAdminUser = 'Shiva00s';
  const superAdminPass = 'Shiva@74482';

  return new Promise((resolve, reject) => {
    dbInstance.get(
      'SELECT * FROM users WHERE username = ?',
      [superAdminUser],
      async (err, row) => {
        if (err) {
          console.error('❌ Error checking super admin:', err);
          return reject(err);
        }

        if (!row) {
          try {
            const hashedPass = await bcrypt.hash(superAdminPass, saltRounds);
            dbInstance.run(
              `INSERT INTO users (username, password, role) VALUES (?, ?, 'super_admin')`,
              [superAdminUser, hashedPass],
              (err2) => {
                if (err2) {
                  console.error('❌ Error creating super admin:', err2);
                  return reject(err2);
                }
                console.log('✅ Super admin created successfully');
                resolve(dbInstance);
              }
            );
          } catch (hashErr) {
            console.error('❌ Password hashing failed:', hashErr);
            reject(hashErr);
          }
        } else {
          console.log('✅ Super admin already exists');
          resolve(dbInstance);
        }
      }
    );
  });
}

// ============================================================================
// SMTP SETTINGS
// ============================================================================

async function ensureDefaultSmtpSettings(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.get(
      "SELECT value FROM system_settings WHERE key = 'smtp_config'",
      [],
      (err, row) => {
        if (err) {
          console.error('❌ Error checking SMTP settings:', err);
          return reject(err);
        }

        if (!row) {
          console.log('📧 Creating default SMTP configuration...');

          const defaultSmtpConfig = {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            user: 'prakashshiva368@gmail.com',
            pass: 'dijc fgcf zfxv bhpc',
          };

          dbInstance.run(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_config', ?)",
            [JSON.stringify(defaultSmtpConfig)],
            (err2) => {
              if (err2) {
                console.error('❌ Error creating default SMTP config:', err2);
                return reject(err2);
              }
              console.log(
                '✅ Default SMTP configuration created (needs user configuration)'
              );
              resolve(dbInstance);
            }
          );
        } else {
          console.log('✅ SMTP configuration already exists');
          resolve(dbInstance);
        }
      }
    );
  });
}

// ============================================================================
// INITIALIZE DATABASE
// ============================================================================

function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'consultancy.db');
  console.log('📂 Database path:', dbPath);

  return new Promise((resolve, reject) => {
    const dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Failed to open database:', err);
        return reject(err);
      }

      console.log('✅ Database connection opened');

      dbInstance.run('PRAGMA foreign_keys = ON;', (fkErr) => {
        if (fkErr) {
          console.error('❌ Failed to enable foreign keys:', fkErr);
          return reject(fkErr);
        }

        setupDatabaseSchema(dbInstance)
          .then((db) => runMigrations(db))
          .then((db) => ensureInitialUserAndRoles(db))
          .then((db) => ensureDefaultSmtpSettings(db))
          .then((db) => seedInitialData(db).then(() => db))
          .then((db) => {
            global.db = db;
            return seedFeatureFlags(db).then(() => db);
          })
          .then((db) => {
            console.log('✅ Database initialized successfully');
            resolve(db);
          })
          .catch((initErr) => {
            console.error('❌ Database initialization failed:', initErr);
            reject(initErr);
          });
      });
    });
  });
}

// ============================================================================
// HELPERS & EXPORTS
// ============================================================================

function getDatabase() {
  if (!global.db) {
    console.error('❌ Database has not been initialized.');
    return null;
  }
  return global.db;
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    const db = global.db;

    if (!db) {
      console.log('⚠️ No database connection to close');
      return resolve(true);
    }

    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
        return reject(err);
      }

      global.db = null;
      console.log('✅ SQLite database closed cleanly');
      resolve(true);
    });
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getDb: getDatabase,
  closeDatabase,
  dbRun,
  dbGet,
  dbAll,
};
