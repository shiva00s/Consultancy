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

        // 33.5 TWILIO SETTINGS
dbInstance.run(`
  CREATE TABLE IF NOT EXISTS twilio_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_sid TEXT,
    auth_token TEXT,
    phone_number TEXT,
    is_configured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
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
// 30. WHATSAPP CONVERSATIONS
// ========================================================================
dbInstance.run(`
  CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER,
    candidate_name TEXT,
    phone_number TEXT UNIQUE NOT NULL,
    last_message TEXT,
    last_message_time TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL
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

// ========================================================================
// 31. WHATSAPP MESSAGES
// ========================================================================
dbInstance.run(`
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    message_sid TEXT UNIQUE,
    direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
    body TEXT,
    media_url TEXT,
    media_type TEXT,
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
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
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
            position TEXT,
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
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdBy INTEGER,
            updatedBy INTEGER,
            isDeleted INTEGER DEFAULT 0,
            FOREIGN KEY (employer_id) REFERENCES employers(id) ON DELETE CASCADE,
            FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updatedBy) REFERENCES users(id) ON DELETE SET NULL
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
        // 12. USER PERMISSIONS / FEATURES / MENUS
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS user_permissions (
            user_id INTEGER PRIMARY KEY,
            flags TEXT,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          );
        `);

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

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS permission_matrix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT NOT NULL,
            tab TEXT,
            action TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE
          );
        `);

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL,
            description TEXT,
            default_enabled INTEGER DEFAULT 1
          );
        `);

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

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS superadmin_admin_feature_toggles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_key TEXT NOT NULL UNIQUE,
            enabled INTEGER NOT NULL DEFAULT 1
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
            role TEXT NOT NULL,
            menu_key TEXT NOT NULL,
            visible INTEGER NOT NULL DEFAULT 1,
            UNIQUE(role, menu_key)
          );
        `);

        // ========================================================================
        // 13. PASSPORT TRACKING (OLD - KEPT FOR BACKWARD COMPATIBILITY)
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_tracking (
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

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_tracking_candidate
            ON passport_tracking(candidate_id);
        `);

        dbInstance.run(`
          CREATE INDEX IF NOT EXISTS idx_passport_tracking_date
            ON passport_tracking(date DESC);
        `);

        // ========================================================================
        // 14. PASSPORT MOVEMENTS (NEW UNIFIED TABLE)
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

        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS passport_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            movement_type TEXT NOT NULL CHECK(movement_type IN ('RECEIVE', 'SEND')),
            date TEXT NOT NULL,
            received_from TEXT,
            file_name TEXT NOT NULL,
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
        // 16. VISA TRACKING
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
        // 17. INTERVIEW TRACKING
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
        // 18. MEDICAL TRACKING
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
        // 19. TRAVEL TRACKING
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
        // 20. PAYMENTS
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
        // 21. AUDIT LOG
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
        // 24. COMMUNICATION LOGS
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
        // Add metadata column to communication_logs if it doesn't exist
dbInstance.run(`
  ALTER TABLE communication_logs 
  ADD COLUMN metadata TEXT;
`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.warn('Note: metadata column may already exist');
  }
});

        // ========================================================================
        // 25. BUSINESS THEME
        // ========================================================================
        dbInstance.run(`
          CREATE TABLE IF NOT EXISTS business_theme (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL
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
  });
}

module.exports = {
  setupDatabaseSchema,
};
