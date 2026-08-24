const express = require('express');
const { getDB, saveDB } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();

// GET /api/store  (marketplace items)
router.get('/', requireAuth, requireTool('store'), (req, res) => {
  const db = getDB();
  const items = db.storeItems.map(i => ({ ...i, installedByMe: i.installed.includes(req.user.id) }));
  res.json({ items });
});

// POST /api/store  (admin/developer publish a new extension to the marketplace)
router.post('/', requireAuth, requireTool('store'), (req, res) => {
  if (!['admin', 'developer'].includes(req.user.role)) return res.status(403).json({ error: 'Chỉ Admin hoặc Developer mới được đăng tiện ích mới.' });
  const { id, name, description, icon, category } = req.body || {};
  if (!id || !name) return res.status(400).json({ error: 'Thiếu mã định danh hoặc tên tiện ích.' });
  const db = getDB();
  if (db.storeItems.some(i => i.id === id)) return res.status(409).json({ error: 'Mã định danh tiện ích đã tồn tại.' });
  const item = { id, name, description: description || '', icon: icon || 'fa-puzzle-piece', category: category || 'Khác', installed: [], publishedBy: req.user.id };
  db.storeItems.push(item);
  saveDB(db);
  res.status(201).json({ item: { ...item, installedByMe: false } });
});

// DELETE /api/store/:id  (admin/developer removes their extension)
router.delete('/:id', requireAuth, requireTool('store'), (req, res) => {
  const db = getDB();
  const item = db.storeItems.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy tiện ích.' });
  if (req.user.role !== 'admin' && item.publishedBy !== req.user.id) return res.status(403).json({ error: 'Không đủ quyền xoá tiện ích này.' });
  db.storeItems = db.storeItems.filter(i => i.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/store/:id/install
router.post('/:id/install', requireAuth, requireTool('store'), (req, res) => {
  const db = getDB();
  const item = db.storeItems.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy tiện ích.' });
  if (!item.installed.includes(req.user.id)) item.installed.push(req.user.id);
  saveDB(db);
  res.json({ item: { ...item, installedByMe: true } });
});

// POST /api/store/:id/uninstall
router.post('/:id/uninstall', requireAuth, requireTool('store'), (req, res) => {
  const db = getDB();
  const item = db.storeItems.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Không tìm thấy tiện ích.' });
  item.installed = item.installed.filter(uid => uid !== req.user.id);
  saveDB(db);
  res.json({ item: { ...item, installedByMe: false } });
});

module.exports = router;
