const express = require('express');
const { getDB, saveDB } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { checkBirthdaysAndNotify } = require('../notify');

const router = express.Router();

function describe(n, db) {
  const actor = n.actorId ? db.users.find(u => u.id === n.actorId) : null;
  const actorName = actor ? (actor.fullName || actor.username) : 'Ai đó';
  let text = '';
  switch (n.type) {
    case 'friend_request': text = `${actorName} đã gửi cho bạn một lời mời kết bạn.`; break;
    case 'friend_accept': text = `${actorName} đã chấp nhận lời mời kết bạn của bạn.`; break;
    case 'birthday': text = `🎂 Hôm nay là sinh nhật của ${n.data.name || actorName}! Hãy gửi lời chúc mừng nhé.`; break;
    case 'verification_approved': text = 'Yêu cầu tích xanh của bạn đã được duyệt! 🎉'; break;
    case 'verification_rejected': text = 'Yêu cầu tích xanh của bạn đã bị từ chối.'; break;
    case 'like': text = `${actorName} đã thích bài viết của bạn.`; break;
    case 'comment': text = `${actorName} đã bình luận về bài viết của bạn.`; break;
    default: text = 'Bạn có một thông báo mới.';
  }
  return {
    id: n.id, type: n.type, text, read: n.read, createdAt: n.createdAt,
    actor: actor ? { id: actor.id, username: actor.username, fullName: actor.fullName, avatar: actor.avatar } : null
  };
}

// GET /api/notifications  (also lazily runs the once-a-day birthday check)
router.get('/', requireAuth, (req, res) => {
  const db = getDB();
  checkBirthdaysAndNotify(db);
  saveDB(db);
  const mine = db.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50)
    .map(n => describe(n, db));
  const unread = db.notifications.filter(n => n.userId === req.user.id && !n.read).length;
  res.json({ notifications: mine, unread });
});

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, (req, res) => {
  const db = getDB();
  const n = db.notifications.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (!n) return res.status(404).json({ error: 'Không tìm thấy thông báo.' });
  n.read = true;
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, (req, res) => {
  const db = getDB();
  db.notifications.forEach(n => { if (n.userId === req.user.id) n.read = true; });
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
