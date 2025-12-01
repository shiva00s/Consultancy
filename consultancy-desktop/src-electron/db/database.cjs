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

      // 2. System Settings
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `, (err) => {
        if (err) console.error('Error creating system_settings table:', err.message);
      });

      // 3. License Activations
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS activations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          machineId TEXT UNIQUE,
          code TEXT,
          activated INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) console.error('Error creating activations table:', err.message);
      });

      // 4. Candidates
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
      `, (err) => {
        if (err) console.error('Error creating candidates table:', err.message);
      });

      // 5. Documents (current)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          fileType TEXT,
          fileName TEXT,
          filePath TEXT UNIQUE,
          category TEXT DEFAULT 'Uncategorized',
          isDeleted INTEGER DEFAULT 0,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating documents table:', err.message);
      });

      // 6. Legacy candidate_files (some code still queries it)
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
      `, (err) => {
        if (err) console.error('Error creating candidate_files table:', err.message);
      });

      // 7. Employers
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
      `, (err) => {
        if (err) console.error('Error creating employers table:', err.message);
      });

      // 8. Job Orders
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
      `, (err) => {
        if (err) console.error('Error creating job_orders table:', err.message);
      });

      // 9. Placements
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
      `, (err) => {
        if (err) console.error('Error creating placements table:', err.message);
      });

      // 10. User Permissions (per‑user flag JSON)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id INTEGER PRIMARY KEY,
          flags TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating user_permissions table:', err.message);
      });

      // 11. Granular Permissions (per‑tab / per‑action)
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
      `, (err) => {
        if (err) console.error('Error creating user_granular_permissions table:', err.message);
      });

      // 12. Permission Matrix (definition)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS permission_matrix (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module TEXT NOT NULL,
          tab TEXT,
          action TEXT NOT NULL,
          code TEXT NOT NULL UNIQUE
        );
      `, (err) => {
        if (err) console.error('Error creating permission_matrix table:', err.message);
      });

      // 13. Features (global feature toggles definitions)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS features (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          description TEXT,
          default_enabled INTEGER DEFAULT 1
        );
      `, (err) => {
        if (err) console.error('Error creating features table:', err.message);
      });

      // 14. Admin/Staff feature assignments
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS admin_staff_feature_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          feature_key TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          UNIQUE(user_id, feature_key),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating admin_staff_feature_assignments table:', err.message);
      });

      // 15. Superadmin → admin feature toggles
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS superadmin_admin_feature_toggles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          feature_key TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1
        );
      `, (err) => {
        if (err) console.error('Error creating superadmin_admin_feature_toggles table:', err.message);
      });

      // 16. Menu visibility (per role)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS menu_visibility (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT NOT NULL,
          menu_key TEXT NOT NULL,
          visible INTEGER NOT NULL DEFAULT 1,
          UNIQUE(role, menu_key)
        );
      `, (err) => {
        if (err) console.error('Error creating menu_visibility table:', err.message);
      });

      // 17. Passport Tracking
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
      `, (err) => {
        if (err) console.error('Error creating passport_tracking table:', err.message);
      });

      // 18. Visa Tracking
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
      `, (err) => {
        if (err) console.error('Error creating visa_tracking table:', err.message);
      });

      // 19. Interview Tracking
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
      `, (err) => {
        if (err) console.error('Error creating interview_tracking table:', err.message);
      });

      // 20. Medical Tracking
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
      `, (err) => {
        if (err) console.error('Error creating medical_tracking table:', err.message);
      });

      // 21. Travel Tracking
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
      `, (err) => {
        if (err) console.error('Error creating travel_tracking table:', err.message);
      });

      // 22. Payments
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
      `, (err) => {
        if (err) console.error('Error creating payments table:', err.message);
      });

      // 23. Audit Log
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          action TEXT NOT NULL,
          target_type TEXT,
          target_id INTEGER,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `, (err) => {
        if (err) console.error('Error creating audit_log table:', err.message);
      });

      // 24. Required Documents
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS required_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          isDeleted INTEGER DEFAULT 0
        );
      `, (err) => {
        if (err) console.error('Error creating required_documents table:', err.message);
      });

      // 25. Communication Logs
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS communication_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER,
          user_id INTEGER,
          channel TEXT,
          subject TEXT,
          message TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE SET NULL,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        );
      `, (err) => {
        if (err) console.error('Error creating communication_logs table:', err.message);
      });

      // 26. Business Theme (UI theme settings)
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS business_theme (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL
        );
      `, (err) => {
        if (err) console.error('Error creating business_theme table:', err.message);
      });

            // RBAC: modules and permissions
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module_key TEXT UNIQUE NOT NULL,
          module_name TEXT NOT NULL,
          module_type TEXT NOT NULL,      -- 'core' | 'tracking' | 'settings' | 'system'
          parent_key TEXT,
          route TEXT,
          icon TEXT,
          is_enabled INTEGER DEFAULT 1,
          order_index INTEGER DEFAULT 0
        );
      `, (err) => {
        if (err) console.error('Error creating modules table:', err.message);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS module_dependencies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module_key TEXT NOT NULL,
          requires_module_key TEXT NOT NULL
        );
      `, (err) => {
        if (err) console.error('Error creating module_dependencies table:', err.message);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          module_key TEXT NOT NULL,
          granted_by INTEGER,
          granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, module_key),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
      `, (err) => {
        if (err) console.error('Error creating role_permissions table:', err.message);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS default_staff_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          module_key TEXT NOT NULL,
          is_default INTEGER DEFAULT 1
        );
      `, (err) => {
        if (err) console.error('Error creating default_staff_permissions table:', err.message);
      });

      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS permission_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          module_key TEXT,
          target_user_id INTEGER,
          performed_by INTEGER,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) console.error('Error creating permission_audit_log table:', err.message);
      });

      // Seed modules once
      dbInstance.get('SELECT COUNT(*) AS count FROM modules', (err, row) => {
        if (err) {
          console.error('Failed to count modules:', err.message);
          return;
        }
        if (row && row.count > 0) return;

        const stmt = dbInstance.prepare(`
          INSERT INTO modules
            (module_key, module_name, module_type, parent_key, route, icon, is_enabled, order_index)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const seedModules = [
          ['core.candidate.search', 'Candidate Search', 'core', null, '/search', 'FiSearch', 1, 1],
          ['core.candidate.add', 'Add New Candidate', 'core', null, '/add', 'FiUserPlus', 1, 2],
          ['core.bulk_import', 'Bulk Import', 'core', null, '/import', 'FiUploadCloud', 1, 3],
          ['core.employers', 'Employers', 'core', null, '/employers', 'FiServer', 1, 4],
          ['core.job_orders', 'Job Orders', 'core', null, '/jobs', 'FiClipboard', 1, 5],
          ['core.visa_board', 'Visa Board', 'core', null, '/visa-board', 'FiBriefcase', 1, 6],

          ['tab.profile', 'Profile', 'tracking', null, null, null, 1, 10],
          ['tab.passport', 'Passport', 'tracking', null, null, null, 1, 11],
          ['tab.documents', 'Documents', 'tracking', null, null, null, 1, 12],
          ['tab.job_placements', 'Job Placements', 'tracking', null, null, null, 1, 13],
          ['tab.visa_tracking', 'Visa Tracking', 'tracking', null, null, null, 1, 14],
          ['tab.financial', 'Financial', 'tracking', null, null, null, 1, 15],
          ['tab.medical', 'Medical', 'tracking', null, null, null, 1, 16],
          ['tab.interview', 'Interview', 'tracking', null, null, null, 1, 17],
          ['tab.travel', 'Travel', 'tracking', null, null, null, 1, 18],
          ['tab.offer_letter', 'Offer Letter', 'tracking', null, null, null, 1, 19],
          ['tab.history', 'History', 'tracking', null, null, null, 1, 20],
          ['tab.comms_log', 'Communication Log', 'tracking', null, null, null, 1, 21],

          ['settings.users', 'Users', 'settings', null, '/settings/users', 'FiUsers', 1, 30],
          ['settings.required_docs', 'Required Docs', 'settings', null, '/settings/docs', 'FiClipboard', 1, 31],
          ['settings.email', 'Email', 'settings', null, '/settings/email', 'FiMail', 1, 32],
          ['settings.templates', 'Templates', 'settings', null, '/settings/templates', 'FiFileText', 1, 33],
          ['settings.mobile_app', 'Mobile App', 'settings', null, '/settings/mobile', 'FiSmartphone', 1, 34],
          ['settings.backup', 'Backup', 'settings', null, '/settings/backup', 'FiDatabase', 1, 35],

          ['access.view_reports', 'View Reports', 'system', null, '/reports', 'FiBarChart2', 1, 40],
          ['access.audit_log', 'System Audit Log', 'system', null, '/system-audit', 'FiClock', 1, 41],
          ['access.modules', 'Modules', 'system', null, '/system-modules', 'FiPackage', 1, 42],
          ['access.recycle_bin', 'Recycle Bin', 'system', null, '/recycle-bin', 'FiTrash2', 1, 43],
        ];

        seedModules.forEach(vals => stmt.run(vals));
        stmt.finalize();
        console.log('Seeded modules table');
      });

      // Seed default staff permissions
      dbInstance.get('SELECT COUNT(*) AS count FROM default_staff_permissions', (err, row) => {
        if (err) {
          console.error('Failed to count default_staff_permissions:', err.message);
          return;
        }
        if (row && row.count > 0) return;

        const stmt = dbInstance.prepare(
          'INSERT INTO default_staff_permissions (module_key, is_default) VALUES (?, 1)'
        );
        const defaults = [
          'core.candidate.search',
          'tab.profile',
          'tab.passport',
          'tab.documents',
          'tab.history',
        ];
        defaults.forEach(k => stmt.run(k));
        stmt.finalize();
        console.log('Seeded default_staff_permissions');
      });

            dbInstance.get('SELECT COUNT(*) AS count FROM default_staff_permissions', (err, row) => {
        if (err) {
          console.error('Failed to count default_staff_permissions:', err.message);
          return;
        }
        if (row && row.count > 0) return;

        const stmt = dbInstance.prepare(
          'INSERT INTO default_staff_permissions (module_key, is_default) VALUES (?, 1)'
        );

        const staffDefaults = [
          'core.candidate.search',
          'tab.profile',
          'tab.passport',
          'tab.documents',
          'tab.history',
        ];

        staffDefaults.forEach(k => stmt.run(k));
        stmt.finalize();
        console.log('Seeded default_staff_permissions');
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

// --- Database Initialization and ensureInitialUserAndRoles ---
// (Use exactly your existing code here, unchanged)

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

      dbInstance.run('PRAGMA foreign_keys = ON;', (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err.message);
          return reject(err);
        }
        console.log('Foreign keys enabled.');

        setupDatabase(dbInstance)
          .then((db) => ensureInitialUserAndRoles(db))
          .then((db) => {
            global.db = db;
            resolve(db);
          })
          .catch((setupErr) => {
            console.error('Database setup FAILED:', setupErr);
            reject(setupErr);
          });
      });
    });
  });
}

async function ensureInitialUserAndRoles(dbInstance) {
  const superAdminUser = 'Shiva00s';
  const superAdminPass = 'Shiva@74482';

  // 1) Create / fix super admin (your existing code)
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
  } else {
    await new Promise((resolve) => {
      dbInstance.run("UPDATE users SET role = 'super_admin' WHERE id = 1", [], () => resolve());
    });

    await new Promise((resolve) => {
      dbInstance.run(
        "UPDATE users SET role = 'admin' WHERE id != 1 AND role = 'super_admin'",
        [],
        () => resolve()
      );
    });
  }

  // 2) ADD THIS BLOCK HERE: default SMTP config
  await new Promise((resolve) => {
    dbInstance.run(
      "CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)",
      [],
      () => resolve()
    );
  });

  await new Promise((resolve, reject) => {
    dbInstance.get(
      "SELECT value FROM system_settings WHERE key = 'smtp_config'",
      [],
      (err, row) => {
        if (err) return reject(err);
        if (row) return resolve(); // already configured

        const defaultSmtp = {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          user: 'prakashshiva368@gmail.com',
          pass: 'zikl imjv amdf tiyr',
        };
        const json = JSON.stringify(defaultSmtp);

        dbInstance.run(
          "INSERT INTO system_settings (key, value) VALUES ('smtp_config', ?)",
          [json],
          (err2) => {
            if (err2) console.error('Error inserting default SMTP config:', err2.message);
            else console.log('Default SMTP config inserted.');
            resolve();
          }
        );
      }
    );
  });

  // 3) END
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
