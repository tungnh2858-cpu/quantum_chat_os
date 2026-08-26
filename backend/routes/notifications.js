const express = require('express');
const { getDB, saveDB } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function withSender(db, note) {
  const from = note.fromId ? db.users.find(u => u.id === note.fromId) : null;
  return {
    ...note,
    from: from ? { id: from.id, username: from.username, fullName: from.fullName, avatar: from.avatar } : null
  };
}

// GET /api/notifications  (newest first, most recent 50)
router.get('/', requireAuth, (req, res) => {
  const db = getDB();
  const list = db.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map(n => withSender(db, n));
  res.json({ notifications: list });
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, (req, res) => {
  const db = getDB();
  const count = db.notifications.filter(n => n.userId === req.user.id && !n.read).length;
  res.json({ count });
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, (req, res) => {
  const db = getDB();
  db.notifications.forEach(n => { if (n.userId === req.user.id) n.read = true; });
  saveDB(db);
  res.json({ ok: true });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, (req, res) => {
  const db = getDB();
  const note = db.notifications.find(n => n.id === req.params.id && n.userId === req.user.id);
  if (!note) return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
  note.read = true;
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
