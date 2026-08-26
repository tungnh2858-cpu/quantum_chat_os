/**
 * Quantum Chat OS - Lightweight JSON-file database.
 * No native build tools required -> works everywhere (Windows/macOS/Linux/Termux).
 * For larger deployments, swap this module for a real DB (Postgres/Mongo) while
 * keeping the same exported API (getDB / saveDB / helpers).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function defaultDB() {
  const adminPasswordHash = bcrypt.hashSync('Tungnguyenlaihoclaptrinhmobile@142010', 10);
  return {
    users: [
      {
        id: 'ADMIN1',
        username: 'TunglaihoclaptrinhSocialMedia',
        password: adminPasswordHash,
        role: 'admin',
        fullName: 'Quantum Chat OS Admin',
        email: 'tung123t8@gmail.com',
        phone: '0389175548',
        avatar: '',
        coverImage: '',
        bio: 'Quản trị viên hệ thống Quantum Chat OS',
        theme: 'dark',
        notifications: { email: true, push: true, chat: true },
        security: { requireLoginOtp: true, emailOnLogin: true, allowedTools: null },
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ],
    posts: [],
    stories: [],
    messages: [],
    reels: [],
    notifications: [],
    groups: [],
    groupPosts: []
  };
}

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB(), null, 2));
  }
}

// Backfill fields on databases created by older versions of the app.
function migrate(db) {
  if (!Array.isArray(db.stories)) db.stories = [];
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.reels)) db.reels = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.groups)) db.groups = [];
  if (!Array.isArray(db.groupPosts)) db.groupPosts = [];
  db.users.forEach(u => {
    if (u.coverImage === undefined) u.coverImage = '';
    if (u.bio === undefined) u.bio = '';
    if (u.phone === undefined) u.phone = '';
    if (u.role === 'teacher' || u.role === 'student' || u.role === 'developer') u.role = 'user';
  });
  db.posts.forEach(p => {
    if (!Array.isArray(p.images)) p.images = p.image ? [p.image] : [];
    if (p.video === undefined) p.video = '';
  });
  db.reels.forEach(r => {
    if (!Array.isArray(r.likes)) r.likes = [];
    if (!Array.isArray(r.comments)) r.comments = [];
  });
  db.groups.forEach(g => {
    if (!Array.isArray(g.members)) g.members = g.ownerId ? [g.ownerId] : [];
  });
  return db;
}

function getDB() {
  ensureDB();
  return migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

module.exports = { getDB, saveDB, uuid, DATA_DIR, DB_FILE };
