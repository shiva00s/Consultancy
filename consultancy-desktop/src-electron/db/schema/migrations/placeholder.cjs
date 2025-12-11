const applyMigration = (db) => {
  return new Promise((resolve, reject) => {
    // Placeholder migration - does nothing
    console.log('Placeholder migration running');
    resolve();
  });
};

module.exports = { applyMigration };
