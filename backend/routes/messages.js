const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeUploader } = require('../middleware/upload');
const realtime = require('../realtime');

const router = express.Router();
const uploadChatImg = makeUploader('chat');

function publicUser(u) {
  return u && { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, verified: !!u.verified };
}
function safeMsg(m) {
  // Deleted messages keep their id/timestamps for layout, but hide the actual content.
  return m.deleted ? { ...m, content: '', image: '' } : m;
}

// GET /api/messages  (conversation list, like a Messenger inbox: last message, unread count, online status)
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
    const unreadCount = db.messages.filter(m => m.fromId === partnerId && m.toId === req.user.id && !m.read).length;
    return {
      partner: u ? { ...publicUser(u), online: realtime.isOnline(u.id) } : { id: partnerId, fullName: 'Người dùng đã xoá' },
      lastMessage: safeMsg(lastMessage),
      unreadCount
    };
  }).sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
  res.json({ conversations });
});

// GET /api/messages/:userId  (thread with :userId — also marks their messages to me as read)
router.get('/:userId', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const otherId = req.params.userId;
  const convo = db.messages
    .filter(m => (m.fromId === req.user.id && m.toId === otherId) || (m.fromId === otherId && m.toId === req.user.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const newlyRead = convo.filter(m => m.fromId === otherId && m.toId === req.user.id && !m.read);
  if (newlyRead.length) {
    newlyRead.forEach(m => { m.read = true; });
    saveDB(db);
    realtime.sendToUser(otherId, { type: 'read', by: req.user.id, messageIds: newlyRead.map(m => m.id) });
  }

  const partner = db.users.find(u => u.id === otherId);
  res.json({ messages: convo.map(safeMsg), partner: partner ? { ...publicUser(partner), online: realtime.isOnline(partner.id) } : null });
});

// POST /api/messages  (send: multipart, "toId" + optional "content" text + optional "image" file)
router.post('/', requireAuth, requireTool('social'), uploadChatImg.single('image'), (req, res) => {
  const { toId, content } = req.body || {};
  const image = req.file ? `/uploads/chat/${req.file.filename}` : '';
  if (!toId) return res.status(400).json({ error: 'Thiếu người nhận.' });
  if (!content && !image) return res.status(400).json({ error: 'Tin nhắn trống.' });
  const db = getDB();
  if (!db.users.some(u => u.id === toId)) return res.status(404).json({ error: 'Không tìm thấy người nhận.' });

  const msg = { id: uuid(), fromId: req.user.id, toId, content: content || '', image, deleted: false, read: false, createdAt: new Date().toISOString() };
  db.messages.push(msg);
  saveDB(db);

  const payload = { type: 'chat', message: msg };
  realtime.sendToUser(toId, payload);
  realtime.sendToUser(req.user.id, payload);
  res.status(201).json({ message: msg });
});

// DELETE /api/messages/:id  (sender only, soft-delete so the thread layout doesn't shift)
router.delete('/:id', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const msg = db.messages.find(m => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Không tìm thấy tin nhắn.' });
  if (msg.fromId !== req.user.id) return res.status(403).json({ error: 'Chỉ có thể thu hồi tin nhắn của chính bạn.' });
  msg.deleted = true;
  msg.content = '';
  msg.image = '';
  saveDB(db);
  const payload = { type: 'chat_delete', id: msg.id, fromId: msg.fromId, toId: msg.toId };
  realtime.sendToUser(msg.toId, payload);
  realtime.sendToUser(msg.fromId, payload);
  res.json({ ok: true });
});

module.exports = router;
