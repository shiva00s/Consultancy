// src-electron/db/mainSchema.cjs
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
      // 3. LICENSE ACTIVATIONS
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
      // 4. CANDIDATES
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
      // 5. DOCUMENTS
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
      // 6. CANDIDATE FILES
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
      // 7. EMPLOYERS
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
      // 8. JOB ORDERS
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
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (employer_id) REFERENCES employers (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 9. PLACEMENTS
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
      // 10. USER PERMISSIONS
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
      // 11. GRANULAR PERMISSIONS
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
      // 12. PERMISSION MATRIX
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
      // 13. FEATURES
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
      // 14. ADMIN-STAFF FEATURE ASSIGNMENTS
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
      // 15. SUPERADMIN ADMIN FEATURE TOGGLES
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS superadmin_admin_feature_toggles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feature_key TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1
        );
      `);

      // ========================================================================
      // 16. ADMIN FEATURE ASSIGNMENTS (OLD - for compatibility)
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
      // 17. MENU VISIBILITY
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
      // 18. PASSPORT TRACKING
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS passport_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          received_date TEXT,
          received_notes TEXT,
          dispatch_date TEXT,
          docket_number TEXT,
          dispatch_notes TEXT,
          passport_status TEXT NOT NULL DEFAULT 'Received',
          source_type TEXT NOT NULL DEFAULT 'Direct Candidate',
          agent_contact TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `);

      // ========================================================================
      // 19. VISA TRACKING
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
      // 20. INTERVIEW TRACKING
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
      // 21. MEDICAL TRACKING
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
      // 22. TRAVEL TRACKING
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
      // 23. PAYMENTS
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
      // 24. AUDIT LOG
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

      // Create indexes for audit_log
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
      // 25. REQUIRED DOCUMENTS
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
      // 26. COMMUNICATION LOGS
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

      // Create indexes for communication_logs
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_comm_logs_candidate ON communication_logs(candidate_id);
      `);
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_comm_logs_created ON communication_logs(createdAt DESC);
      `);

      // ========================================================================
      // 27. BUSINESS THEME
      // ========================================================================
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS business_theme (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL
        );
      `);

      // ========================================================================
      // 28. FEATURE FLAGS
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
      // 29. USER FEATURES (Junction Table)
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

      // Create index for user_features
      dbInstance.run(`
        CREATE INDEX IF NOT EXISTS idx_user_features_user ON user_features(user_id);
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
              
              // Add index for performance
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
          .then((db) => {
            // ✅ Set global.db BEFORE seeding
            global.db = db;
            
            // Now load and seed features
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

module.exports = {
  initializeDatabase,
  getDatabase,
  getDb: getDatabase, // Alias for compatibility
  closeDatabase,
};
