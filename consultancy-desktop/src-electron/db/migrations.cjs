const { getDatabase } = require("./database.cjs");
const path = require("path");
const fs = require("fs");

async function runMigrations() {
  const db = getDatabase();

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      // Create migrations table if not exists
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
            console.error("Failed to create migrations table:", err);
            reject(err);
            return;
          }

          try {
            // Get list of applied migrations
            const appliedMigrations = await new Promise((res, rej) => {
              db.all("SELECT name FROM migrations", [], (err, rows) => {
                if (err) rej(err);
                else res(rows.map((r) => r.name));
              });
            });

            // Load migration files from schema/migrations directory
            const migrationsDir = path.join(__dirname, "schema", "migrations");
            let migrationFiles = [];

            if (fs.existsSync(migrationsDir)) {
              migrationFiles = fs
                .readdirSync(migrationsDir)
                .filter((f) => f.endsWith(".cjs"))
                .sort();
            }

            console.log(`📋 Found ${migrationFiles.length} migration files`);

            // Run pending migrations
            for (const fileName of migrationFiles) {
              const migrationName = fileName.replace(".cjs", "");

              if (appliedMigrations.includes(migrationName)) {
                console.log(`⏭️  Skipping ${migrationName} (already applied)`);
                continue;
              }

              console.log(`🔄 Applying migration: ${migrationName}`);

              const migrationPath = path.join(migrationsDir, fileName);

              try {
                const migration = require(migrationPath);

                if (typeof migration.applyMigration === "function") {
                  await migration.applyMigration(db);

                  // Record migration as applied
                  await new Promise((res, rej) => {
                    db.run(
                      "INSERT INTO migrations (name) VALUES (?)",
                      [migrationName],
                      (err) => {
                        if (err) rej(err);
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

            console.log("✅ All migrations completed");
            resolve();
          } catch (error) {
            console.error("Migration process failed:", error);
            reject(error);
          }
        }
      );
    });
  });
}

module.exports = { runMigrations };
