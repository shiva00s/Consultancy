// FILE: src-electron/db/database.cjs
// ✅ UPDATED: Auto-creates SMTP settings on initialization

const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const saltRounds = 10;

// ============================================================================
// DATABASE SCHEMA SETUP
// ============================================================================

function setupDatabase(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      
      // Start transaction
      dbInstance.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Failed to BEGIN TRANSACTION:', err.message);
          return reject(new Error('Failed to BEGIN TRANSACTION.'));
        }
      });

      

      // ========================================================================
      // 1. USERS TABLE
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'staff',
          features TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 2. SYSTEM SETTINGS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 3. SMTP SETTINGS (IMPORTANT FOR EMAIL)
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS smtp_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          user TEXT NOT NULL,
          pass TEXT NOT NULL,
          from_email TEXT,
          is_configured INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 4. LICENSE ACTIVATION TABLES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS license_activation (
          machine_id TEXT PRIMARY KEY,
          activated_at TEXT NOT NULL,
          activated_by TEXT DEFAULT 'system',
          notes TEXT
        );
      `);

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS activation_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machine_id TEXT NOT NULL,
          activation_code TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          email TEXT,
          used INTEGER DEFAULT 0,
          used_at TEXT
        );
      `);

      // Create indexes for activation tables
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_activation_machine 
        ON license_activation(machine_id);
      `);

      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_activation_requests_machine 
        ON activation_requests(machine_id, activation_code);
      `);

      // ========================================================================
      // 5. OLD ACTIVATIONS TABLE (Keep for backwards compatibility)
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS activations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machineId TEXT UNIQUE,
          code TEXT,
          activated INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 6. CANDIDATES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          education TEXT,
          experience INTEGER,
          dob TEXT,
          passportNo TEXT UNIQUE,
          passportExpiry TEXT,
          contact TEXT,
          aadhar TEXT,
          status TEXT DEFAULT 'New',
          notes TEXT,
          Position TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0
        );
      `);

      // ========================================================================
      // 7. DOCUMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          fileType TEXT,
          fileName TEXT,
          filePath TEXT UNIQUE,
          category TEXT DEFAULT 'Uncategorized',
          uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 8. CANDIDATE FILES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS candidate_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          filePath TEXT,
          description TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 9. EMPLOYERS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS employers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          companyName TEXT NOT NULL,
          country TEXT,
          contactPerson TEXT,
          contactEmail TEXT,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0
        );
      `);

      // ========================================================================
      // 10. JOB ORDERS
      // ========================================================================
      dbInstance.run(`
  CREATE TABLE IF NOT EXISTS job_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_id INTEGER NOT NULL,
  positionTitle TEXT NOT NULL,
  country TEXT,
  openingsCount INTEGER DEFAULT 1,
  status TEXT DEFAULT 'Open',
  requirements TEXT,
  food TEXT,
  accommodation TEXT,
  dutyHours TEXT,
  overtime TEXT,
  contractPeriod TEXT,
  selectionType TEXT DEFAULT 'CV Selection',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isDeleted INTEGER DEFAULT 0,
  FOREIGN KEY (employer_id) REFERENCES employers (id) ON DELETE CASCADE
);

`);

      // ========================================================================
      // 11. PLACEMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS placements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          job_order_id INTEGER NOT NULL,
          assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'Assigned',
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE CASCADE,
          UNIQUE(candidate_id, job_order_id)
        );
      `);

      // ========================================================================
      // 12. USER PERMISSIONS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id INTEGER PRIMARY KEY,
          flags TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 13. GRANULAR PERMISSIONS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_granular_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          module TEXT NOT NULL,
          tab TEXT,
          action TEXT NOT NULL,
          allowed INTEGER NOT NULL DEFAULT 0,
          UNIQUE(user_id, module, tab, action),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 14. PERMISSION MATRIX
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS permission_matrix (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module TEXT NOT NULL,
          tab TEXT,
          action TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE
        );
      `);

      // ========================================================================
      // 15. FEATURES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          description TEXT,
          default_enabled INTEGER DEFAULT 1
        );
      `);

      // ========================================================================
      // 16. ADMIN-STAFF FEATURE ASSIGNMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS admin_staff_feature_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          feature_key TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          UNIQUE(user_id, feature_key),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 17. SUPERADMIN ADMIN FEATURE TOGGLES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS superadmin_admin_feature_toggles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feature_key TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1
        );
      `);

      // ========================================================================
      // 18. ADMIN FEATURE ASSIGNMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS admin_feature_assignments (
          admin_id INTEGER NOT NULL,
          feature_key TEXT NOT NULL,
          enabled INTEGER DEFAULT 0,
          PRIMARY KEY (admin_id, feature_key),
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 19. MENU VISIBILITY
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS menu_visibility (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          menu_key TEXT NOT NULL,
          visible INTEGER NOT NULL DEFAULT 1,
          UNIQUE(role, menu_key)
        );
      `);

      // ========================================================================
      // 20. PASSPORT TRACKING
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS passport_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    
    -- Movement Type
    movement_type TEXT NOT NULL CHECK(movement_type IN ('RECEIVED', 'SENT')),
    
    -- RECEIVE FIELDS
    received_from TEXT,  -- Candidate/Agent/Embassy/Other
    received_by_method TEXT, -- By Hand/By Courier
    received_courier_number TEXT,
    date_received TEXT,
    received_by_staff TEXT,
    received_notes TEXT,
    received_photo_path TEXT,
    
    -- SEND FIELDS
    send_to TEXT, -- Candidate/Agent/Embassy/Employer/Other
    send_to_name TEXT,
    send_to_contact TEXT,
    send_by_method TEXT, -- By Hand/By Courier
    send_courier_number TEXT,
    date_sent TEXT,
    sent_by_staff TEXT,
    sent_notes TEXT,
    sent_photo_path TEXT,
    
    -- Metadata
    createdAt TEXT DEFAULT (datetime('now')),
    isDeleted INTEGER DEFAULT 0,
    
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );
      `);

      // ========================================================================
      // 21. VISA TRACKING
      // ========================================================================
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

      // ========================================================================
      // 22. INTERVIEW TRACKING
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS interview_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          job_order_id INTEGER,
          interview_date TEXT NOT NULL,
          round TEXT,
          status TEXT DEFAULT 'Scheduled',
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE SET NULL
        );
      `);

      // ========================================================================
      // 23. MEDICAL TRACKING
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS medical_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          test_date TEXT,
          certificate_path TEXT,
          status TEXT DEFAULT 'Pending',
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 24. TRAVEL TRACKING
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS travel_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          pnr TEXT,
          travel_date TEXT,
          ticket_file_path TEXT,
          departure_city TEXT,
          arrival_city TEXT,
          notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 25. PAYMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          total_amount REAL NOT NULL,
          amount_paid REAL DEFAULT 0,
          status TEXT DEFAULT 'Pending',
          due_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 26. AUDIT LOG
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id INTEGER,
          candidate_id INTEGER,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE SET NULL
        );
      `);

      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
      `);
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_audit_candidate ON audit_log(candidate_id);
      `);
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
      `);

      // ========================================================================
      // 27. SYSTEM AUDIT LOG (Additional)
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS system_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          user_id INTEGER,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `);

      // ========================================================================
      // 28. REQUIRED DOCUMENTS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS required_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          isDeleted INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 29. COMMUNICATION LOGS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS communication_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER,
          user_id INTEGER,
          communication_type TEXT,
          details TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE SET NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `);

      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_comm_logs_candidate ON communication_logs(candidate_id);
      `);
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_comm_logs_created ON communication_logs(createdAt DESC);
      `);

      // ========================================================================
      // 30. BUSINESS THEME
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS business_theme (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL
        );
      `);

      // ========================================================================
      // 31. FEATURE FLAGS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS feature_flags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          description TEXT,
          isDeleted INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // ========================================================================
      // 32. USER FEATURES (Junction Table)
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          feature_id INTEGER NOT NULL,
          enabled INTEGER DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, feature_id),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (feature_id) REFERENCES feature_flags (id) ON DELETE CASCADE
        );
      `);

      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_user_features_user ON user_features(user_id);
      `);

      // ========================================================================
      // 33. REMINDERS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          candidate_id INTEGER,
          module TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          remind_at TEXT NOT NULL,
          delivered INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 34. NOTIFICATIONS
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'info',
          priority TEXT DEFAULT 'normal',
          link TEXT,
          candidate_id INTEGER,
          action_required INTEGER DEFAULT 0,
          read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
        );
      `);


      
      // Commit transaction
      dbInstance.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ COMMIT failed:', err.message);
          return reject(new Error(err.message));
        }
        console.log('✅ Database schema created successfully');
        resolve(dbInstance);
      });
    });
  });
}

// ============================================================================
// DATABASE MIGRATIONS
// ============================================================================

function runMigrations(dbInstance) {
  return new Promise((resolve, reject) => {
    console.log('🔄 Checking for database migrations...');
    
    dbInstance.serialize(() => {
      // Migration 1: Add candidate_id to audit_log
      dbInstance.all("PRAGMA table_info(audit_log)", [], (err, columns) => {
        if (err) {
          console.error('❌ Error checking audit_log schema:', err);
          return reject(err);
        }

        const hasCandidate = columns.some(col => col.name === 'candidate_id');
        
        if (!hasCandidate) {
          console.log('📝 Running migration: Adding candidate_id to audit_log...');
          
          dbInstance.run(
            `ALTER TABLE audit_log ADD COLUMN candidate_id INTEGER;`,
            (err) => {
              if (err) {
                console.error('❌ Migration failed:', err);
                return reject(err);
              }
              
              dbInstance.run(
                `CREATE INDEX IF NOT EXISTS idx_audit_candidate ON audit_log(candidate_id);`,
                (err) => {
                  if (err) {
                    console.error('❌ Index creation failed:', err);
                    return reject(err);
                  }
                  
                  console.log('✅ Migration completed: candidate_id added to audit_log');
                  resolve(dbInstance);
                }
              );
            }
          );
        } else {
          console.log('✅ Migration skipped: candidate_id already exists');
          resolve(dbInstance);
        }
      });
    });
  });
}

// ============================================================================
// ✅ NEW: ENSURE DEFAULT SMTP SETTINGS
// ============================================================================

async function ensureDefaultSmtpSettings(dbInstance) {
  return new Promise((resolve, reject) => {
    // Check if SMTP config exists in system_settings
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
          
          // Default SMTP config (Gmail example - user must configure)
          const defaultSmtpConfig = {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            user: 'prakashshiva368@gmail.com', // User must change this
            pass: 'dijc fgcf zfxv bhpc',     // User must change this
          };

          dbInstance.run(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_config', ?)",
            [JSON.stringify(defaultSmtpConfig)],
            (err) => {
              if (err) {
                console.error('❌ Error creating default SMTP config:', err);
                return reject(err);
              }
              console.log('✅ Default SMTP configuration created (needs user configuration)');
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
// DATABASE INITIALIZATION
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

      dbInstance.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('❌ Failed to enable foreign keys:', err);
          return reject(err);
        }

        setupDatabase(dbInstance)
          .then((db) => runMigrations(db))
          .then((db) => ensureInitialUserAndRoles(db))
          .then((db) => ensureDefaultSmtpSettings(db)) // ✅ NEW: Setup SMTP
          .then((db) => {
            global.db = db;
            
            const { seedFeatureFlags } = require('./initialDataSeeder.cjs');
            return seedFeatureFlags(db).then(() => db);
          })
          .then((db) => {
            console.log('✅ Database initialized successfully');
            resolve(db);
          })
          .catch((err) => {
            console.error('❌ Database initialization failed:', err);
            reject(err);
          });
      });
    });
  });
}

// ============================================================================
// DEFAULT USER SETUP
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
              (err) => {
                if (err) {
                  console.error('❌ Error creating super admin:', err);
                  return reject(err);
                }
                console.log('✅ Super admin created successfully');
                resolve(dbInstance);
              }
            );
          } catch (err) {
            console.error('❌ Password hashing failed:', err);
            reject(err);
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
// GETTERS
// ============================================================================

function getDatabase() {
  if (!global.db) {
    console.error('❌ Database has not been initialized.');
    return null;
  }
  return global.db;
}

// ============================================================================
// CLOSE DATABASE
// ============================================================================

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

// ============================================================================
// EXPORTS
// ============================================================================


// ============================================================================
// DB HELPERS (SINGLE SOURCE OF TRUTH)
// ============================================================================

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
