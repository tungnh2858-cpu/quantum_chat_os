require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');

const { getDB, saveDB, uuid } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const storyRoutes = require('./routes/stories');
const messageRoutes = require('./routes/messages');
const reelRoutes = require('./routes/reels');
const groupRoutes = require('./routes/groups');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Static uploads (avatars, covers, post images, story images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend as static files too, so `node server.js` alone runs the whole app
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'Quantum Chat OS API', time: new Date().toISOString() });
});

// Fallback to SPA index for unknown frontend routes (but keep API/uploads 404s intact)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'), err => { if (err) next(); });
});

// ---- HTTP + WebSocket server (realtime chat, like Facebook Messenger) ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Map(); // userId -> Set of sockets

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  let userId = null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    userId = payload.id;
  } catch (e) {
    ws.close(4001, 'Invalid token');
    return;
  }

  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);

  ws.on('message', raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (data.type === 'chat') {
      const { toId, content } = data;
      if (!toId || !content) return;
      const db = getDB();
      const msg = { id: uuid(), fromId: userId, toId, content, read: false, createdAt: new Date().toISOString() };
      db.messages.push(msg);
      saveDB(db);
      const payload = JSON.stringify({ type: 'chat', message: msg });
      (clients.get(toId) || []).forEach(sock => sock.readyState === 1 && sock.send(payload));
      (clients.get(userId) || []).forEach(sock => sock.readyState === 1 && sock.send(payload));
    }
    if (data.type === 'typing') {
      const payload = JSON.stringify({ type: 'typing', fromId: userId });
      (clients.get(data.toId) || []).forEach(sock => sock.readyState === 1 && sock.send(payload));
    }
  });

  ws.on('close', () => {
    const set = clients.get(userId);
    if (set) { set.delete(ws); if (set.size === 0) clients.delete(userId); }
  });
});

server.listen(PORT, () => {
  console.log(`Quantum Chat OS backend + frontend running at http://localhost:${PORT}`);
  console.log(`WebSocket chat available at ws://localhost:${PORT}/ws`);
});
