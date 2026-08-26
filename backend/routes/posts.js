const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makePostMediaUploader } = require('../middleware/upload');
const { addNotification } = require('../utils/notify');

const router = express.Router();
const uploadPostMedia = makePostMediaUploader('posts');

function withAuthor(db, post) {
  const author = db.users.find(u => u.id === post.authorId);
  return {
    ...post,
    author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar, role: author.role } : null,
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

// POST /api/posts  (create a post: 0-10 images OR 1 video, order of "images" fields sets the layout order)
router.post('/', requireAuth, requireTool('social'), (req, res) => {
  uploadPostMedia(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Tải tệp lên thất bại.' });
    const { content, privacy } = req.body || {};
    const imageFiles = (req.files && req.files.images) || [];
    const videoFile = (req.files && req.files.video && req.files.video[0]) || null;
    if (!content && !imageFiles.length && !videoFile) return res.status(400).json({ error: 'Bài viết trống.' });
    const db = getDB();
    const images = imageFiles.map(f => `/uploads/posts/${f.filename}`);
    const video = videoFile ? `/uploads/posts/${videoFile.filename}` : '';
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
  else {
    post.likes.push(req.user.id);
    addNotification(db, {
      userId: post.authorId,
      fromId: req.user.id,
      type: 'like',
      message: `${req.user.fullName || req.user.username} đã thích bài viết của bạn.`,
      link: `profile.html?id=${post.authorId}`
    });
  }
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
  addNotification(db, {
    userId: post.authorId,
    fromId: req.user.id,
    type: 'comment',
    message: `${req.user.fullName || req.user.username} đã bình luận về bài viết của bạn.`,
    link: `profile.html?id=${post.authorId}`
  });
  saveDB(db);
  res.status(201).json({ post: withAuthor(db, post) });
});

module.exports = router;
