const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'du-an';
}

// GET /api/projects  (my projects, or all published for gallery)
router.get('/', requireAuth, requireTool('projects'), (req, res) => {
  const db = getDB();
  const { mine, published } = req.query;
  let list = db.projects;
  if (mine === '1') list = list.filter(p => p.ownerId === req.user.id);
  if (published === '1') list = list.filter(p => p.published);
  res.json({ projects: list.map(p => ({ ...p, html: undefined, css: undefined, js: undefined })) });
});

// GET /api/projects/:id  (full source, owner or admin only)
router.get('/:id', requireAuth, requireTool('projects'), (req, res) => {
  const db = getDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  if (project.ownerId !== req.user.id && req.user.role !== 'admin' && !project.published) {
    return res.status(403).json({ error: 'Không đủ quyền xem dự án này.' });
  }
  res.json({ project });
});

// POST /api/projects  { name, description, html, css, js, published }
router.post('/', requireAuth, requireTool('projects'), (req, res) => {
  const { name, description, html, css, js, published } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Thiếu tên dự án.' });
  const db = getDB();
  let slug = slugify(name);
  let n = 1;
  while (db.projects.some(p => p.slug === slug)) { slug = `${slugify(name)}-${n++}`; }

  const project = {
    id: uuid(),
    ownerId: req.user.id,
    name,
    slug,
    description: description || '',
    html: html || '<h1>Chào mừng đến với dự án của tôi!</h1>',
    css: css || '',
    js: js || '',
    published: !!published,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.projects.push(project);
  saveDB(db);
  res.status(201).json({ project });
});

// PUT /api/projects/:id
router.put('/:id', requireAuth, requireTool('projects'), (req, res) => {
  const db = getDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  if (project.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  const { name, description, html, css, js, published } = req.body || {};
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (html !== undefined) project.html = html;
  if (css !== undefined) project.css = css;
  if (js !== undefined) project.js = js;
  if (published !== undefined) project.published = !!published;
  project.updatedAt = new Date().toISOString();
  saveDB(db);
  res.json({ project });
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, requireTool('projects'), (req, res) => {
  const db = getDB();
  const project = db.projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  if (project.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.projects = db.projects.filter(p => p.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

module.exports = router;
