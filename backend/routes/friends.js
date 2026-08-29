const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { pushNotification } = require('../notify');

const router = express.Router();

function publicUser(u) {
  return u && { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, verified: !!u.verified };
}

// GET /api/friends/search?q=...  (find people by name/username who are not already friends)
router.get('/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  let results = db.users.filter(u => u.id !== me.id);
  if (q) {
    results = results.filter(u =>
      (u.fullName || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)
    );
  }
  results = results.slice(0, 30).map(u => {
    const outgoing = db.friendRequests.find(r => r.fromId === me.id && r.toId === u.id && r.status === 'pending');
    const incoming = db.friendRequests.find(r => r.fromId === u.id && r.toId === me.id && r.status === 'pending');
    return {
      ...publicUser(u),
      isFriend: me.friends.includes(u.id),
      isFollowing: me.following.includes(u.id),
      requestSent: !!outgoing,
      requestReceived: incoming ? incoming.id : null
    };
  });
  res.json({ users: results });
});

// GET /api/friends  (my accepted friends, for the sidebar / friends list)
router.get('/', requireAuth, (req, res) => {
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  const friends = me.friends.map(id => publicUser(db.users.find(u => u.id === id))).filter(Boolean);
  res.json({ friends });
});

// GET /api/friends/of/:userId  (any user's friends list, shown on their profile page)
router.get('/of/:userId', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  const friends = user.friends.map(id => publicUser(db.users.find(u => u.id === id))).filter(Boolean);
  res.json({ friends });
});

// GET /api/friends/requests  (incoming pending requests for me)
router.get('/requests', requireAuth, (req, res) => {
  const db = getDB();
  const incoming = db.friendRequests.filter(r => r.toId === req.user.id && r.status === 'pending');
  res.json({
    requests: incoming.map(r => ({ id: r.id, from: publicUser(db.users.find(u => u.id === r.fromId)), createdAt: r.createdAt }))
  });
});

// POST /api/friends/request  { toId }
router.post('/request', requireAuth, (req, res) => {
  const { toId } = req.body || {};
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  const target = db.users.find(u => u.id === toId);
  if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  if (toId === me.id) return res.status(400).json({ error: 'Không thể tự kết bạn với chính mình.' });
  if (me.friends.includes(toId)) return res.status(409).json({ error: 'Hai bạn đã là bạn bè.' });
  const existing = db.friendRequests.find(r => r.fromId === me.id && r.toId === toId && r.status === 'pending');
  if (existing) return res.status(409).json({ error: 'Đã gửi lời mời trước đó.' });

  // If the other person already sent me a request, auto-accept instead of duplicating.
  const reciprocal = db.friendRequests.find(r => r.fromId === toId && r.toId === me.id && r.status === 'pending');
  if (reciprocal) {
    reciprocal.status = 'accepted';
    me.friends.push(toId);
    target.friends.push(me.id);
    pushNotification(db, { userId: toId, type: 'friend_accept', actorId: me.id });
    saveDB(db);
    return res.json({ status: 'accepted' });
  }

  const request = { id: uuid(), fromId: me.id, toId, status: 'pending', createdAt: new Date().toISOString() };
  db.friendRequests.push(request);
  pushNotification(db, { userId: toId, type: 'friend_request', actorId: me.id });
  saveDB(db);
  res.status(201).json({ status: 'pending', requestId: request.id });
});

// POST /api/friends/requests/:id/accept
router.post('/requests/:id/accept', requireAuth, (req, res) => {
  const db = getDB();
  const request = db.friendRequests.find(r => r.id === req.params.id);
  if (!request || request.toId !== req.user.id) return res.status(404).json({ error: 'Không tìm thấy lời mời.' });
  request.status = 'accepted';
  const me = db.users.find(u => u.id === req.user.id);
  const other = db.users.find(u => u.id === request.fromId);
  if (!me.friends.includes(other.id)) me.friends.push(other.id);
  if (!other.friends.includes(me.id)) other.friends.push(me.id);
  pushNotification(db, { userId: other.id, type: 'friend_accept', actorId: me.id });
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/friends/requests/:id/reject
router.post('/requests/:id/reject', requireAuth, (req, res) => {
  const db = getDB();
  const request = db.friendRequests.find(r => r.id === req.params.id);
  if (!request || request.toId !== req.user.id) return res.status(404).json({ error: 'Không tìm thấy lời mời.' });
  request.status = 'rejected';
  saveDB(db);
  res.json({ ok: true });
});

// DELETE /api/friends/:userId  (unfriend)
router.delete('/:userId', requireAuth, (req, res) => {
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  const other = db.users.find(u => u.id === req.params.userId);
  if (!other) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  me.friends = me.friends.filter(id => id !== other.id);
  other.friends = other.friends.filter(id => id !== me.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/friends/follow/:userId  (one-way follow, independent of friendship)
router.post('/follow/:userId', requireAuth, (req, res) => {
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  const target = db.users.find(u => u.id === req.params.userId);
  if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  if (!me.following.includes(target.id)) me.following.push(target.id);
  saveDB(db);
  res.json({ ok: true });
});

// DELETE /api/friends/follow/:userId  (unfollow)
router.delete('/follow/:userId', requireAuth, (req, res) => {
  const db = getDB();
  const me = db.users.find(u => u.id === req.user.id);
  me.following = me.following.filter(id => id !== req.params.userId);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
