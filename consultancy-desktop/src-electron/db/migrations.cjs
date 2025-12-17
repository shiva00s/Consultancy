// FILE: src-electron/db/migrations.cjs

const path = require('path');
const fs = require('fs');

/**
 * Run file-based migrations against the provided db instance.
 * @param {import('sqlite3').Database} db
 */
async function runMigrations(db) {
  if (!db) {
    console.error('❌ Cannot run migrations: db is null/undefined.');
    throw new Error('Database not initialized');
  }

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        async (err) => {
          if (err) {
            console.error('❌ Failed to create migrations table:', err);
            reject(err);
            return;
          }

          try {
            const appliedMigrations = await new Promise((res, rej) => {
              db.all('SELECT name FROM migrations', [], (err2, rows) => {
                if (err2) rej(err2);
                else res(rows.map((r) => r.name));
              });
            });

            const migrationsDir = path.join(__dirname, 'schema', 'migrations');
            let migrationFiles = [];

            if (fs.existsSync(migrationsDir)) {
              migrationFiles = fs
                .readdirSync(migrationsDir)
                .filter((f) => f.endsWith('.cjs'))
                .sort();
            }

            console.log(`📋 Found ${migrationFiles.length} migration files`);

            for (const fileName of migrationFiles) {
              const migrationName = fileName.replace('.cjs', '');

              if (appliedMigrations.includes(migrationName)) {
                console.log(`⏭️  Skipping ${migrationName} (already applied)`);
                continue;
              }

              console.log(`🔄 Applying migration: ${migrationName}`);
              const migrationPath = path.join(migrationsDir, fileName);

              try {
                const migration = require(migrationPath);

                if (typeof migration.applyMigration === 'function') {
                  await migration.applyMigration(db);

                  await new Promise((res, rej) => {
                    db.run(
                      'INSERT INTO migrations (name) VALUES (?)',
                      [migrationName],
                      (err3) => {
                        if (err3) rej(err3);
                        else res();
                      }
                    );
                  });

                  console.log(`✅ Successfully applied: ${migrationName}`);
                } else {
                  console.warn(
                    `⚠️  Migration ${migrationName} missing applyMigration function`
                  );
                }
              } catch (migErr) {
                console.error(`❌ Failed to apply ${migrationName}:`, migErr);
                throw migErr;
              }
            }

            console.log('✅ All migrations completed');
            resolve(db);
          } catch (error) {
            console.error('❌ Migration process failed:', error);
            reject(error);
          }
        }
      );
    });
  });
}

module.exports = { runMigrations };
