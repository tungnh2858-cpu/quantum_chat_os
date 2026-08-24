const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();

// GET /api/messages/:userId  (conversation between me and :userId)
router.get('/:userId', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const otherId = req.params.userId;
  const convo = db.messages
    .filter(m => (m.fromId === req.user.id && m.toId === otherId) || (m.fromId === otherId && m.toId === req.user.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ messages: convo });
});

// GET /api/messages  (list of conversations with last message, like FB chat list)
router.get('/', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const mine = db.messages.filter(m => m.fromId === req.user.id || m.toId === req.user.id);
  const byPartner = {};
  for (const m of mine) {
    const partnerId = m.fromId === req.user.id ? m.toId : m.fromId;
    if (!byPartner[partnerId] || new Date(m.createdAt) > new Date(byPartner[partnerId].createdAt)) {
      byPartner[partnerId] = m;
    }
  }
  const conversations = Object.entries(byPartner).map(([partnerId, lastMessage]) => {
    const u = db.users.find(x => x.id === partnerId);
    return {
      partner: u ? { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar } : { id: partnerId },
      lastMessage
    };
  }).sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  res.json({ conversations });
});

// POST /api/messages  { toId, content }  (REST fallback if websocket unavailable)
router.post('/', requireAuth, requireTool('social'), (req, res) => {
  const { toId, content } = req.body || {};
  if (!toId || !content) return res.status(400).json({ error: 'Thiếu người nhận hoặc nội dung.' });
  const db = getDB();
  const msg = { id: uuid(), fromId: req.user.id, toId, content, read: false, createdAt: new Date().toISOString() };
  db.messages.push(msg);
  saveDB(db);
  res.status(201).json({ message: msg });
});

module.exports = router;
