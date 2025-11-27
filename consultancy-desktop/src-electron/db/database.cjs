const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const saltRounds = 10;
let db;

// ==========================================
// 1. DEFINE MIGRATIONS HERE
// ==========================================
// Add new SQL changes here as you build new features.
const MIGRATIONS = [
  // Version 1: Initial Schema (Handled by setupDatabase, but we reserve index 0)
  { version: 1, up: async (db) => { console.log('Base schema assumed.'); } },

  // Version 2: Add 'createdAt' to visa_tracking if missing (Fixes your recent crash)
  {
    version: 2,
    up: async (db) => {
      try {
        await new Promise((resolve, reject) => {
          db.run(`ALTER TABLE visa_tracking ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
            // Ignore "duplicate column" error, fail on others
            if (err && !err.message.includes('duplicate column')) reject(err);
            else resolve();
          });
        });
        console.log('Migration 2 Applied: Added createdAt to visa_tracking');
      } catch (e) { console.log('Migration 2 skipped or failed:', e.message); }
    }
  },

  // Version 3: Add 'updatedAt' for better sorting
  {
    version: 3,
    up: async (db) => {
      const tables = ['candidates', 'visa_tracking', 'job_orders'];
      for (const table of tables) {
        await new Promise((resolve) => {
          db.run(`ALTER TABLE ${table} ADD COLUMN updatedAt DATETIME`, (err) => resolve());
        });
      }
      console.log('Migration 3 Applied: Added updatedAt columns');
    }
  }
];

// ==========================================
// 2. CORE SETUP
// ==========================================

function setupDatabase(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      dbInstance.run('BEGIN TRANSACTION');

      // --- Tables ---
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'staff',
          features TEXT 
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY, 
          value TEXT
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, education TEXT,
          experience INTEGER, dob TEXT, passportNo TEXT UNIQUE, passportExpiry TEXT,
          contact TEXT, aadhar TEXT, status TEXT DEFAULT 'New', notes TEXT,
          Position TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, fileType TEXT, 
          fileName TEXT, filePath TEXT UNIQUE, category TEXT DEFAULT 'Uncategorized',
          isDeleted INTEGER DEFAULT 0, FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS employers (
          id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT NOT NULL, country TEXT,
          contactPerson TEXT, contactEmail TEXT, notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS job_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT, employer_id INTEGER NOT NULL, positionTitle TEXT NOT NULL,
          country TEXT, openingsCount INTEGER DEFAULT 1, status TEXT DEFAULT 'Open',
          requirements TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (employer_id) REFERENCES employers (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS placements (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, job_order_id INTEGER NOT NULL,
          assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'Assigned', isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE CASCADE,
          UNIQUE(candidate_id, job_order_id)
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id INTEGER PRIMARY KEY,
          flags TEXT, 
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS passport_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          candidate_id INTEGER NOT NULL,
          received_date TEXT, received_notes TEXT,
          dispatch_date TEXT, docket_number TEXT, dispatch_notes TEXT,
          passport_status TEXT NOT NULL DEFAULT 'Received',
          source_type TEXT NOT NULL DEFAULT 'Direct Candidate',
          agent_contact TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS visa_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          candidate_id INTEGER NOT NULL, 
          country TEXT NOT NULL,
          visa_type TEXT, 
          application_date TEXT, 
          status TEXT DEFAULT 'Pending', 
          notes TEXT,
          position TEXT,
          passport_number TEXT,
          travel_date TEXT,
          contact_type TEXT DEFAULT 'Direct Candidate',
          agent_contact TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS interview_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, job_order_id INTEGER,
          interview_date TEXT NOT NULL, round TEXT, status TEXT DEFAULT 'Scheduled',
          notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE SET NULL
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS medical_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, test_date TEXT,
          certificate_path TEXT, status TEXT DEFAULT 'Pending', notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS travel_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, pnr TEXT,
          travel_date TEXT, ticket_file_path TEXT, departure_city TEXT,
          arrival_city TEXT, notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, description TEXT NOT NULL,
          total_amount REAL NOT NULL, amount_paid REAL DEFAULT 0, status TEXT DEFAULT 'Pending',
          due_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT,
          action TEXT NOT NULL, target_type TEXT, target_id INTEGER,
          details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS communication_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          user_id INTEGER,
          type TEXT NOT NULL,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS required_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          name TEXT NOT NULL UNIQUE,
          isDeleted INTEGER DEFAULT 0 
        );
      `);

      dbInstance.run('COMMIT', (err) => {
        if (err) {
          console.error('Schema setup failed:', err.message);
          reject(err);
        } else {
          resolve(dbInstance);
        }
      });
    });
  });
}

// ==========================================
// 3. MIGRATION RUNNER
// ==========================================
async function runMigrations(db) {
  return new Promise((resolve, reject) => {
    // 1. Get current version
    db.get("PRAGMA user_version", async (err, row) => {
      if (err) return reject(err);
      
      let currentVersion = row.user_version;
      console.log(`Current DB Version: ${currentVersion}`);

      // 2. Run newer migrations
      for (const migration of MIGRATIONS) {
        if (migration.version > currentVersion) {
          console.log(`Applying Migration v${migration.version}...`);
          try {
            await migration.up(db);
            // Update version after success
            await new Promise((res) => db.run(`PRAGMA user_version = ${migration.version}`, res));
            currentVersion = migration.version;
          } catch (migErr) {
            console.error(`Migration v${migration.version} failed:`, migErr);
            // Stop on error to prevent corruption
            return reject(migErr);
          }
        }
      }
      
      console.log(`Database now at Version: ${currentVersion}`);
      resolve();
    });
  });
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'consultancy.db');
  console.log('Database path:', dbPath);

  return new Promise((resolve, reject) => {
    const dbInstance = new sqlite3.Database(dbPath, async (err) => {
      if (err) return reject(err);
      
      console.log('Connected to SQLite.');
      
      // Performance tuning
      dbInstance.run('PRAGMA journal_mode = WAL;');
      dbInstance.run('PRAGMA foreign_keys = ON;');

      try {
        // 1. Ensure base tables exist
        await setupDatabase(dbInstance);
        
        // 2. Run Migrations (Fixes missing columns)
        await runMigrations(dbInstance);
        
        // 3. Ensure Admin Exists
        await ensureInitialUserAndRoles(dbInstance);
        
        global.db = dbInstance;
        resolve(dbInstance);
        
      } catch (setupError) {
        console.error("DB Init Failed:", setupError);
        reject(setupError);
      }
    });
  });
}

// Helper: Ensure default Super Admin
async function ensureInitialUserAndRoles(dbInstance) {
    const superAdminUser = 'admin';
    const superAdminPass = 'superadmin123';
    
    const anyUser = await new Promise((resolve, reject) => {
        dbInstance.get('SELECT id FROM users LIMIT 1', [], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });

    if (!anyUser) {
        const hash = await bcrypt.hash(superAdminPass, saltRounds);
        await new Promise((resolve) => {
            dbInstance.run(
                "INSERT INTO users (id, username, password, role) VALUES (1, ?, ?, 'super_admin')",
                [superAdminUser, hash],
                () => resolve()
            );
        });
        console.log('Created default Super Admin.');
    }
    return dbInstance;
}

function getDatabase() {
  if (!global.db) {
    console.error('Database has not been initialized.');
    return null;
  }
  return global.db;
}

module.exports = { initializeDatabase, getDatabase };