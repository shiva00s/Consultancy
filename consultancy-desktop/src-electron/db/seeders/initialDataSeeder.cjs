const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * Seeds initial data into the database, specifically creating a default super_admin
 * account if no users exist.
 * @param {import('sqlite3').Database} db The database instance.
 */
const seedInitialData = (db) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as count FROM users", (userCountErr, row) => {
            if (userCountErr) {
                console.error("Error checking for existing users:", userCountErr.message);
                return reject(userCountErr);
            }
            if (row.count === 0) {
                bcrypt.hash('superadmin123', saltRounds, (hashErr, hash) => {
                    if (hashErr) {
                        console.error('Error hashing super admin password:', hashErr.message);
                        return reject(hashErr);
                    }
                    // Insert default feature flags for the super_admin
                    const defaultFeatures = {
                        isEmployersEnabled: true,
                        isJobsEnabled: true,
                        isVisaKanbanEnabled: true, 
                        isDocumentsEnabled: true,
                        isVisaTrackingEnabled: true,
                        isFinanceTrackingEnabled: true,
                        isMedicalEnabled: true,
                        isInterviewEnabled: true,
                        isTravelEnabled: true,
                        isHistoryEnabled: true,
                        isBulkImportEnabled: true,           
                        isMobileAccessEnabled: true,             
                        canViewReports: true,
                        canAccessSettings: true,
                        canAccessRecycleBin: true,
                        canDeletePermanently: true,
                    };

                    db.run(
                        `INSERT INTO users (username, password, role, features) VALUES (?, ?, ?, ?)`,
                        ['super_admin', hash, 'super_admin', JSON.stringify(defaultFeatures)],
                        function(insertErr) {
                            if (insertErr) {
                                console.error('Failed to insert initial super admin:', insertErr.message);
                                reject(insertErr);
                            } else {
                                console.log('Default super_admin account created.');
                                resolve();
                            }
                        }
                    );
                });
            } else {
                resolve(); // No seeding needed, users already exist
            }
        });
    });
};

module.exports = { seedInitialData };
