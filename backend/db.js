/**
 * EduPulse - Lightweight JSON-file database.
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
  const adminPasswordHash = bcrypt.hashSync('Tunglaihoclaptrinhmobile@1142010ADMIN', 10);
  return {
    users: [
      {
        id: 'ADMIN1',
        username: 'tungnguyenADMIN12345678',
        password: adminPasswordHash,
        role: 'admin',
        fullName: 'Tung Nguyen (System Admin)',
        email: 'tung123t8@gmail.com',
        avatar: '',
        bio: 'Quản trị hệ thống EduPulse Quantum OS',
        theme: 'dark',
        notifications: { email: true, push: true, chat: true },
        security: { requireLoginOtp: true, emailOnLogin: true, allowedTools: null },
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ],
    schools: [],
    classes: [],
    attendance: [],
    posts: [],
    stories: [],
    messages: [],
    projects: [],
    storeItems: [
      { id: 'ext-ai-tutor', name: 'AI Tutor Assistant', description: 'Trợ lý AI giải đáp bài tập theo thời gian thực.', icon: 'fa-robot', category: 'AI', installed: [] },
      { id: 'ext-quiz-maker', name: 'Quiz Maker Pro', description: 'Tạo bài kiểm tra trắc nghiệm nhanh cho lớp học.', icon: 'fa-list-check', category: 'Giảng dạy', installed: [] },
      { id: 'ext-code-runner', name: 'Multi-language Code Runner', description: 'Chạy code trực tiếp trong IDE với hơn 30 ngôn ngữ.', icon: 'fa-code', category: 'Lập trình', installed: [] },
      { id: 'ext-attendance-qr', name: 'QR Attendance', description: 'Điểm danh bằng mã QR chỉ trong 1 chạm.', icon: 'fa-qrcode', category: 'Điểm danh', installed: [] },
      { id: 'ext-english-flash', name: 'English Flashcards', description: 'Bộ thẻ ghi nhớ từ vựng tiếng Anh theo chủ đề.', icon: 'fa-language', category: 'Tiếng Anh', installed: [] }
    ],
    englishLessons: [
      { id: 'en-1', title: 'Basic Greetings', level: 'A1', words: [
        { word: 'Hello', meaning: 'Xin chào' }, { word: 'Goodbye', meaning: 'Tạm biệt' },
        { word: 'Please', meaning: 'Làm ơn' }, { word: 'Thank you', meaning: 'Cảm ơn' }
      ]},
      { id: 'en-2', title: 'Classroom Objects', level: 'A1', words: [
        { word: 'Book', meaning: 'Quyển sách' }, { word: 'Pen', meaning: 'Cây bút' },
        { word: 'Desk', meaning: 'Cái bàn' }, { word: 'Chair', meaning: 'Cái ghế' }
      ]},
      { id: 'en-3', title: 'Programming Vocabulary', level: 'B1', words: [
        { word: 'Variable', meaning: 'Biến' }, { word: 'Function', meaning: 'Hàm' },
        { word: 'Loop', meaning: 'Vòng lặp' }, { word: 'Array', meaning: 'Mảng' }
      ]}
    ]
  };
}

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB(), null, 2));
  }
}

function migrate(db) {
  if (!Array.isArray(db.stories)) db.stories = [];
  (db.users || []).forEach(u => {
    if (u.coverImage === undefined) u.coverImage = '';
    if (u.bio === undefined) u.bio = '';
  });
  (db.posts || []).forEach(p => {
    if (!Array.isArray(p.images)) p.images = p.image ? [p.image] : [];
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
