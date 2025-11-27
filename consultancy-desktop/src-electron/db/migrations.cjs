const { getDatabase } = require('./database.cjs');

async function runMigrations() {
  const db = getDatabase();
  
  console.log('🔄 Running database migrations...');
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if features column exists
      db.all("PRAGMA table_info(candidates)", (err, columns) => {
        if (err) {
          reject(err);
          return;
        }
        
        const hasFeatures = columns.some(col => col.name === 'features');
        
        if (!hasFeatures) {
          console.log('Adding features column to candidates table...');
          db.run(`ALTER TABLE candidates ADD COLUMN features TEXT`, (err) => {
            if (err) {
              console.error('Failed to add features column:', err);
              reject(err);
            } else {
              console.log('✅ Features column added');
              resolve();
            }
          });
        } else {
          console.log('✅ Features column already exists');
          resolve();
        }
      });
    });
  });
}

module.exports = { runMigrations };
