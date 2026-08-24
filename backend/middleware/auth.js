const jwt = require('jsonwebtoken');
const { getDB } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_super_secret_key_please';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Thiếu token xác thực.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    if (user.status === 'locked') return res.status(403).json({ error: 'Tài khoản đã bị khóa.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yêu cầu quyền Admin.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
