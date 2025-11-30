const applyMigration = (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Drop old admin_feature_assignments table if exists
            db.run(`DROP TABLE IF EXISTS admin_feature_assignments`, (err) => {
                if (err) console.warn('Could not drop admin_feature_assignments:', err);
            });

            // Create comprehensive granular permissions table
            db.run(`
                CREATE TABLE IF NOT EXISTS user_granular_permissions (
                    user_id INTEGER NOT NULL,
                    permission_key TEXT NOT NULL,
                    enabled INTEGER DEFAULT 0,
                    granted_by INTEGER,
                    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, permission_key),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    console.error('Failed to create user_granular_permissions:', err);
                    reject(err);
                } else {
                    console.log('✅ Created user_granular_permissions table');
                    resolve();
                }
            });
        });
    });
};

const rollback = (db) => {
    return new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS user_granular_permissions`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

module.exports = { applyMigration, rollback };
