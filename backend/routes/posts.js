const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { pushNotification } = require('../notify');

const router = express.Router();

// Videos need their own uploader (bigger size limit, video mimetypes).
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

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

function authorCard(db, authorId) {
  const author = db.users.find(u => u.id === authorId);
  return author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar, role: author.role, verified: !!author.verified } : null;
}

function commentView(db, c) {
  if (c.deleted) return { id: c.id, deleted: true, parentId: c.parentId || null, createdAt: c.createdAt };
  return {
    id: c.id, content: c.content, parentId: c.parentId || null,
    author: authorCard(db, c.authorId),
    likes: c.likes || [],
    likeCount: (c.likes || []).length,
    edited: !!c.edited, editedAt: c.editedAt || null,
    createdAt: c.createdAt
  };
}

function withAuthor(db, post) {
  return {
    ...post,
    author: authorCard(db, post.authorId),
    likeCount: post.likes.length,
    commentCount: post.comments.filter(c => !c.deleted).length,
    comments: post.comments.map(c => commentView(db, c))
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
      edited: false, editedAt: null,
      createdAt: new Date().toISOString()
    };
    db.posts.push(post);
    saveDB(db);
    res.status(201).json({ post: withAuthor(db, post) });
  });
});

// PUT /api/posts/:id  (edit the text content of a post — author or admin)
router.put('/:id', requireAuth, requireTool('social'), (req, res) => {
  const { content, privacy } = req.body || {};
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  if (post.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  if (content !== undefined) {
    if (!content.trim() && !post.images.length && !post.video) return res.status(400).json({ error: 'Bài viết không thể để trống.' });
    post.content = content;
  }
  if (privacy && ['public', 'friends', 'private'].includes(privacy)) post.privacy = privacy;
  post.edited = true;
  post.editedAt = new Date().toISOString();
  saveDB(db);
  res.json({ post: withAuthor(db, post) });
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

// POST /api/posts/:id/comments  (optional "parentId" to reply to another comment)
router.post('/:id/comments', requireAuth, requireTool('social'), (req, res) => {
  const { content, parentId } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Bình luận trống.' });
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  if (parentId && !post.comments.some(c => c.id === parentId)) return res.status(404).json({ error: 'Không tìm thấy bình luận gốc.' });
  const comment = { id: uuid(), authorId: req.user.id, content, parentId: parentId || null, likes: [], edited: false, editedAt: null, deleted: false, createdAt: new Date().toISOString() };
  post.comments.push(comment);
  const notifyTarget = parentId ? post.comments.find(c => c.id === parentId).authorId : post.authorId;
  pushNotification(db, { userId: notifyTarget, type: 'comment', actorId: req.user.id });
  saveDB(db);
  res.status(201).json({ post: withAuthor(db, post) });
});

// PUT /api/posts/:postId/comments/:commentId  (edit a comment — author or admin)
router.put('/:postId/comments/:commentId', requireAuth, requireTool('social'), (req, res) => {
  const { content } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'Bình luận không thể để trống.' });
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const comment = post.comments.find(c => c.id === req.params.commentId);
  if (!comment || comment.deleted) return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
  if (comment.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  comment.content = content;
  comment.edited = true;
  comment.editedAt = new Date().toISOString();
  saveDB(db);
  res.json({ post: withAuthor(db, post) });
});

// DELETE /api/posts/:postId/comments/:commentId  (author or admin — soft delete so replies stay attached)
router.delete('/:postId/comments/:commentId', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const comment = post.comments.find(c => c.id === req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
  if (comment.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  const hasReplies = post.comments.some(c => c.parentId === comment.id && !c.deleted);
  if (hasReplies) {
    comment.deleted = true;
    comment.content = '';
  } else {
    post.comments = post.comments.filter(c => c.id !== comment.id);
  }
  saveDB(db);
  res.json({ post: withAuthor(db, post) });
});

// POST /api/posts/:postId/comments/:commentId/like  (toggle like on a comment)
router.post('/:postId/comments/:commentId/like', requireAuth, requireTool('social'), (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const comment = post.comments.find(c => c.id === req.params.commentId);
  if (!comment || comment.deleted) return res.status(404).json({ error: 'Không tìm thấy bình luận.' });
  if (!Array.isArray(comment.likes)) comment.likes = [];
  const idx = comment.likes.indexOf(req.user.id);
  if (idx >= 0) comment.likes.splice(idx, 1);
  else { comment.likes.push(req.user.id); pushNotification(db, { userId: comment.authorId, type: 'like', actorId: req.user.id }); }
  saveDB(db);
  res.json({ post: withAuthor(db, post) });
});

module.exports = router;
