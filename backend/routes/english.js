const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();

// GET /api/english/lessons
router.get('/lessons', requireAuth, requireTool('english'), (req, res) => {
  const db = getDB();
  res.json({ lessons: db.englishLessons });
});

// POST /api/english/lessons  (admin/teacher adds a lesson)
router.post('/lessons', requireAuth, requireTool('english'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền.' });
  const { title, level, words } = req.body || {};
  if (!title || !Array.isArray(words)) return res.status(400).json({ error: 'Thiếu dữ liệu bài học.' });
  const db = getDB();
  const lesson = { id: uuid(), title, level: level || 'A1', words };
  db.englishLessons.push(lesson);
  saveDB(db);
  res.status(201).json({ lesson });
});

// DELETE /api/english/lessons/:id
router.delete('/lessons/:id', requireAuth, requireTool('english'), requireAdmin, (req, res) => {
  const db = getDB();
  db.englishLessons = db.englishLessons.filter(l => l.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
