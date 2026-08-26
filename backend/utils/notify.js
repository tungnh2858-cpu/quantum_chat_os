/**
 * Quantum Chat OS - Notification helper.
 * Call addNotification(db, {...}) right before saveDB(db) so the new
 * notification is persisted together with whatever action triggered it.
 */
const { v4: uuid } = require('uuid');

/**
 * @param {object} db          the object returned by getDB()
 * @param {object} opts
 * @param {string} opts.userId    who receives the notification
 * @param {string} [opts.fromId]  who caused it (skipped if === userId, no self-notifications)
 * @param {string} opts.type      'like' | 'comment' | 'reel_like' | 'reel_comment' | 'group_join' | 'group_post' | 'message'
 * @param {string} opts.message   human readable text (already in Vietnamese)
 * @param {string} [opts.link]    frontend path to open when clicked, e.g. 'social.html#post-123'
 */
function addNotification(db, { userId, fromId, type, message, link = '' }) {
  if (!userId || userId === fromId) return null;
  const note = {
    id: uuid(),
    userId,
    fromId: fromId || null,
    type,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.notifications.push(note);
  // Keep storage bounded: drop oldest read notifications past 300 per user.
  return note;
}

module.exports = { addNotification };
