const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();
const reelDir = path.join(__dirname, '..', 'uploads', 'reels');
if (!fs.existsSync(reelDir)) fs.mkdirSync(reelDir, { recursive: true });
const uploadReel = multer({
  storage: multer.diskStorage({
    destination: reelDir,
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname) || '.mp4'}`)
  }),
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /^video\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Chỉ chấp nhận file video.'))
});

function withAuthor(db, reel) {
  const author = db.users.find(u => u.id === reel.authorId);
  return {
    ...reel,
    author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar, verified: !!author.verified } : null,
    likeCount: reel.likes.length
  };
}

// GET /api/reels  (newest first — vertical swipe feed)
router.get('/', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const reels = [...db.reels].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(r => withAuthor(db, r));
  res.json({ reels });
});

// POST /api/reels  (video required, optional caption)
router.post('/', requireAuth, requireTool('social'), uploadReel.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Cần chọn một video cho Reel.' });
  const db = getDB();
  const reel = {
    id: uuid(),
    authorId: req.user.id,
    video: `/uploads/reels/${req.file.filename}`,
    caption: (req.body && req.body.caption) || '',
    likes: [],
    createdAt: new Date().toISOString()
  };
  db.reels.push(reel);
  saveDB(db);
  res.status(201).json({ reel: withAuthor(db, reel) });
});

// POST /api/reels/:id/like
router.post('/:id/like', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy Reel.' });
  const idx = reel.likes.indexOf(req.user.id);
  if (idx >= 0) reel.likes.splice(idx, 1); else reel.likes.push(req.user.id);
  saveDB(db);
  res.json({ reel: withAuthor(db, reel) });
});

// DELETE /api/reels/:id
router.delete('/:id', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const reel = db.reels.find(r => r.id === req.params.id);
  if (!reel) return res.status(404).json({ error: 'Không tìm thấy Reel.' });
  if (reel.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.reels = db.reels.filter(r => r.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
