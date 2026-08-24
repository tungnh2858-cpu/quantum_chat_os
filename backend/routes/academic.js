const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const uploadLogo = makeUploader('logos');

// ---------------- SCHOOLS ----------------

// GET /api/schools
router.get('/schools', requireAuth, requireTool('academic'), (req, res) => {
  const db = getDB();
  res.json({ schools: db.schools });
});

// POST /api/schools  (admin/teacher creates a school with logo, name, address...)
router.post('/schools', requireAuth, requireTool('academic'), uploadLogo.single('logo'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền.' });
  const { name, address, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Thiếu tên trường.' });
  const db = getDB();
  const school = {
    id: uuid(),
    name,
    address: address || '',
    description: description || '',
    logo: req.file ? `/uploads/logos/${req.file.filename}` : '',
    ownerId: req.user.id,
    createdAt: new Date().toISOString()
  };
  db.schools.push(school);
  saveDB(db);
  res.status(201).json({ school });
});

// PUT /api/schools/:id  (update, optional new logo)
router.put('/schools/:id', requireAuth, requireTool('academic'), uploadLogo.single('logo'), (req, res) => {
  const db = getDB();
  const school = db.schools.find(s => s.id === req.params.id);
  if (!school) return res.status(404).json({ error: 'Không tìm thấy trường.' });
  if (req.user.role !== 'admin' && school.ownerId !== req.user.id) return res.status(403).json({ error: 'Không đủ quyền.' });
  const { name, address, description } = req.body || {};
  if (name) school.name = name;
  if (address !== undefined) school.address = address;
  if (description !== undefined) school.description = description;
  if (req.file) school.logo = `/uploads/logos/${req.file.filename}`;
  saveDB(db);
  res.json({ school });
});

// DELETE /api/schools/:id
router.delete('/schools/:id', requireAuth, requireTool('academic'), requireAdmin, (req, res) => {
  const db = getDB();
  db.schools = db.schools.filter(s => s.id !== req.params.id);
  db.classes = db.classes.filter(c => c.schoolId !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ---------------- CLASSES ----------------

// GET /api/classes
router.get('/classes', requireAuth, requireTool('academic'), (req, res) => {
  const db = getDB();
  res.json({ classes: db.classes });
});

// POST /api/classes
router.post('/classes', requireAuth, requireTool('academic'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền.' });
  const { name, subject, schoolId, teacherId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Thiếu tên lớp.' });
  const db = getDB();
  const klass = {
    id: uuid(),
    name,
    subject: subject || '',
    schoolId: schoolId || null,
    teacherId: teacherId || req.user.id,
    studentIds: [],
    createdAt: new Date().toISOString()
  };
  db.classes.push(klass);
  saveDB(db);
  res.status(201).json({ class: klass });
});

// PUT /api/classes/:id/students  (add/remove students)
router.put('/classes/:id/students', requireAuth, requireTool('academic'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền.' });
  const { studentIds } = req.body || {};
  const db = getDB();
  const klass = db.classes.find(c => c.id === req.params.id);
  if (!klass) return res.status(404).json({ error: 'Không tìm thấy lớp.' });
  klass.studentIds = Array.isArray(studentIds) ? studentIds : klass.studentIds;
  saveDB(db);
  res.json({ class: klass });
});

// DELETE /api/classes/:id
router.delete('/classes/:id', requireAuth, requireTool('academic'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền.' });
  const db = getDB();
  db.classes = db.classes.filter(c => c.id !== req.params.id);
  db.attendance = db.attendance.filter(a => a.classId !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
