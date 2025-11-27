const { app } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const saltRounds = 10;
let db;

// --- Database Schema Setup (CLEAN - No user creation/updates here) ---
function setupDatabase(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      
      dbInstance.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Failed to BEGIN TRANSACTION:', err.message);
            return reject(new Error('Failed to BEGIN TRANSACTION.'));
          }
      });

      // 1. Users Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'staff',
          features TEXT 
        );
      `, (err) => {
        if (err) console.error('Error creating users table:', err.message);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY, 
          value TEXT
        );
      `, (err) => {
        if (err) console.error('Error creating system_settings table:', err.message);
      });

      // 2. Candidates Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, education TEXT,
          experience INTEGER, dob TEXT, passportNo TEXT UNIQUE, passportExpiry TEXT,
          contact TEXT, aadhar TEXT, status TEXT DEFAULT 'New', notes TEXT,
          Position TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0 
        );
      `, (err) => {
        if (err) console.error('Error creating candidates table:', err.message);
      });

      // 3. Documents Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, fileType TEXT, 
          fileName TEXT, filePath TEXT UNIQUE, category TEXT DEFAULT 'Uncategorized',
          isDeleted INTEGER DEFAULT 0, FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating documents table:', err.message);
      });

      // 4. Employers Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS employers (
          id INTEGER PRIMARY KEY AUTOINCREMENT, companyName TEXT NOT NULL, country TEXT,
          contactPerson TEXT, contactEmail TEXT, notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0
        );
      `, (err) => {
        if (err) console.error('Error creating employers table:', err.message);
      });

      // 5. Job Orders Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS job_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT, employer_id INTEGER NOT NULL, positionTitle TEXT NOT NULL,
          country TEXT, openingsCount INTEGER DEFAULT 1, status TEXT DEFAULT 'Open',
          requirements TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (employer_id) REFERENCES employers (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating job_orders table:', err.message);
      });

      // 6. Placements Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS placements (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, job_order_id INTEGER NOT NULL,
          assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'Assigned', isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE CASCADE,
          UNIQUE(candidate_id, job_order_id)
        );
      `, (err) => {
        if (err) console.error('Error creating placements table:', err.message);
      });

      // === NEW: USER PERMISSIONS TABLE (INJECTED) ===
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id INTEGER PRIMARY KEY,
          flags TEXT, 
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating user_permissions table:', err.message);
      });
// ===============================================

      // === NEW: PASSPORT TRACKING TABLE (INJECTED) ===
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS passport_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          candidate_id INTEGER NOT NULL,
          -- Passport Receipt
          received_date TEXT,
          received_notes TEXT,
          -- Passport Dispatch
          dispatch_date TEXT,
          docket_number TEXT,
          dispatch_notes TEXT,
          -- Status and Source
          passport_status TEXT NOT NULL DEFAULT 'Received',
          source_type TEXT NOT NULL DEFAULT 'Direct Candidate',
          agent_contact TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating passport_tracking table:', err.message);
      });
// ===============================================

      // 
// 7. Visa Tracking Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS visa_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          candidate_id INTEGER NOT NULL, 
          country TEXT NOT NULL,
          visa_type TEXT, 
          application_date TEXT, 
          status TEXT DEFAULT 'Pending', 
          notes TEXT,
          
          -- === INJECTED FIELDS (From UI) ===
          position TEXT,
          passport_number TEXT,
          travel_date TEXT,
          contact_type TEXT DEFAULT 'Direct Candidate',
          agent_contact TEXT,
          -- =================================

          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, 
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE 
CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating visa_tracking table:', err.message);
      });

      // 8. Interview Tracking Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS interview_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, job_order_id INTEGER,
          interview_date TEXT NOT NULL, round TEXT, status TEXT DEFAULT 'Scheduled',
          notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
          FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE SET NULL
        );
      `, (err) => {
        if (err) console.error('Error creating interview_tracking table:', err.message);
      });

      // 9. Medical Tracking Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS medical_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, test_date TEXT,
          certificate_path TEXT, status TEXT DEFAULT 'Pending', notes TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating medical_tracking table:', err.message);
      });

      // 10. Travel Tracking Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS travel_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, pnr TEXT,
          travel_date TEXT, ticket_file_path TEXT, departure_city TEXT,
          arrival_city TEXT, notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating travel_tracking table:', err.message);
      });

      // 11. Payments Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER NOT NULL, description TEXT NOT NULL,
          total_amount REAL NOT NULL, amount_paid REAL DEFAULT 0, status TEXT DEFAULT 'Pending',
          due_date TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating payments table:', err.message);
      });

      // 12. Audit Log Table
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT,
          action TEXT NOT NULL, target_type TEXT, target_id INTEGER,
          details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `, (err) => {
        if (err) console.error('Error creating audit_log table:', err.message);
      });

      // 13. Communication Logs
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS communication_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          user_id INTEGER,
          type TEXT NOT NULL, -- 'Email' or 'WhatsApp'
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => { if (err) console.error(err.message); });

dbInstance.run(`
        CREATE TABLE IF NOT EXISTS required_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT, 
          name TEXT NOT NULL UNIQUE,
          isDeleted INTEGER DEFAULT 0 
        );
      `, (err) => {
        if (err) console.error('Error creating required_documents table:', err.message);
      });

      const visaColsToAdd = [
    { name: 'position', type: 'TEXT' },
    { name: 'passport_number', type: 'TEXT' },
    { name: 'travel_date', type: 'TEXT' },
    { name: 'contact_type', type: 'TEXT DEFAULT "Direct Candidate"' },
    { name: 'agent_contact', type: 'TEXT' },
];
visaColsToAdd.forEach(col => {
    dbInstance.run(`ALTER TABLE visa_tracking ADD COLUMN ${col.name} ${col.type}`, (err) => {
        if (err && err.message.includes('duplicate column name')) { /* Pass */ }
        else if (err) console.error(`Error adding ${col.name} column to visa_tracking:`, err.message);
    });
});

      // --- Column Addition for Existing DBs ---
      const tablesToUpdate = [
    'candidates', 'documents', 'employers', 'job_orders', 
    'placements', 'visa_tracking', 'payments', 
    'interview_tracking', 'medical_tracking', 'travel_tracking', 'audit_log' 
];
      
      tablesToUpdate.forEach(table => {
        // Add isDeleted column
        dbInstance.run(`ALTER TABLE ${table} ADD COLUMN isDeleted INTEGER DEFAULT 0`, (err) => {
          if (err && err.message.includes('duplicate column name')) { /* Pass */ }
          else if (err) console.error(`Error adding isDeleted column to ${table}:`, err.message);
        });
      });

      // Add features column to users table
      dbInstance.run(`ALTER TABLE users ADD COLUMN features TEXT`, (err) => {
        if (err && err.message.includes('duplicate column name')) { /* Pass */ }
        else if (err) console.error(`Error adding features column to users:`, err.message);
      });

      // --- Final Commit ---
      dbInstance.run('COMMIT', (err) => {
        if (err) {
          console.error('Error committing transaction (Final Commit):', err.message);
          reject(new Error(err.message));
        } else {
          console.log('Database schema setup complete.');
          resolve(dbInstance);
        }
      });
    });
  });
}

// --- Database Initialization ---
function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'consultancy.db');
  console.log('Database path:', dbPath);

  return new Promise((resolve, reject) => {
    const dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        return reject(err);
      }
      console.log('Connected to the SQLite database.');
      
      // --- PERFORMANCE FIX: Enable Write-Ahead Logging ---
      dbInstance.run('PRAGMA journal_mode = WAL;', (err) => {
        if (err) console.error('Failed to enable WAL mode:', err);
        else console.log('SQLite WAL mode enabled.');
      });
      // --------------------------------------------------

      dbInstance.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err.message);
          return reject(err);
        }
        console.log('Foreign keys enabled.');
        
        // --- THE FIX: Wait for setupDatabase to finish ---
        setupDatabase(dbInstance)
          .then((db) => {
            // After setup, run the User Fixes
            return ensureInitialUserAndRoles(db);
          })
          .then((db) => {
            global.db = db;
            resolve(db);
          })
          .catch((setupErr) => {
            console.error("Database setup FAILED:", setupErr);
            reject(setupErr);
          });
      });
    });
  });
}

// --- NEW FUNCTION: Runs ONLY after setup is complete and database is unlocked ---
async function ensureInitialUserAndRoles(dbInstance) {
    const superAdminUser = 'admin';
    const superAdminPass = 'superadmin123';
    
    // Check if any user exists at all
    const anyUser = await new Promise((resolve, reject) => {
        dbInstance.get('SELECT id FROM users LIMIT 1', [], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });

    if (!anyUser) {
        // Database is empty. Create the default Super Admin.
        const hash = await bcrypt.hash(superAdminPass, saltRounds);
        await new Promise((resolve, reject) => {
            dbInstance.run(
                "INSERT INTO users (id, username, password, role) VALUES (1, ?, ?, 'super_admin')",
                [superAdminUser, hash],
                (err) => {
                    if (err) console.error('Error creating default SA:', err);
                    else console.log('Created default Super Admin (ID 1).');
                    resolve();
                }
            );
        });
    } else {
        // Database has users. Ensure user 'shiva' is Super Admin (for your setup).
        // Check for ID 1 (shiva) and force role.
        await new Promise((resolve, reject) => {
            dbInstance.run("UPDATE users SET role = 'super_admin' WHERE id = 1", [], (err) => {
                if (err) console.error('Error forcing ID 1 to SA:', err.message);
                else console.log('Verified ID 1 as Super Admin.');
                resolve();
            });
        });

        // Demote user 'admin' (ID 3) back to standard admin if they were SA by mistake
        await new Promise((resolve, reject) => {
            dbInstance.run("UPDATE users SET role = 'admin' WHERE id != 1 AND role = 'super_admin'", [], (err) => {
                if (err) console.error('Error demoting user:', err.message);
                else console.log('Demoted conflicting SA users.');
                resolve();
            });
        });
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