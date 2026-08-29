const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../mailer');

const router = express.Router();
const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function sanitize(user) { const { password, ...rest } = user; return rest; }

// GET /api/admin/settings
router.get('/settings', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  res.json({ settings: db.adminSettings });
});

// PUT /api/admin/settings  { requireApproval: true|false }
router.put('/settings', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  if (typeof req.body.requireApproval === 'boolean') db.adminSettings.requireApproval = req.body.requireApproval;
  saveDB(db);
  res.json({ settings: db.adminSettings });
});

// GET /api/admin/pending-users  (registrations awaiting approval)
router.get('/pending-users', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  res.json({ pendingUsers: db.pendingUsers.map(sanitize) });
});

// POST /api/admin/pending-users/:id/approve
router.post('/pending-users/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  const idx = db.pendingUsers.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy yêu cầu đăng ký.' });
  const [pending] = db.pendingUsers.splice(idx, 1);
  pending.status = 'active';
  db.users.push(pending);
  saveDB(db);
  if (pending.email) sendMail(pending.email, 'Tài khoản Quantum Chat OS đã được duyệt!', `Xin chào ${pending.fullName},\n\nTài khoản @${pending.username} của bạn đã được Admin phê duyệt. Bạn có thể đăng nhập ngay bây giờ!`).catch(() => {});
  res.json({ ok: true });
});

// POST /api/admin/pending-users/:id/reject
router.post('/pending-users/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const db = getDB();
  const before = db.pendingUsers.length;
  const rejected = db.pendingUsers.find(u => u.id === req.params.id);
  db.pendingUsers = db.pendingUsers.filter(u => u.id !== req.params.id);
  if (db.pendingUsers.length === before) return res.status(404).json({ error: 'Không tìm thấy yêu cầu đăng ký.' });
  saveDB(db);
  if (rejected && rejected.email) sendMail(rejected.email, 'Yêu cầu đăng ký Quantum Chat OS', `Xin chào ${rejected.fullName},\n\nRất tiếc, yêu cầu đăng ký tài khoản @${rejected.username} của bạn đã bị từ chối.`).catch(() => {});
  res.json({ ok: true });
});

// GET /api/admin/import-template  (download the sample .xlsx used for bulk import)
router.get('/import-template', requireAuth, requireAdmin, (req, res) => {
  const path = require('path');
  res.download(path.join(__dirname, '..', 'templates', 'mau-nhap-tai-khoan.xlsx'), 'mau-nhap-tai-khoan.xlsx');
});

// POST /api/admin/bulk-import  (multipart "file" = .xlsx)
// Expected columns (header row, Vietnamese or English both accepted — see the template):
//   username | password (optional, auto-generated if blank) | fullName | email | phone | role (user/admin)
router.post('/bulk-import', requireAuth, requireAdmin, uploadExcel.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file Excel (.xlsx).' });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (e) {
    return res.status(400).json({ error: 'Không đọc được file Excel. Hãy dùng file mẫu được cung cấp.' });
  }

  const pick = (row, keys) => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const found = rowKeys.find(rk => rk.trim().toLowerCase().includes(k));
      if (found && String(row[found]).trim()) return String(row[found]).trim();
    }
    return '';
  };
  const genPassword = () => Math.random().toString(36).slice(-4) + Math.random().toString(36).slice(-4).toUpperCase() + '@' + Math.floor(Math.random() * 900 + 100);

  const db = getDB();
  const created = [];
  const skipped = [];

  rows.forEach((row, i) => {
    const username = pick(row, ['username', 'tên đăng nhập', 'ten dang nhap']);
    const fullName = pick(row, ['fullname', 'full name', 'họ và tên', 'ho va ten', 'họ tên']);
    const email = pick(row, ['email']);
    const phone = pick(row, ['phone', 'số điện thoại', 'so dien thoai', 'sđt']);
    const roleRaw = pick(row, ['role', 'vai trò', 'vai tro']).toLowerCase();
    let password = pick(row, ['password', 'mật khẩu', 'mat khau']);

    if (!username) { skipped.push({ row: i + 2, reason: 'Thiếu tên đăng nhập.' }); return; }
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase()) ||
        created.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      skipped.push({ row: i + 2, username, reason: 'Tên đăng nhập đã tồn tại.' });
      return;
    }
    if (!password) password = genPassword();

    const newUser = {
      id: uuid(),
      username,
      password: bcrypt.hashSync(password, 10),
      role: roleRaw === 'admin' ? 'admin' : 'user',
      fullName: fullName || username,
      email, phone,
      avatar: '', coverImage: '', bio: '',
      birthday: '', location: '', education: '', website: '',
      verified: roleRaw === 'admin', verificationStatus: roleRaw === 'admin' ? 'approved' : 'none',
      friends: [], following: [],
      theme: 'dark',
      notifications: { email: true, push: true, chat: true },
      security: { requireLoginOtp: false, emailOnLogin: false, allowedTools: null },
      status: 'active',
      lastBirthdayNotifiedYear: null,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    created.push({ username, password, fullName: newUser.fullName, email, phone });
  });

  saveDB(db);
  res.json({ createdCount: created.length, created, skippedCount: skipped.length, skipped });
});

module.exports = router;
