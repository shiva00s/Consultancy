const applySchema = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    role TEXT DEFAULT 'staff', -- super_admin, admin, staff
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    features TEXT -- JSON string for feature flags (SuperAdmin only)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS candidates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    education TEXT,
                    experience INTEGER,
                    dob TEXT,
                    passportNo TEXT UNIQUE NOT NULL,
                    passportExpiry TEXT,
                    contact TEXT,
                    aadhar TEXT UNIQUE,
                    status TEXT DEFAULT 'New',
                    notes TEXT,
                    Position TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0 -- Soft delete flag
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS employers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    companyName TEXT NOT NULL,
                    country TEXT,
                    contactPerson TEXT,
                    contactEmail TEXT,
                    notes TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS job_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    employer_id INTEGER,
                    positionTitle TEXT NOT NULL,
                    country TEXT,
                    openingsCount INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'Open', -- Open, Closed, Filled
                    requirements TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (employer_id) REFERENCES employers(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS placements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    job_order_id INTEGER NOT NULL,
                    status TEXT DEFAULT 'Assigned', -- Assigned, Interviewing, Placed, Rejected
                    assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    UNIQUE(candidate_id, job_order_id),
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                    FOREIGN KEY (job_order_id) REFERENCES job_orders(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    fileType TEXT,
                    fileName TEXT,
                    filePath TEXT NOT NULL,
                    category TEXT DEFAULT 'Uncategorized',
                    uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    total_amount REAL NOT NULL,
                    amount_paid REAL DEFAULT 0,
                    status TEXT DEFAULT 'Pending', -- Pending, Partial, Paid, Overdue
                    due_date TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    action TEXT NOT NULL,
                    target_type TEXT, -- e.g., 'candidates', 'users', 'system'
                    target_id INTEGER, -- ID of the affected entity
                    details TEXT, -- JSON string or free text for more info
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS required_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    isDeleted INTEGER DEFAULT 0,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id INTEGER PRIMARY KEY,
                    flags TEXT, -- JSON string of feature flags for this user
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS passport_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    received_date TEXT,
                    received_notes TEXT,
                    dispatch_date TEXT,
                    docket_number TEXT,
                    dispatch_notes TEXT,
                    passport_status TEXT DEFAULT 'Submitted', -- Submitted, Received, Dispatched
                    source_type TEXT, -- e.g., 'Agent', 'Direct'
                    agent_contact TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS visa_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    country TEXT NOT NULL,
                    visa_type TEXT,
                    application_date TEXT NOT NULL,
                    status TEXT DEFAULT 'Applied', -- Applied, Approved, Rejected, Pending
                    notes TEXT,
                    position TEXT,
                    passport_number TEXT,
                    travel_date TEXT,
                    contact_type TEXT,
                    agent_contact TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS medical_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    test_date TEXT NOT NULL,
                    certificate_path TEXT,
                    status TEXT DEFAULT 'Pending', -- Pending, Fit, Unfit
                    notes TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS travel_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    pnr TEXT,
                    travel_date TEXT NOT NULL,
                    ticket_file_path TEXT,
                    departure_city TEXT NOT NULL,
                    arrival_city TEXT NOT NULL,
                    notes TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS interview_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    job_order_id INTEGER,
                    interview_date TEXT NOT NULL,
                    round TEXT,
                    status TEXT DEFAULT 'Scheduled', -- Scheduled, Completed, Passed, Failed
                    notes TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    isDeleted INTEGER DEFAULT 0,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                    FOREIGN KEY (job_order_id) REFERENCES job_orders(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS communication_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    candidate_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL, -- e.g., 'email', 'call', 'note'
                    details TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS admin_feature_assignments (
                    admin_id INTEGER NOT NULL,
                    feature_key TEXT NOT NULL,
                    enabled INTEGER DEFAULT 0, -- 0 for disabled, 1 for enabled
                    PRIMARY KEY (admin_id, feature_key),
                    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => { if (err) reject(err); });

            db.run(`
                CREATE TABLE IF NOT EXISTS activation_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    license_key TEXT UNIQUE NOT NULL,
                    activated INTEGER DEFAULT 0,
                    activated_at TEXT,
                    expires_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => { if (err) reject(err); });

            // Resolve the promise after all schema runs are scheduled
            resolve();
        });
    });
};

module.exports = { applySchema };
