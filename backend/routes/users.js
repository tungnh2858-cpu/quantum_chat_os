const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadAvatar = makeUploader('avatars');
const uploadCover = makeUploader('covers');

function sanitize(user) {
  const { password, ...rest } = user;
  return rest;
}

// GET /api/users  (admin: full list, for the moderation dashboard)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  res.json({ users: db.users.map(sanitize) });
});

// GET /api/users/directory (any authed user: minimal list for chat/social)
router.get('/directory', requireAuth, (req, res) => {
  const db = getDB();
  res.json({ users: db.users.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, role: u.role })) });
});

// GET /api/users/:id  (public profile card: safe fields + post count, for the profile page)
router.get('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  const postCount = db.posts.filter(p => p.authorId === user.id).length;
  res.json({
    user: {
      id: user.id, username: user.username, fullName: user.fullName,
      avatar: user.avatar, coverImage: user.coverImage || '', bio: user.bio || '',
      role: user.role, createdAt: user.createdAt, postCount
    }
  });
});

// POST /api/users  (admin creates an account manually)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role, fullName, email, phone, requireLoginOtp, emailOnLogin } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
  const finalRole = role === 'admin' ? 'admin' : 'user';

  const db = getDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
  }
  if (email && db.users.some(u => u.email && u.email.toLowerCase() === String(email).toLowerCase())) {
    return res.status(409).json({ error: 'Email này đã được dùng cho một tài khoản khác.' });
  }
  const newUser = {
    id: uuid(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: finalRole,
    fullName: fullName || username,
    email: email || '',
    phone: phone || '',
    avatar: '',
    coverImage: '',
    bio: '',
    theme: 'dark',
    notifications: { email: true, push: true, chat: true },
    security: { requireLoginOtp: !!requireLoginOtp, emailOnLogin: !!emailOnLogin, allowedTools: null },
    status: 'active',
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveDB(db);
  res.status(201).json({ user: sanitize(newUser) });
});

// PUT /api/users/:id/role  (admin upgrades/downgrades a role: user <-> admin)
router.put('/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  user.role = role;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// PUT /api/users/:id/status (lock / unlock account — used for content moderation)
router.put('/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['active', 'locked'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  if (user.id === 'ADMIN1') return res.status(403).json({ error: 'Không thể khóa tài khoản Admin gốc.' });
  user.status = status;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// DELETE /api/users/:id  (remove a violating account — the account is deleted outright,
// never transferred, sold, or repurposed; its own data is simply removed)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === 'ADMIN1') return res.status(403).json({ error: 'Không thể xoá tài khoản Admin gốc.' });
  const db = getDB();
  const before = db.users.length;
  db.users = db.users.filter(u => u.id !== req.params.id);
  if (db.users.length === before) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  saveDB(db);
  res.json({ ok: true });
});

// ---- Self-service settings (any logged-in user, their own account only) ----

// PUT /api/users/me/profile
router.put('/me/profile', requireAuth, (req, res) => {
  const { fullName, email, phone, bio } = req.body || {};
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (fullName !== undefined) user.fullName = fullName;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (bio !== undefined) user.bio = bio;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// PUT /api/users/me/preferences (theme, notifications)
router.put('/me/preferences', requireAuth, (req, res) => {
  const { theme, notifications } = req.body || {};
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (theme) user.theme = theme;
  if (notifications) user.notifications = { ...user.notifications, ...notifications };
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// POST /api/users/me/avatar
router.post('/me/avatar', requireAuth, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  user.avatar = `/uploads/avatars/${req.file.filename}`;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// POST /api/users/me/cover  (cover/banner photo for the profile page)
router.post('/me/cover', requireAuth, uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  user.coverImage = `/uploads/covers/${req.file.filename}`;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

module.exports = router;
