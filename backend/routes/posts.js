const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeUploader } = require('../middleware/upload');
const { pushNotification } = require('../notify');

const router = express.Router();
const uploadPostImg = makeUploader('posts');

// Videos need their own uploader (bigger size limit, video mimetypes).
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
const uploadPostVideo = multer({
  storage: multer.diskStorage({
    destination: videoDir,
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname) || '.mp4'}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /^video\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Chỉ chấp nhận file video.'))
});

// Accept either multiple "images" OR a single "video" on the same endpoint.
const uploadPostMedia = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, file.fieldname === 'video' ? videoDir : path.join(__dirname, '..', 'uploads', 'posts')),
    filename: (req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname) || ''}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') return /^video\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Chỉ chấp nhận file video.'));
    return /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Chỉ chấp nhận file ảnh.'));
  }
}).fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]);

function withAuthor(db, post) {
  const author = db.users.find(u => u.id === post.authorId);
  return {
    ...post,
    author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar, role: author.role, verified: !!author.verified } : null,
    likeCount: post.likes.length,
    commentCount: post.comments.length
  };
}

// GET /api/posts  (news feed, newest first) — optional ?authorId= to filter for a profile page
router.get('/', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  let feed = [...db.posts];
  if (req.query.authorId) feed = feed.filter(p => p.authorId === req.query.authorId);
  feed = feed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(p => withAuthor(db, p));
  res.json({ posts: feed });
});

// POST /api/posts  (create a post: 0-10 images OR one video, plus text; order of "images" = layout order)
router.post('/', requireAuth, requireTool('social'), (req, res) => {
  uploadPostMedia(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const { content, privacy } = req.body || {};
    const files = req.files || {};
    const images = (files.images || []).map(f => `/uploads/posts/${f.filename}`);
    const video = files.video && files.video[0] ? `/uploads/videos/${files.video[0].filename}` : '';
    if (!content && !images.length && !video) return res.status(400).json({ error: 'Bài viết trống.' });

    const db = getDB();
    const post = {
      id: uuid(),
      authorId: req.user.id,
      content: content || '',
      images,
      video,
      image: images[0] || '', // kept for backward compatibility with older clients
      privacy: ['public', 'friends', 'private'].includes(privacy) ? privacy : 'public',
      likes: [],
      comments: [],
      createdAt: new Date().toISOString()
    };
    db.posts.push(post);
    saveDB(db);
    res.status(201).json({ post: withAuthor(db, post) });
  });
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  if (post.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.posts = db.posts.filter(p => p.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/posts/:id/like  (toggle like)
router.post('/:id/like', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const idx = post.likes.indexOf(req.user.id);
  if (idx >= 0) post.likes.splice(idx, 1);
  else { post.likes.push(req.user.id); pushNotification(db, { userId: post.authorId, type: 'like', actorId: req.user.id }); }
  saveDB(db);
  res.json({ post: withAuthor(db, post) });
});

// POST /api/posts/:id/comments
router.post('/:id/comments', requireAuth, requireTool('social'), (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Bình luận trống.' });
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const comment = { id: uuid(), authorId: req.user.id, content, createdAt: new Date().toISOString() };
  post.comments.push(comment);
  pushNotification(db, { userId: post.authorId, type: 'comment', actorId: req.user.id });
  saveDB(db);
  res.status(201).json({ post: withAuthor(db, post) });
});

module.exports = router;
