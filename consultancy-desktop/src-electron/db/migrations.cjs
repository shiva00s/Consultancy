// FILE: src-electron/db/migrations.cjs

const dbRun = (dbInstance, sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbInstance.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
};

const dbAll = (dbInstance, sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbInstance.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

async function runMigrations(dbInstance) {
  console.log('🔄 Starting database migrations...');

  try {
    // Create migrations tracking table
    await dbRun(
      dbInstance,
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now', 'localtime'))
      )`
    );

    const appliedMigrations = await dbAll(
      dbInstance,
      'SELECT migration_name FROM schema_migrations'
    );
    const appliedNames = appliedMigrations.map((m) => m.migration_name);

    // Migration 001: Consolidate passport tables
    if (!appliedNames.includes('001_consolidate_passport_tables')) {
      await migration_001_consolidate_passport_tables(dbInstance);
      await dbRun(
        dbInstance,
        `INSERT INTO schema_migrations (migration_name) VALUES ('001_consolidate_passport_tables')`
      );
      console.log('✅ Migration 001: Consolidate passport tables - APPLIED');
    } else {
      console.log('⏭️  Migration 001: Already applied');
    }

    // Migration 002: Add metadata to communication_logs and file_path to documents
    if (!appliedNames.includes('002_add_comm_metadata_and_doc_path')) {
      await migration_002_add_comm_metadata_and_doc_path(dbInstance);
      await dbRun(
        dbInstance,
        `INSERT INTO schema_migrations (migration_name) VALUES ('002_add_comm_metadata_and_doc_path')`
      );
      console.log('✅ Migration 002: Add communication metadata & document file_path - APPLIED');
    } else {
      console.log('⏭️  Migration 002: Already applied');
    }

    console.log('✅ All migrations completed successfully');
    return dbInstance;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function migration_001_consolidate_passport_tables(dbInstance) {
  console.log('🔄 Running migration: Consolidate passport tables...');

  try {
    // Check if old passport_tracking table exists
    const oldTable = await dbAll(
      dbInstance,
      `SELECT name FROM sqlite_master WHERE type='table' AND name='passport_tracking'`
    );

    if (oldTable.length > 0) {
      console.log('📋 Found old passport_tracking table, migrating data...');

      // ✅ FIXED: Both tables use snake_case column names
      await dbRun(
        dbInstance,
        `INSERT INTO passport_movements (
          candidate_id, movement_type, date, method, courier_number, notes,
          received_from, received_by, send_to, send_to_name,
          send_to_contact, sent_by, created_at
        )
        SELECT
          candidate_id,
          COALESCE(movement_type, 'RECEIVE'),
          COALESCE(date, received_date, dispatch_date, datetime('now', 'localtime')),
          COALESCE(method, 'By Hand'),
          COALESCE(courier_number, docket_number),
          COALESCE(notes, received_notes, dispatch_notes),
          received_from,
          received_by,
          send_to,
          send_to_name,
          send_to_contact,
          sent_by,
          COALESCE(createdAt, datetime('now', 'localtime'))
        FROM passport_tracking
        WHERE isDeleted = 0`
      );

      // Rename old table to backup
      await dbRun(
        dbInstance,
        'ALTER TABLE passport_tracking RENAME TO passport_tracking_backup'
      );

      console.log('✅ Passport tracking data migrated successfully');
      console.log('💡 Old table backed up as: passport_tracking_backup');
    } else {
      console.log('✅ No old passport_tracking table found, skipping migration');
    }
  } catch (error) {
    console.error('❌ Migration 001 failed:', error);
    throw error;
  }
}

module.exports = {
  runMigrations,
};

async function migration_002_add_comm_metadata_and_doc_path(dbInstance) {
  console.log('🔄 Running migration: Add communication metadata and document file_path...');
  try {
    // communication_logs metadata column
    const commCols = await dbAll(dbInstance, `PRAGMA table_info(communication_logs)`);
    if (!commCols.some((c) => c.name === 'metadata')) {
      await dbRun(dbInstance, `ALTER TABLE communication_logs ADD COLUMN metadata TEXT`);
      console.log('✅ Added metadata column to communication_logs');
    } else {
      console.log('⏭️ metadata column already exists on communication_logs');
    }

    // documents table file_path column
    const docCols = await dbAll(dbInstance, `PRAGMA table_info(documents)`);
    if (!docCols.some((c) => c.name === 'file_path')) {
      await dbRun(dbInstance, `ALTER TABLE documents ADD COLUMN file_path TEXT`);
      console.log('✅ Added file_path column to documents');
    } else {
      console.log('⏭️ file_path column already exists on documents');
    }

  } catch (err) {
    console.error('❌ Migration 002 failed:', err);
    throw err;
  }
}
