require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');

const { getDB, saveDB, uuid } = require('./db');
const { JWT_SECRET } = require('./middleware/auth');
const realtime = require('./realtime');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const storyRoutes = require('./routes/stories');
const messageRoutes = require('./routes/messages');
const friendRoutes = require('./routes/friends');
const notificationRoutes = require('./routes/notifications');
const reelRoutes = require('./routes/reels');
const adminRoutes = require('./routes/admin');

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
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/admin', adminRoutes);

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

function broadcastPresence(userId, online) {
  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return;
  const payload = { type: 'presence', userId, online };
  (user.friends || []).forEach(friendId => realtime.sendToUser(friendId, payload));
}

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

  const wasOffline = !realtime.isOnline(userId);
  realtime.register(userId, ws);
  if (wasOffline) broadcastPresence(userId, true);

  ws.on('message', raw => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === 'chat') {
      const { toId, content } = data;
      if (!toId || !content) return;
      const db = getDB();
      const msg = { id: uuid(), fromId: userId, toId, content, image: '', deleted: false, read: false, createdAt: new Date().toISOString() };
      db.messages.push(msg);
      saveDB(db);
      const payload = { type: 'chat', message: msg };
      realtime.sendToUser(toId, payload);
      realtime.sendToUser(userId, payload);
    }

    if (data.type === 'typing') {
      realtime.sendToUser(data.toId, { type: 'typing', fromId: userId });
    }
  });

  ws.on('close', () => {
    realtime.unregister(userId, ws);
    if (!realtime.isOnline(userId)) broadcastPresence(userId, false);
  });
});

server.listen(PORT, () => {
  console.log(`Quantum Chat OS backend + frontend running at http://localhost:${PORT}`);
  console.log(`WebSocket chat available at ws://localhost:${PORT}/ws`);
});
