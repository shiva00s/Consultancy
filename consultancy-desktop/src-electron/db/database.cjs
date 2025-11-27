const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

/**
 * Get user data path for database
 */
function getDatabasePath() {

  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;

  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  
  // Create database directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'consultancy.db');
}

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  try {
    const dbPath = getDatabasePath();
    console.log('Initializing database at:', dbPath);
    
    // Open database connection
    db = new Database(dbPath, { verbose: console.log });
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create tables
    await createTables();
    
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create database tables
 */
async function createTables() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Candidates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      position TEXT,
      experience TEXT,
      skills TEXT,
      education TEXT,
      current_location TEXT,
      preferred_location TEXT,
      expected_salary TEXT,
      current_salary TEXT,
      notice_period TEXT,
      resume_path TEXT,
      photo_path TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )
  `);

  // Employers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      industry TEXT,
      address TEXT,
      website TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )
  `);

  // Job Orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER,
      job_title TEXT NOT NULL,
      job_description TEXT,
      requirements TEXT,
      location TEXT,
      salary_range TEXT,
      employment_type TEXT,
      positions INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'medium',
      deadline DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      FOREIGN KEY (employer_id) REFERENCES employers(id)
    )
  `);

  // Placements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS placements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER,
      employer_id INTEGER,
      job_order_id INTEGER,
      placement_date DATE,
      joining_date DATE,
      salary TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (employer_id) REFERENCES employers(id),
      FOREIGN KEY (job_order_id) REFERENCES job_orders(id)
    )
  `);

  // Interviews table
  db.exec(`
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER,
      job_order_id INTEGER,
      interview_date DATETIME,
      interview_mode TEXT,
      location TEXT,
      interviewer TEXT,
      status TEXT DEFAULT 'scheduled',
      feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id),
      FOREIGN KEY (job_order_id) REFERENCES job_orders(id)
    )
  `);

  // Visa Status table
  db.exec(`
    CREATE TABLE IF NOT EXISTS visa_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER,
      visa_type TEXT,
      status TEXT DEFAULT 'applied',
      application_date DATE,
      approval_date DATE,
      expiry_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )
  `);

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER,
      document_type TEXT,
      document_name TEXT,
      file_path TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    )
  `);

  // Audit Log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create default admin user if not exists
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get('admin');
  
  if (adminExists.count === 0) {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    db.prepare(`
      INSERT INTO users (username, password, email, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', hashedPassword, 'admin@consultancy.com', 'admin');
    
    console.log('Default admin user created (username: admin, password: admin123)');
  }
}

/**
 * Get database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDb,              // ← Make sure this exists
  getDatabase: getDb, // ← Add alias
  closeDatabase,
  getDatabasePath
};
