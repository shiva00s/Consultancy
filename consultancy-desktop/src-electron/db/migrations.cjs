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
