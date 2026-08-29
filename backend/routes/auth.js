const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, saveDB } = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { sendMail } = require('../mailer');

const router = express.Router();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// In-memory stores (short-lived; resetting on server restart is fine here).
const captchaStore = new Map(); // captchaId -> { answer, expires }
const otpStore = new Map();     // userId    -> { code, expires }

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

function sanitize(user) {
  const { password, ...rest } = user;
  return rest;
}

function cleanupExpired(store) {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.expires < now) store.delete(key);
  }
}

// GET /api/auth/captcha  -> simple math bot-check challenge
router.get('/captcha', (req, res) => {
  cleanupExpired(captchaStore);
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  const captchaId = crypto.randomUUID();
  captchaStore.set(captchaId, { answer: a + b, expires: Date.now() + CAPTCHA_TTL_MS });
  res.json({ captchaId, question: `${a} + ${b} = ?` });
});

function findUserByIdentifier(db, identifier) {
  const id = String(identifier || '').toLowerCase().trim();
  return db.users.find(u => u.username.toLowerCase() === id || (u.email && u.email.toLowerCase() === id));
}

// POST /api/auth/register  { fullName, username, email, phone, password }
// Public sign-up. Email + phone are required so the account can be verified,
// matching how Facebook-style sign-up works.
router.post('/register', async (req, res) => {
  const { fullName, username, email, phone, password } = req.body || {};
  if (!fullName || !username || !email || !phone || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, tên đăng nhập, email, số điện thoại và mật khẩu.' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Email không hợp lệ.' });
  if (!/^[0-9+][0-9\s-]{7,14}$/.test(phone)) return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });

  const db = getDB();
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
  }
  if (db.users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email này đã được dùng cho một tài khoản khác.' });
  }
  if (db.users.some(u => u.phone && u.phone === phone)) {
    return res.status(409).json({ error: 'Số điện thoại này đã được dùng cho một tài khoản khác.' });
  }
  if (db.pendingUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Đã có một yêu cầu đăng ký khác đang chờ duyệt với tên đăng nhập này.' });
  }

  const newUser = {
    id: require('crypto').randomUUID(),
    username,
    password: bcrypt.hashSync(password, 10),
    role: 'user',
    fullName,
    email,
    phone,
    avatar: '',
    coverImage: '',
    bio: '',
    birthday: '', location: '', education: '', website: '',
    verified: false, verificationStatus: 'none',
    friends: [], following: [],
    theme: 'dark',
    notifications: { email: true, push: true, chat: true },
    security: { requireLoginOtp: false, emailOnLogin: false, allowedTools: null },
    status: 'active',
    lastBirthdayNotifiedYear: null,
    createdAt: new Date().toISOString()
  };

  if (db.adminSettings.requireApproval) {
    db.pendingUsers.push(newUser);
    saveDB(db);
    sendMail(email, 'Đăng ký Quantum Chat OS đã được ghi nhận', `Xin chào ${fullName},\n\nYêu cầu đăng ký tài khoản @${username} của bạn đang chờ Admin phê duyệt. Bạn sẽ nhận được email khi tài khoản được kích hoạt.`).catch(() => {});
    return res.status(202).json({ ok: true, pendingApproval: true, message: 'Đăng ký thành công! Tài khoản của bạn đang chờ Admin phê duyệt.' });
  }

  db.users.push(newUser);
  saveDB(db);
  sendMail(email, 'Chào mừng đến với Quantum Chat OS!', `Xin chào ${fullName},\n\nTài khoản @${username} của bạn đã được tạo thành công trên Quantum Chat OS.\nEmail và số điện thoại của bạn đã được ghi nhận để xác minh tài khoản.\n\nChúc bạn vui vẻ kết nối cùng bạn bè!`).catch(() => {});
  res.status(201).json({ ok: true, pendingApproval: false, message: 'Tạo tài khoản thành công.' });
});

// POST /api/auth/login  { identifier, password, captchaId, captchaAnswer }
router.post('/login', async (req, res) => {
  const { identifier, password, captchaId, captchaAnswer } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'Thiếu tài khoản/email hoặc mật khẩu.' });

  const db = getDB();
  const user = findUserByIdentifier(db, identifier);
  if (!user) {
    const stillPending = db.pendingUsers.find(u => u.username.toLowerCase() === String(identifier).toLowerCase() || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
    if (stillPending) return res.status(403).json({ error: 'Tài khoản của bạn đang chờ Admin phê duyệt. Vui lòng quay lại sau.' });
    return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });
  }
  if (user.status === 'locked') return res.status(403).json({ error: 'Tài khoản đã bị khóa. Liên hệ Admin.' });

  const isRootAdmin = user.id === 'ADMIN1';

  // Bot verification (captcha) required for everyone except the root admin account.
  if (!isRootAdmin) {
    cleanupExpired(captchaStore);
    const record = captchaId ? captchaStore.get(captchaId) : null;
    if (!record || Number(captchaAnswer) !== record.answer) {
      return res.status(400).json({ error: 'Xác minh chống bot không đúng. Vui lòng thử lại.', captchaFailed: true });
    }
    captchaStore.delete(captchaId);
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không chính xác.' });

  const requiresOtp = isRootAdmin || !!(user.security && user.security.requireLoginOtp);

  if (requiresOtp) {
    if (!user.email) return res.status(400).json({ error: 'Tài khoản chưa có email để gửi mã xác nhận. Liên hệ Admin.' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(user.id, { code, expires: Date.now() + OTP_TTL_MS });

    const mailResult = await sendMail(
      user.email,
      'Quantum Chat OS - Mã xác nhận đăng nhập',
      `Xin chào ${user.fullName || user.username},\n\nMã xác nhận đăng nhập của bạn là: ${code}\nMã có hiệu lực trong 10 phút. Nếu không phải bạn thực hiện, hãy đổi mật khẩu ngay.\n\n— Quantum Chat OS`
    );

    const otpToken = jwt.sign({ id: user.id, purpose: 'otp' }, JWT_SECRET, { expiresIn: '10m' });
    return res.json({
      requiresOtp: true,
      otpToken,
      message: `Mã xác nhận đã được gửi tới email ${user.email}.`,
      devOtp: mailResult.devFallback ? code : undefined // only present when SMTP isn't configured, for local testing
    });
  }

  // No OTP required — issue token immediately.
  if (user.security && user.security.emailOnLogin && user.email) {
    sendMail(user.email, 'Quantum Chat OS - Thông báo đăng nhập', `Tài khoản ${user.username} vừa đăng nhập lúc ${new Date().toLocaleString('vi-VN')}. Nếu không phải bạn, hãy đổi mật khẩu ngay.`)
      .catch(() => {}); // fire-and-forget, must never block login
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: EXPIRES_IN });
  res.json({ token, user: sanitize(user) });
});

// POST /api/auth/verify-otp  { otpToken, code }
router.post('/verify-otp', (req, res) => {
  const { otpToken, code } = req.body || {};
  if (!otpToken || !code) return res.status(400).json({ error: 'Thiếu mã xác nhận.' });
  let payload;
  try {
    payload = jwt.verify(otpToken, JWT_SECRET);
    if (payload.purpose !== 'otp') throw new Error('bad purpose');
  } catch {
    return res.status(401).json({ error: 'Phiên xác nhận đã hết hạn. Vui lòng đăng nhập lại.' });
  }

  const record = otpStore.get(payload.id);
  if (!record || record.expires < Date.now()) return res.status(401).json({ error: 'Mã xác nhận đã hết hạn. Vui lòng đăng nhập lại.' });
  if (String(code).trim() !== record.code) return res.status(401).json({ error: 'Mã xác nhận không đúng.' });

  otpStore.delete(payload.id);
  const db = getDB();
  const user = db.users.find(u => u.id === payload.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  if (user.status === 'locked') return res.status(403).json({ error: 'Tài khoản đã bị khóa.' });

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: EXPIRES_IN });
  res.json({ token, user: sanitize(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: sanitize(req.user) });
});

// PUT /api/auth/password
router.put('/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải tối thiểu 6 ký tự.' });
  }
  const db = getDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!bcrypt.compareSync(currentPassword || '', user.password)) {
    return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng.' });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
