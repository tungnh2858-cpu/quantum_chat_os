const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();

// GET /api/attendance?classId=...&date=YYYY-MM-DD
router.get('/', requireAuth, requireTool('attendance'), (req, res) => {
  const { classId, date, studentId } = req.query;
  const db = getDB();
  let rows = db.attendance;
  if (classId) rows = rows.filter(a => a.classId === classId);
  if (date) rows = rows.filter(a => a.date === date);
  if (studentId) rows = rows.filter(a => a.studentId === studentId);
  res.json({ attendance: rows });
});

// POST /api/attendance  { classId, date, records: [{studentId, status, note}] }
// status: 'present' | 'absent' | 'late' | 'excused'
router.post('/', requireAuth, requireTool('attendance'), (req, res) => {
  if (!['admin', 'teacher'].includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền điểm danh.' });
  const { classId, date, records } = req.body || {};
  if (!classId || !date || !Array.isArray(records)) return res.status(400).json({ error: 'Thiếu dữ liệu điểm danh.' });

  const db = getDB();
  // remove existing entries for that class+date to avoid duplicates, then re-insert
  db.attendance = db.attendance.filter(a => !(a.classId === classId && a.date === date));
  const created = records.map(r => ({
    id: uuid(),
    classId,
    date,
    studentId: r.studentId,
    status: r.status || 'present',
    note: r.note || '',
    markedBy: req.user.id,
    createdAt: new Date().toISOString()
  }));
  db.attendance.push(...created);
  saveDB(db);
  res.status(201).json({ attendance: created });
});

// GET /api/attendance/summary/:studentId
router.get('/summary/:studentId', requireAuth, requireTool('attendance'), (req, res) => {
  const db = getDB();
  const rows = db.attendance.filter(a => a.studentId === req.params.studentId);
  const summary = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  res.json({ total: rows.length, summary });
});

module.exports = router;
