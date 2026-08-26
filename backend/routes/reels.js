const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeVideoUploader } = require('../middleware/upload');
const { addNotification } = require('../utils/notify');

const router = express.Router();
const uploadReelVideo = makeVideoUploader('reels', 150);

function withAuthor(db, reel) {
  const author = db.users.find(u => u.id === reel.authorId);
  return {
    ...reel,
    author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar, role: author.role } : null,
    likeCount: reel.likes.length,
    commentCount: reel.comments.length
  };
}

// GET /api/reels  (short-video feed, newest first) — optional ?authorId= for a profile page
router.get('/', requireAuth, requireTool('reels'), (req, res) => {
  const db = getDB();
  let feed = [...db.reels];
  if (req.query.authorId) feed = feed.filter(r => r.authorId === req.query.authorId);
  feed = feed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => withAuthor(db, r));
  res.json({ reels: feed });
});

// POST /api/reels  (one short video required, optional caption)
router.post('/', requireAuth, requireTool('reels'), (req, res) => {
  uploadReelVideo.single('video')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Tải video lên thất bại.' });
    if (!req.file) return res.status(400).json({ error: 'Cần chọn một video ngắn.' });
    const db = getDB();
    const reel = {
      id: uuid(),
      authorId: req.user.id,
      video: `/uploads/reels/${req.file.filename}`,
      caption: (req.body && req.body.caption) || '',
      likes: [],
      comments: [],
      views: 0,
      createdAt: new Date().toISOString()
    };
    db.reels.push(reel);
    saveDB(db);
    res.status(201).json({ reel: withAuthor(db, reel) });
  });
});

// POST /api/reels/:id/view  (view counter, best-effort, no auth requirement on double counting)
router.post('/:id/view', requireAuth, requireTool('reels'), (req, res) => {
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy video.' });
  reel.views = (reel.views || 0) + 1;
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/reels/:id/like  (toggle like)
router.post('/:id/like', requireAuth, requireTool('reels'), (req, res) => {
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy video.' });
  const idx = reel.likes.indexOf(req.user.id);
  if (idx >= 0) reel.likes.splice(idx, 1);
  else {
    reel.likes.push(req.user.id);
    addNotification(db, {
      userId: reel.authorId,
      fromId: req.user.id,
      type: 'reel_like',
      message: `${req.user.fullName || req.user.username} đã thích video ngắn của bạn.`,
      link: 'reels.html'
    });
  }
  saveDB(db);
  res.json({ reel: withAuthor(db, reel) });
});

// POST /api/reels/:id/comments
router.post('/:id/comments', requireAuth, requireTool('reels'), (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Bình luận trống.' });
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy video.' });
  const comment = { id: uuid(), authorId: req.user.id, content, createdAt: new Date().toISOString() };
  reel.comments.push(comment);
  addNotification(db, {
    userId: reel.authorId,
    fromId: req.user.id,
    type: 'reel_comment',
    message: `${req.user.fullName || req.user.username} đã bình luận về video ngắn của bạn.`,
    link: 'reels.html'
  });
  saveDB(db);
  res.status(201).json({ reel: withAuthor(db, reel) });
});

// DELETE /api/reels/:id
router.delete('/:id', requireAuth, requireTool('reels'), (req, res) => {
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy video.' });
  if (reel.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.reels = db.reels.filter(r => r.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
