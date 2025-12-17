// src/services/queries/notificationQueries.js
const { getDatabase, dbAll, dbRun, dbGet } = require('../../../src-electron/db/queries.cjs');

async function getNotifications(limit = 50) {
  const db = getDatabase();
  const sql = `
    SELECT id, title, message, type, priority, link,
           candidateid AS candidateId,
           actionrequired AS actionRequired,
           createdat AS createdAt,
           read
    FROM notifications
    ORDER BY createdat DESC
    LIMIT ?
  `;
  const rows = await dbAll(db, sql, limit);
  return rows;
}

async function createNotification(data) {
  const db = getDatabase();
  const insertSql = `
    INSERT INTO notifications
      (title, message, type, priority, link, candidateid, actionrequired, read, createdat)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `;
  await dbRun(
    db,
    insertSql,
    data.title,
    data.message,
    data.type || 'info',
    data.priority || 'normal',
    data.link ?? null,
    data.candidateId ?? null,
    data.actionRequired ? 1 : 0
  );

  const rowSql = `
    SELECT id, title, message, type, priority, link,
           candidateid AS candidateId,
           actionrequired AS actionRequired,
           read,
           createdat AS createdAt
    FROM notifications
    ORDER BY id DESC
    LIMIT 1
  `;
  const row = await dbGet(db, rowSql);
  return row;
}

async function markNotificationAsRead(id) {
  const db = getDatabase();
  await dbRun(db, 'UPDATE notifications SET read = 1 WHERE id = ?', id);
}

async function markAllNotificationsAsRead() {
  const db = getDatabase();
  await dbRun(db, 'UPDATE notifications SET read = 1', []);
}

async function deleteNotification(id) {
  const db = getDatabase();
  await dbRun(db, 'DELETE FROM notifications WHERE id = ?', id);
}

async function clearAllNotifications() {
  const db = getDatabase();
  await dbRun(db, 'DELETE FROM notifications', []);
}

module.exports = {
  getNotifications,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
};
