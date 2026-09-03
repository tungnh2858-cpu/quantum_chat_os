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
        birthday: '',        // 'YYYY-MM-DD'
        location: '',        // "Lives in ..."
        education: '',       // school / university name
        website: '',         // contact link (Instagram, website, ...)
        verified: true,      // blue check — admin is verified by default
        verificationStatus: 'approved', // none | pending | approved | rejected
        verificationBlocked: false, // admin can stop this account from ever requesting the blue check
        friendCountOverride: null,   // admin can force a custom "friend count" shown on the profile
        followerCountOverride: null, // admin can force a custom "follower count" shown on the profile
        friends: [],
        following: [],
        theme: 'dark',
        notifications: { email: true, push: true, chat: true },
        security: { requireLoginOtp: true, emailOnLogin: true, allowedTools: null },
        status: 'active',
        lastBirthdayNotifiedYear: null,
        createdAt: new Date().toISOString()
      }
    ],
    pendingUsers: [],     // registrations awaiting admin approval (when adminSettings.requireApproval = true)
    posts: [],
    stories: [],
    reels: [],
    messages: [],
    friendRequests: [],   // { id, fromId, toId, status: 'pending'|'accepted'|'rejected'|'cancelled', createdAt }
    notifications: [],    // { id, userId, type, actorId, data, read, createdAt }
    verificationRequests: [], // { id, userId, status: 'pending'|'approved'|'rejected', createdAt }
    adminSettings: {
      requireApproval: false // if true, new sign-ups sit in pendingUsers until an admin approves them
    }
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
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!Array.isArray(db.stories)) db.stories = [];
  if (!Array.isArray(db.reels)) db.reels = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.pendingUsers)) db.pendingUsers = [];
  if (!Array.isArray(db.friendRequests)) db.friendRequests = [];
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.verificationRequests)) db.verificationRequests = [];
  if (!db.adminSettings) db.adminSettings = { requireApproval: false };
  if (db.adminSettings.requireApproval === undefined) db.adminSettings.requireApproval = false;

  db.users.forEach(u => {
    if (u.coverImage === undefined) u.coverImage = '';
    if (u.bio === undefined) u.bio = '';
    if (u.phone === undefined) u.phone = '';
    if (u.birthday === undefined) u.birthday = '';
    if (u.location === undefined) u.location = '';
    if (u.education === undefined) u.education = '';
    if (u.website === undefined) u.website = '';
    if (u.verified === undefined) u.verified = u.id === 'ADMIN1';
    if (u.verificationStatus === undefined) u.verificationStatus = u.verified ? 'approved' : 'none';
    if (u.verificationBlocked === undefined) u.verificationBlocked = false;
    if (u.friendCountOverride === undefined) u.friendCountOverride = null;
    if (u.followerCountOverride === undefined) u.followerCountOverride = null;
    if (!Array.isArray(u.friends)) u.friends = [];
    if (!Array.isArray(u.following)) u.following = [];
    if (u.lastBirthdayNotifiedYear === undefined) u.lastBirthdayNotifiedYear = null;
    if (u.role === 'teacher' || u.role === 'student' || u.role === 'developer') u.role = 'user';
  });
  db.posts.forEach(p => {
    if (!Array.isArray(p.images)) p.images = p.image ? [p.image] : [];
    if (p.video === undefined) p.video = '';
    if (p.edited === undefined) p.edited = false;
    if (p.editedAt === undefined) p.editedAt = null;
    (p.comments || []).forEach(c => {
      if (c.parentId === undefined) c.parentId = null;
      if (!Array.isArray(c.likes)) c.likes = [];
      if (c.edited === undefined) c.edited = false;
      if (c.editedAt === undefined) c.editedAt = null;
      if (c.deleted === undefined) c.deleted = false;
    });
  });
  db.messages.forEach(m => {
    if (m.image === undefined) m.image = '';
    if (m.deleted === undefined) m.deleted = false;
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
