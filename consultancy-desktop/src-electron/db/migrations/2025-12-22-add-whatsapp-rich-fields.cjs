// Migration: add rich metadata columns for whatsapp tables (safe alters)
module.exports = function runMigration(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        const ensureColumn = (table, column, sqlType) => {
          return new Promise((res, rej) => {
            db.all(`PRAGMA table_info(${table})`, (err, rows) => {
              if (err) return rej(err);
              const has = rows.some(r => r.name === column);
              if (has) return res(false);
              const stmt = `ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`;
              db.run(stmt, (e) => {
                if (e) return rej(e);
                res(true);
              });
            });
          });
        };

        const tasks = [];
        // whatsapp_messages additions
        tasks.push(ensureColumn('whatsapp_messages', 'sender_name', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'recipient_name', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'location', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'reason', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'context_json', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'replied_to', 'INTEGER'));
        tasks.push(ensureColumn('whatsapp_messages', 'delivered_at', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'read_at', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_messages', 'reaction_json', 'TEXT'));

        // whatsapp_media additions
        tasks.push(ensureColumn('whatsapp_media', 'signed_url', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_media', 'signed_url_expires_at', 'TEXT'));
        tasks.push(ensureColumn('whatsapp_media', 'is_public', 'INTEGER DEFAULT 0'));
        tasks.push(ensureColumn('whatsapp_media', 'media_meta_json', 'TEXT'));

        Promise.all(tasks)
          .then(() => resolve({ applied: true }))
          .catch((mErr) => reject(mErr));
      } catch (ex) {
        reject(ex);
      }
    });
  });
};
