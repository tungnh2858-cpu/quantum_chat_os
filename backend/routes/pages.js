const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadAvatar = makeUploader('page-avatars');
const uploadCover = makeUploader('page-covers');

function pageView(db, page, viewerId) {
  const owner = db.users.find(u => u.id === page.ownerId);
  const postCount = db.posts.filter(p => p.pageId === page.id).length;
  return {
    id: page.id, name: page.name, avatar: page.avatar, coverImage: page.coverImage,
    bio: page.bio, category: page.category,
    ownerId: page.ownerId, isOwner: viewerId === page.ownerId,
    owner: owner ? { id: owner.id, username: owner.username, fullName: owner.fullName } : null,
    followerCount: (page.followers || []).length,
    isFollowing: viewerId ? (page.followers || []).includes(viewerId) : false,
    postCount,
    createdAt: page.createdAt
  };
}

// GET /api/pages  (browse/search all pages)
router.get('/', requireAuth, (req, res) => {
  const db = getDB();
  const q = (req.query.q || '').trim().toLowerCase();
  let pages = [...db.pages];
  if (q) pages = pages.filter(p => p.name.toLowerCase().includes(q));
  pages.sort((a, b) => (b.followers || []).length - (a.followers || []).length);
  res.json({ pages: pages.map(p => pageView(db, p, req.user.id)) });
});

// GET /api/pages/mine  (pages I own, for the composer's "post as a page" dropdown)
router.get('/mine', requireAuth, (req, res) => {
  const db = getDB();
  const mine = db.pages.filter(p => p.ownerId === req.user.id || req.user.role === 'admin');
  res.json({ pages: mine.map(p => pageView(db, p, req.user.id)) });
});

// GET /api/pages/:id
router.get('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  res.json({ page: pageView(db, page, req.user.id) });
});

// POST /api/pages  (create a new fanpage)
router.post('/', requireAuth, (req, res) => {
  const { name, category, bio } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên Trang.' });
  const db = getDB();
  const page = {
    id: uuid(), ownerId: req.user.id, name: name.trim(),
    avatar: '', coverImage: '', bio: bio || '', category: category || 'Khác',
    followers: [req.user.id], createdAt: new Date().toISOString()
  };
  db.pages.push(page);
  saveDB(db);
  res.status(201).json({ page: pageView(db, page, req.user.id) });
});

// PUT /api/pages/:id  (owner or admin)
router.put('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  if (page.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  const { name, category, bio } = req.body || {};
  if (name !== undefined && name.trim()) page.name = name.trim();
  if (category !== undefined) page.category = category;
  if (bio !== undefined) page.bio = bio;
  saveDB(db);
  res.json({ page: pageView(db, page, req.user.id) });
});

// DELETE /api/pages/:id
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  if (page.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.pages = db.pages.filter(p => p.id !== page.id);
  db.posts = db.posts.filter(p => p.pageId !== page.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/pages/:id/avatar
router.post('/:id/avatar', requireAuth, uploadAvatar.single('avatar'), (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  if (page.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  page.avatar = `/uploads/page-avatars/${req.file.filename}`;
  saveDB(db);
  res.json({ page: pageView(db, page, req.user.id) });
});

// POST /api/pages/:id/cover
router.post('/:id/cover', requireAuth, uploadCover.single('cover'), (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  if (page.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  page.coverImage = `/uploads/page-covers/${req.file.filename}`;
  saveDB(db);
  res.json({ page: pageView(db, page, req.user.id) });
});

// POST /api/pages/:id/follow  |  DELETE to unfollow
router.post('/:id/follow', requireAuth, (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  if (!page.followers.includes(req.user.id)) page.followers.push(req.user.id);
  saveDB(db);
  res.json({ page: pageView(db, page, req.user.id) });
});
router.delete('/:id/follow', requireAuth, (req, res) => {
  const db = getDB();
  const page = db.pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Không tìm thấy Trang.' });
  page.followers = page.followers.filter(id => id !== req.user.id);
  saveDB(db);
  res.json({ page: pageView(db, page, req.user.id) });
});

module.exports = router;
