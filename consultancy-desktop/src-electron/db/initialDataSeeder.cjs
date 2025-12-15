const bcrypt = require('bcrypt');
const { getDatabase } = require('./database.cjs');

const saltRounds = 10;

/**
 * Seeds initial feature flags into the database
 */
async function seedFeatureFlags() {
  const db = getDatabase();
  
  const features = [
    {
      key: 'REPORTS',
      label: 'Reports & Analytics',
      description: 'Access to all reports and analytics'
    },
    {
      key: 'BULK_IMPORT',
      label: 'Bulk Import',
      description: 'Import candidates in bulk via CSV/Excel'
    },
    {
      key: 'SYSTEM_AUDIT',
      label: 'System Audit Log',
      description: 'View system-wide audit logs'
    },
    {
      key: 'USER_MANAGEMENT',
      label: 'User Management',
      description: 'Create and manage users'
    },
    {
      key: 'ADVANCED_ANALYTICS',
      label: 'Advanced Analytics',
      description: 'Access to advanced analytics dashboard'
    },
    {
      key: 'WHATSAPP_BULK',
      label: 'WhatsApp Bulk Messaging',
      description: 'Send bulk WhatsApp messages'
    },
    {
      key: 'RECYCLE_BIN',
      label: 'Recycle Bin',
      description: 'Manage deleted records'
    },
    {
      key: 'EMPLOYERS',
      label: 'Employer Management',
      description: 'Manage employer companies'
    },
    {
      key: 'JOB_ORDERS',
      label: 'Job Orders',
      description: 'Manage job orders and placements'
    },
    {
      key: 'VISA_KANBAN',
      label: 'Visa Kanban Board',
      description: 'Visual visa tracking board'
    },
    {
      key: 'SYSTEM_MODULES',
      label: 'System Module Control',
      description: 'Enable/disable system modules'
    },
    {
      key: 'SETTINGS',
      label: 'System Settings',
      description: 'Manage system-wide settings'
    }
  ];

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO feature_flags (key, label, description)
        VALUES (?, ?, ?)
      `);

      features.forEach(feature => {
        stmt.run(
          feature.key,
          feature.label,
          feature.description,
          (err) => {
            if (err) {
              console.error(`Error inserting feature ${feature.key}:`, err);
            }
          }
        );
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing feature insert:', err);
          return reject(err);
        }
        console.log('✅ Feature flags seeded successfully');
        resolve();
      });
    });
  });
}

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
                console.log('✅ Default super_admin account created.');
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

module.exports = { 
  seedInitialData,
  seedFeatureFlags // ✅ Export new function
};
