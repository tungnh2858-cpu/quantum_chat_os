const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadStoryImg = makeUploader('stories');
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24h, like Facebook/Instagram stories

function isActive(story) {
  return Date.now() - new Date(story.createdAt).getTime() < STORY_LIFETIME_MS;
}

// GET /api/stories  -> active stories grouped by author, newest author-activity first
router.get('/', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const active = db.stories.filter(isActive).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const byAuthor = new Map();
  active.forEach(s => {
    if (!byAuthor.has(s.authorId)) byAuthor.set(s.authorId, []);
    byAuthor.get(s.authorId).push(s);
  });
  const groups = [...byAuthor.entries()].map(([authorId, stories]) => {
    const author = db.users.find(u => u.id === authorId);
    return {
      author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar } : null,
      stories: stories.map(s => ({ id: s.id, image: s.image, caption: s.caption, background: s.background || '', createdAt: s.createdAt, viewers: s.viewers.length }))
    };
  }).sort((a, b) => {
    const latest = g => Math.max(...g.stories.map(s => new Date(s.createdAt).getTime()));
    return latest(b) - latest(a);
  });
  res.json({ groups });
});

// POST /api/stories  (either an image, or a text-only story with a background color — at least one of the two)
router.post('/', requireAuth, requireTool('social'), uploadStoryImg.single('image'), (req, res) => {
  const { caption, background, privacy } = req.body || {};
  if (!req.file && !(caption && caption.trim())) return res.status(400).json({ error: 'Cần chọn một ảnh hoặc nhập nội dung cho tin.' });
  const db = getDB();
  const story = {
    id: uuid(),
    authorId: req.user.id,
    image: req.file ? `/uploads/stories/${req.file.filename}` : '',
    caption: caption || '',
    background: background || '',
    privacy: ['public', 'friends'].includes(privacy) ? privacy : 'public',
    viewers: [],
    createdAt: new Date().toISOString()
  };
  db.stories.push(story);
  // Housekeeping: drop expired stories so db.json doesn't grow forever
  db.stories = db.stories.filter(isActive);
  saveDB(db);
  res.status(201).json({ story });
});

// POST /api/stories/:id/view  (mark viewed by current user)
router.post('/:id/view', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const story = db.stories.find(s => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Tin không tồn tại hoặc đã hết hạn.' });
  if (!story.viewers.includes(req.user.id)) story.viewers.push(req.user.id);
  saveDB(db);
  res.json({ ok: true });
});

// DELETE /api/stories/:id
router.delete('/:id', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const story = db.stories.find(s => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Không tìm thấy tin.' });
  if (story.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.stories = db.stories.filter(s => s.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
