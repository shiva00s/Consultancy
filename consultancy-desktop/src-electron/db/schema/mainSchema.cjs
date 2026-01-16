// FILE: src-electron/db/schema/mainSchema.cjs

// Responsible ONLY for creating all tables and indexes.
// No connection logic, no migrations, no seeders.

function setupDatabaseSchema(dbInstance) {
  return new Promise((resolve, reject) => {
    dbInstance.serialize(() => {
      // Start transaction
      dbInstance.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          console.error('❌ Failed to BEGIN TRANSACTION:', err.message);
          return reject(new Error('Failed to BEGIN TRANSACTION.'));
        }

        // ========================================================================
        // 1. USERS TABLE
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'staff',
            fullName TEXT,
            email TEXT,
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
            updated_at TEXT,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // ========================================================================
        // 3. SMTP SETTINGS
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

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_activation_machine
            ON license_activation(machine_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_activation_requests_machine
            ON activation_requests(machine_id, activation_code);
        `);

        // ========================================================================
        // 5. OLD ACTIVATIONS (BACKWARD COMPAT)
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
        // 5B. ACTIVATION KEYS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS activation_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_key TEXT UNIQUE NOT NULL,
            activated INTEGER DEFAULT 0,
            activated_at TEXT,
            expires_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
            photo_path TEXT,
            photopath TEXT,
            passport_photo_path TEXT,
            features TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0
          );
        `);

        // CANDIDATES PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_status 
          ON candidates(status) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_position 
          ON candidates(Position) 
          WHERE isDeleted = 0 AND Position IS NOT NULL;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_passport 
          ON candidates(passportNo) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_contact 
          ON candidates(contact) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_aadhar 
          ON candidates(aadhar) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_deleted_created 
          ON candidates(isDeleted, createdAt DESC);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_name_search 
          ON candidates(name COLLATE NOCASE) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_candidates_search_composite 
          ON candidates(isDeleted, status, Position, createdAt DESC);
        `);

        // ========================================================================
        // 7. DOCUMENTS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            fileType TEXT,
            fileName TEXT,
            filePath TEXT UNIQUE,
            filepath TEXT,
            file_path TEXT,
            category TEXT DEFAULT 'Uncategorized',
            uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE
          );
        `);

        // DOCUMENTS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_documents_candidate_deleted 
          ON documents(candidateid, isDeleted, category);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_documents_category 
          ON documents(category) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 8. CANDIDATE FILES
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS candidate_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            file_name TEXT,
            file_type TEXT,
            filePath TEXT,
            file_path TEXT,
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
            position TEXT,
            contactEmail TEXT,
            notes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0
          );
        `);

        // EMPLOYERS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_employers_deleted 
          ON employers(isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_employers_company_name 
          ON employers(companyName COLLATE NOCASE) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 10. JOB ORDERS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS job_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employer_id INTEGER NOT NULL,
            employerid INTEGER,
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
            salary TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdBy INTEGER,
            updatedBy INTEGER,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (employer_id) REFERENCES employers(id) ON DELETE CASCADE,
            FOREIGN KEY (employerid) REFERENCES employers(id) ON DELETE CASCADE,
            FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL
          );
        `);

        // JOB ORDERS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_joborders_employer_status 
          ON job_orders(employerid, status, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_joborders_status 
          ON job_orders(status) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 11. PLACEMENTS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS placements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            job_order_id INTEGER NOT NULL,
            joborderid INTEGER,
            assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'Assigned',
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE CASCADE,
            FOREIGN KEY (joborderid) REFERENCES job_orders (id) ON DELETE CASCADE,
            UNIQUE(candidate_id, job_order_id)
          );
        `);

        // PLACEMENTS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_placements_candidate_deleted 
          ON placements(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_placements_job_deleted 
          ON placements(joborderid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_placements_assigned 
          ON placements(assignedAt DESC) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 12. USER PERMISSIONS / FEATURES / MENUS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS user_permissions (
            user_id INTEGER PRIMARY KEY,
            userid INTEGER,
            flags TEXT,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (userid) REFERENCES users (id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS user_granular_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            userid INTEGER,
            module TEXT NOT NULL,
            tab TEXT,
            granted_by INTEGER,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            enabled INTEGER DEFAULT 1,
            action TEXT NOT NULL,
            permission_key TEXT,
            allowed INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, module, tab, action),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (userid) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS permission_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            module TEXT NOT NULL,
            sub_module TEXT,
            tab TEXT,
            action TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            allowed INTEGER DEFAULT 0,
            UNIQUE(role, module, sub_module, tab, action)
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            name TEXT,
            label TEXT NOT NULL,
            description TEXT,
            default_enabled INTEGER DEFAULT 1
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS admin_staff_feature_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            staff_id INTEGER,
            feature_key TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            UNIQUE(user_id, feature_key),
            UNIQUE(staff_id, feature_key),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (feature_key) REFERENCES features (key) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS superadmin_admin_feature_toggles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_key TEXT NOT NULL UNIQUE,
            enabled INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (feature_key) REFERENCES features(key) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS admin_feature_assignments (
            admin_id INTEGER NOT NULL,
            feature_key TEXT NOT NULL,
            enabled INTEGER DEFAULT 0,
            PRIMARY KEY (admin_id, feature_key),
            FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS menu_visibility (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_key TEXT,
            role TEXT NOT NULL,
            visible INTEGER NOT NULL DEFAULT 1,
            visible_to_admin INTEGER DEFAULT 1,
            visible_to_staff INTEGER DEFAULT 0,
            UNIQUE(role, menu_key)
          );
        `);

        // ========================================================================
        // 12B. MODULES AND PERMISSIONS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS modules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_key TEXT UNIQUE NOT NULL,
            module_name TEXT NOT NULL,
            module_type TEXT NOT NULL,
            parent_key TEXT,
            route TEXT,
            icon TEXT,
            is_enabled INTEGER DEFAULT 1,
            order_index INTEGER DEFAULT 0
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS module_dependencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_key TEXT NOT NULL,
            requires_module_key TEXT NOT NULL,
            UNIQUE(module_key, requires_module_key)
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS role_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            module_key TEXT NOT NULL,
            granted_by INTEGER,
            granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, module_key),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS default_staff_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_key TEXT NOT NULL UNIQUE,
            is_default INTEGER DEFAULT 1
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS permission_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            module_key TEXT,
            target_user_id INTEGER,
            performed_by INTEGER,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE SET NULL,
            FOREIGN KEY (performed_by) REFERENCES users (id) ON DELETE SET NULL
          );
        `);

        // ========================================================================
        // 13. PASSPORT TRACKING (OLD - KEPT FOR BACKWARD COMPATIBILITY)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            movement_type TEXT CHECK(movement_type IN ('RECEIVE', 'SEND')),
            method TEXT,
            courier_number TEXT,
            date TEXT,
            notes TEXT,
            received_from TEXT,
            received_by TEXT,
            send_to TEXT,
            send_to_name TEXT,
            send_to_contact TEXT,
            sent_by TEXT,
            received_date TEXT,
            received_notes TEXT,
            dispatch_date TEXT,
            docket_number TEXT,
            dispatch_notes TEXT,
            passport_status TEXT DEFAULT 'Received',
            passportstatus TEXT DEFAULT 'Received',
            source_type TEXT DEFAULT 'Direct Candidate',
            agent_contact TEXT,
            photos TEXT DEFAULT '[]',
            photo_count INTEGER DEFAULT 0,
            created_by TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT (datetime('now')),
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_tracking_candidate
            ON passport_tracking(candidate_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_tracking_date
            ON passport_tracking(date DESC);
        `);

        // PASSPORT TRACKING PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passporttracking_candidate_deleted 
          ON passport_tracking(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passporttracking_status 
          ON passport_tracking(passportstatus) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 13B. PASSPORT TRACKING BACKUP
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_tracking_backup (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            movement_type TEXT CHECK(movement_type IN ('RECEIVE', 'SEND')),
            method TEXT,
            courier_number TEXT,
            date TEXT,
            notes TEXT,
            received_from TEXT,
            received_by TEXT,
            send_to TEXT,
            send_to_name TEXT,
            send_to_contact TEXT,
            sent_by TEXT,
            received_date TEXT,
            received_notes TEXT,
            dispatch_date TEXT,
            docket_number TEXT,
            dispatch_notes TEXT,
            passport_status TEXT DEFAULT 'Received',
            source_type TEXT DEFAULT 'Direct Candidate',
            agent_contact TEXT,
            photos TEXT DEFAULT '[]',
            photo_count INTEGER DEFAULT 0,
            created_by TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT (datetime('now')),
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
          );
        `);

        // ========================================================================
        // 14. PASSPORT MOVEMENTS (NEW UNIFIED TABLE)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            movement_type TEXT NOT NULL CHECK(movement_type IN ('RECEIVE', 'SEND')),
            date TEXT NOT NULL,
            received_from TEXT,
            file_name TEXT,
            received_by TEXT,
            received_date TEXT,
            received_notes TEXT,
            send_to TEXT,
            send_to_name TEXT,
            send_to_contact TEXT,
            sent_by TEXT,
            files TEXT,
            dispatch_date TEXT,
            dispatch_notes TEXT,
            docket_number TEXT,
            method TEXT,
            courier_number TEXT,
            passport_status TEXT,
            source_type TEXT,
            agent_contact TEXT,
            notes TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_movements_candidate
            ON passport_movements(candidate_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_movements_date
            ON passport_movements(date DESC);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_movements_type
            ON passport_movements(movement_type);
        `);

        // ========================================================================
        // 15. PASSPORT MOVEMENT PHOTOS (FOR NEW TABLE)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_movement_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movement_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_data TEXT NOT NULL,
            uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
            is_deleted INTEGER DEFAULT 0,
            isDeleted INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (movement_id) REFERENCES passport_movements(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_movement_photos_movement
            ON passport_movement_photos(movement_id);
        `);

        // ========================================================================
        // 15B. PASSPORT MOVEMENT FILES
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_movement_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movement_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_data BLOB NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (movement_id) REFERENCES passport_movements(id) ON DELETE CASCADE
          );
        `);

        // ========================================================================
        // 16. VISA TRACKING
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS visa_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            country TEXT NOT NULL,
            visa_type TEXT,
            application_date TEXT,
            applicationdate TEXT,
            status TEXT DEFAULT 'Pending',
            notes TEXT,
            position TEXT,
            passport_number TEXT,
            travel_date TEXT,
            contact_type TEXT DEFAULT 'Direct Candidate',
            agent_contact TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE
          );
        `);

        // VISA TRACKING PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_visatracking_candidate_deleted 
          ON visa_tracking(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_visatracking_status 
          ON visa_tracking(status) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_visatracking_appdate 
          ON visa_tracking(applicationdate DESC) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 17. INTERVIEW TRACKING
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS interview_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            job_order_id INTEGER,
            joborderid INTEGER,
            interview_date TEXT NOT NULL,
            interviewdate TEXT,
            round TEXT,
            status TEXT DEFAULT 'Scheduled',
            notes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (job_order_id) REFERENCES job_orders (id) ON DELETE SET NULL,
            FOREIGN KEY (joborderid) REFERENCES job_orders (id) ON DELETE SET NULL
          );
        `);

        // INTERVIEW TRACKING PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_interviewtracking_candidate_deleted 
          ON interview_tracking(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_interviewtracking_job 
          ON interview_tracking(joborderid) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_interviewtracking_date 
          ON interview_tracking(interviewdate DESC) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 18. MEDICAL TRACKING
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS medical_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            test_date TEXT,
            testdate TEXT,
            certificate_path TEXT,
            status TEXT DEFAULT 'Pending',
            notes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE
          );
        `);

        // MEDICAL TRACKING PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_medicaltracking_candidate_deleted 
          ON medical_tracking(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_medicaltracking_testdate 
          ON medical_tracking(testdate DESC) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 19. TRAVEL TRACKING
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS travel_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            pnr TEXT,
            travel_date TEXT,
            traveldate TEXT,
            ticket_file_path TEXT,
            departure_city TEXT,
            arrival_city TEXT,
            notes TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE
          );
        `);

        // TRAVEL TRACKING PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_traveltracking_candidate_deleted 
          ON travel_tracking(candidateid, isDeleted);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_traveltracking_date 
          ON travel_tracking(traveldate DESC) 
          WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 20. PAYMENTS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            candidateid INTEGER,
            description TEXT NOT NULL,
            total_amount REAL NOT NULL,
            totalamount REAL,
            amount_paid REAL DEFAULT 0,
            amountpaid REAL DEFAULT 0,
            status TEXT DEFAULT 'Pending',
            due_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE CASCADE
          );
        `);

        // PAYMENTS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_payments_candidate_deleted 
          ON payments(candidateid, isDeleted, status);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_payments_status 
          ON payments(status) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_payments_created 
          ON payments(createdat DESC) 
          WHERE isDeleted = 0;
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_payments_pending_composite 
          ON payments(candidateid, status, isDeleted, totalamount, amountpaid);
        `);

        // ========================================================================
        // 21. AUDIT LOG
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            userid INTEGER,
            username TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            targettype TEXT,
            target_id INTEGER,
            targetid INTEGER,
            candidate_id INTEGER,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
            FOREIGN KEY (userid) REFERENCES users (id) ON DELETE SET NULL,
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

        // AUDIT LOG PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_auditlog_user 
          ON audit_log(userid);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_auditlog_target 
          ON audit_log(targettype, targetid);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_auditlog_action 
          ON audit_log(action);
        `);

        // ========================================================================
        // 22. SYSTEM AUDIT LOG (Additional)
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
        // 23. REQUIRED DOCUMENTS
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
        // 24B. COMPANY SETUP (Basic company information used in templates)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS company_setup (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT NOT NULL,
            address TEXT,
            contact TEXT,
            created_by INTEGER,
            updated_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_company_setup_name ON company_setup(company_name COLLATE NOCASE) WHERE isDeleted = 0;
        `);

        // ========================================================================
        // 24. COMMUNICATION LOGS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS communication_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER,
            candidateid INTEGER,
            user_id INTEGER,
            communication_type TEXT,
            communicationtype TEXT,
            details TEXT,
            metadata TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE SET NULL,
            FOREIGN KEY (candidateid) REFERENCES candidates (id) ON DELETE SET NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_comm_logs_candidate ON communication_logs(candidate_id);
        `);
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_comm_logs_created ON communication_logs(createdAt DESC);
        `);

        // COMMUNICATION LOGS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_communicationlogs_candidate 
          ON communication_logs(candidateid);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_communicationlogs_type 
          ON communication_logs(communicationtype);
        `);

        // ========================================================================
        // 25. BUSINESS THEME
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS business_theme (
            id INTEGER PRIMARY KEY AUTOINCREMENT DEFAULT 1,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            theme_name TEXT DEFAULT 'Default',
            primary_color TEXT DEFAULT '#0066cc',
            secondary_color TEXT DEFAULT '#00cc66',
            accent_color TEXT DEFAULT '#cc6600',
            sidebar_bg TEXT DEFAULT '#1a1a2e',
            sidebar_text TEXT DEFAULT '#ffffff',
            button_style TEXT DEFAULT 'rounded',
            logo_url TEXT,
            company_name TEXT DEFAULT 'Consultancy App',
            font_family TEXT DEFAULT 'Inter',
            background_pattern TEXT DEFAULT 'solid'
          );
        `);

        // ========================================================================
        // 26. FEATURE FLAGS
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
        // 27. USER FEATURES (Junction Table)
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
        // 28. REMINDERS
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
        // 29. NOTIFICATIONS
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
            read INTEGER DEFAULT 0 CHECK(read IN (0, 1)),
            actor_id INTEGER,
            actor_name TEXT,
            target_type TEXT,
            target_id INTEGER,
            meta TEXT,
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
          );
        `);

        // ========================================================================
        // 30. WHATSAPP CONVERSATIONS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS whatsapp_conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER,
            candidateid INTEGER,
            candidate_name TEXT,
            phone_number TEXT UNIQUE NOT NULL,
            last_message TEXT,
            last_message_time TEXT,
            unread_count INTEGER DEFAULT 0,
            media_name TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            is_deleted INTEGER DEFAULT 0,
            isdeleted INTEGER DEFAULT 0,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
            FOREIGN KEY (candidateid) REFERENCES candidates(id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_candidate
            ON whatsapp_conversations(candidate_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone
            ON whatsapp_conversations(phone_number);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_time
            ON whatsapp_conversations(last_message_time DESC);
        `);

        // WHATSAPP CONVERSATIONS PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsappconversations_candidate 
          ON whatsapp_conversations(candidateid) 
          WHERE isdeleted = 0;
        `);

        // ========================================================================
        // 31. WHATSAPP MESSAGES
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            conversationid INTEGER,
            message_sid TEXT UNIQUE,
            direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
            body TEXT,
            media_url TEXT,
            media_type TEXT,
            media_name TEXT,
            status TEXT DEFAULT 'sent',
            timestamp TEXT NOT NULL,
            from_number TEXT NOT NULL,
            to_number TEXT NOT NULL,
            sender_name TEXT,
            recipient_name TEXT,
            location TEXT,
            reason TEXT,
            context_json TEXT,
            replied_to INTEGER,
            delivered_at TEXT,
            read_at TEXT,
            reaction_json TEXT,
            error_message TEXT,
            is_read TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            is_deleted INTEGER DEFAULT 0,
            isdeleted INTEGER DEFAULT 0,
            FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (conversationid) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation
            ON whatsapp_messages(conversation_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp
            ON whatsapp_messages(timestamp DESC);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sid
            ON whatsapp_messages(message_sid);
        `);

        // WHATSAPP MESSAGES PERFORMANCE INDEXES
        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsappmessages_conversation 
          ON whatsapp_messages(conversationid, timestamp DESC) 
          WHERE isdeleted = 0;
        `);

        // ========================================================================
        // 32. WHATSAPP MEDIA
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS whatsapp_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            media_url TEXT NOT NULL,
            media_type TEXT,
            content_type TEXT,
            file_name TEXT,
            file_size INTEGER,
            downloaded INTEGER DEFAULT 0,
            local_path TEXT,
            signed_url TEXT,
            signed_url_expires_at TEXT,
            is_public INTEGER DEFAULT 0,
            media_meta_json TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (message_id) REFERENCES whatsapp_messages(id) ON DELETE CASCADE
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_media_message
            ON whatsapp_media(message_id);
        `);

        // ========================================================================
        // 33. WHATSAPP TEMPLATES (Optional - for message templates)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS whatsapp_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category
            ON whatsapp_templates(category);
        `);

        // ========================================================================
        // 34. WHATSAPP MESSAGE ATTACHMENTS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS whatsapp_message_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            document_id INTEGER,
            file_path TEXT,
            original_name TEXT,
            mime_type TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY(message_id) REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
            FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE SET NULL
          );
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_attachments_message
            ON whatsapp_message_attachments(message_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_whatsapp_attachments_document
            ON whatsapp_message_attachments(document_id);
        `);

        // ========================================================================
        // 35. TWILIO SETTINGS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS twilio_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_sid TEXT,
            auth_token TEXT,
            phone_number TEXT,
            is_configured INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
          );
        `, (err) => {
          if (err) {
            console.error('❌ Failed to create twilio_settings table:', err.message);
          }
        });

        // Insert default row if not exists
        dbInstance.run(`
          INSERT OR IGNORE INTO twilio_settings (id, account_sid, auth_token, phone_number, is_configured)
          VALUES (1, NULL, NULL, NULL, 0)
        `, (err) => {
          if (err) {
            console.error('❌ Failed to insert default twilio_settings row:', err.message);
          }
        });

        // ========================================================================
        // 36. MIGRATIONS TABLES
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migration_name TEXT NOT NULL UNIQUE,
            applied_at TEXT DEFAULT (datetime('now', 'localtime'))
          );
        `);

        // ========================================================================
        // 37. FULL-TEXT SEARCH FOR CANDIDATES
        // ========================================================================
        dbInstance.run(`
          CREATE VIRTUAL TABLE IF NOT EXISTS candidates_fts USING fts5(
            name, passportNo, contact, Position, education,
            content='candidates', content_rowid='id'
          );
        `);

        // ========================================================================
        // COMMIT TRANSACTION & OPTIMIZE
        // ========================================================================
        dbInstance.run('COMMIT', (err) => {
          if (err) {
            console.error('❌ COMMIT failed:', err.message);
            return reject(new Error(err.message));
          }
          
          console.log('✅ Database schema created successfully with all tables, columns, and performance indexes');
          
          // Update SQLite statistics for query optimizer
          dbInstance.run('ANALYZE', (err) => {
            if (err) {
              console.warn('⚠️ ANALYZE failed:', err.message);
            } else {
              console.log('📊 Database statistics updated for optimal query performance');
            }
            resolve(dbInstance);
          });
        });
      });
    });
  });
}

module.exports = {
  setupDatabaseSchema,
};
