const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');
const { pushNotification } = require('../notify');

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

// GET /api/users/directory (any authed user: minimal list for chat)
router.get('/directory', requireAuth, (req, res) => {
  const db = getDB();
  res.json({ users: db.users.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, role: u.role, verified: !!u.verified })) });
});

// GET /api/users/verification-requests  (admin: pending blue-check requests)
router.get('/verification-requests', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  const pending = db.verificationRequests.filter(r => r.status === 'pending');
  res.json({
    requests: pending.map(r => {
      const u = db.users.find(x => x.id === r.userId);
      return { id: r.id, createdAt: r.createdAt, user: u ? { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar } : null };
    })
  });
});

// POST /api/users/verification-requests/:id/approve
router.post('/verification-requests/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  const request = db.verificationRequests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
  request.status = 'approved';
  const user = db.users.find(u => u.id === request.userId);
  if (user) { user.verified = true; user.verificationStatus = 'approved'; pushNotification(db, { userId: user.id, type: 'verification_approved' }); }
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/users/verification-requests/:id/reject
router.post('/verification-requests/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  const request = db.verificationRequests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
  request.status = 'rejected';
  const user = db.users.find(u => u.id === request.userId);
  if (user) { user.verificationStatus = 'rejected'; pushNotification(db, { userId: user.id, type: 'verification_rejected' }); }
  saveDB(db);
  res.json({ ok: true });
});

// GET /api/users/:id  (public profile card, for the profile page)
router.get('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  const postCount = db.posts.filter(p => p.authorId === user.id).length;
  const me = db.users.find(u => u.id === req.user.id);
  res.json({
    user: {
      id: user.id, username: user.username, fullName: user.fullName,
      avatar: user.avatar, coverImage: user.coverImage || '', bio: user.bio || '',
      birthday: user.birthday || '', location: user.location || '', education: user.education || '', website: user.website || '',
      role: user.role, verified: !!user.verified, verificationStatus: user.verificationStatus,
      friendCount: (user.friends || []).length,
      isFriend: me.friends.includes(user.id),
      isFollowing: me.following.includes(user.id),
      isSelf: me.id === user.id,
      createdAt: user.createdAt, postCount
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
    birthday: '', location: '', education: '', website: '',
    verified: false, verificationStatus: 'none',
    friends: [], following: [],
    theme: 'dark',
    notifications: { email: true, push: true, chat: true },
    security: { requireLoginOtp: !!requireLoginOtp, emailOnLogin: !!emailOnLogin, allowedTools: null },
    status: 'active',
    lastBirthdayNotifiedYear: null,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveDB(db);
  res.status(201).json({ user: sanitize(newUser) });
});

// PUT /api/users/:id/role
router.put('/:id/role', requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  user.role = role;
  if (role === 'admin') user.verified = true; // admins are always verified
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

// PUT /api/users/:id/reset-password (admin resets a user's password)
router.put('/:id/reset-password', requireAuth, requireAdmin, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  user.password = bcrypt.hashSync(newPassword, 10);
  saveDB(db);
  res.json({ ok: true });
});

// DELETE /api/users/:id
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
  const { fullName, email, phone, bio, birthday, location, education, website } = req.body || {};
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (fullName !== undefined) user.fullName = fullName;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (bio !== undefined) user.bio = bio;
  if (birthday !== undefined) user.birthday = birthday;
  if (location !== undefined) user.location = location;
  if (education !== undefined) user.education = education;
  if (website !== undefined) user.website = website;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

// POST /api/users/me/request-verification  (ask admin for the blue check)
router.post('/me/request-verification', requireAuth, (req, res) => {
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (user.verified) return res.status(409).json({ error: 'Tài khoản này đã được xác minh.' });
  const already = db.verificationRequests.find(r => r.userId === user.id && r.status === 'pending');
  if (already) return res.status(409).json({ error: 'Bạn đã gửi yêu cầu, vui lòng chờ Admin duyệt.' });
  db.verificationRequests.push({ id: uuid(), userId: user.id, status: 'pending', createdAt: new Date().toISOString() });
  user.verificationStatus = 'pending';
  saveDB(db);
  res.status(201).json({ ok: true });
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

// POST /api/users/me/cover
router.post('/me/cover', requireAuth, uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  user.coverImage = `/uploads/covers/${req.file.filename}`;
  saveDB(db);
  res.json({ user: sanitize(user) });
});

module.exports = router;
