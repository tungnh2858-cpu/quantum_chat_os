const express = require('express');
const { getDB, saveDB, uuid } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');
const { makeUploader } = require('../middleware/upload');
const { addNotification } = require('../utils/notify');

const router = express.Router();
const uploadGroupCover = makeUploader('groups');

function withMeta(db, group) {
  const owner = db.users.find(u => u.id === group.ownerId);
  return {
    ...group,
    owner: owner ? { id: owner.id, username: owner.username, fullName: owner.fullName, avatar: owner.avatar } : null,
    memberCount: group.members.length,
    postCount: db.groupPosts.filter(p => p.groupId === group.id).length
  };
}

function memberSummary(db, group) {
  return group.members.map(id => {
    const u = db.users.find(x => x.id === id);
    return u ? { id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar } : null;
  }).filter(Boolean);
}

// GET /api/groups  (list every group, newest first)
router.get('/', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const groups = [...db.groups]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(g => ({ ...withMeta(db, g), isMember: g.members.includes(req.user.id) }));
  res.json({ groups });
});

// POST /api/groups  (create a group; creator becomes owner + first member)
router.post('/', requireAuth, requireTool('groups'), (req, res) => {
  const { name, description, privacy } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Tên nhóm không được để trống.' });
  const db = getDB();
  const group = {
    id: uuid(),
    name: name.trim(),
    description: (description || '').trim(),
    privacy: privacy === 'private' ? 'private' : 'public',
    cover: '',
    ownerId: req.user.id,
    members: [req.user.id],
    createdAt: new Date().toISOString()
  };
  db.groups.push(group);
  saveDB(db);
  res.status(201).json({ group: withMeta(db, group) });
});

// GET /api/groups/:id  (detail + members + posts)
router.get('/:id', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  const posts = db.groupPosts
    .filter(p => p.groupId === group.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => {
      const author = db.users.find(u => u.id === p.authorId);
      return {
        ...p,
        author: author ? { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar } : null,
        likeCount: p.likes.length,
        commentCount: p.comments.length
      };
    });
  res.json({
    group: { ...withMeta(db, group), isMember: group.members.includes(req.user.id), members: memberSummary(db, group) },
    posts
  });
});

// POST /api/groups/:id/cover
router.post('/:id/cover', requireAuth, requireTool('groups'), uploadGroupCover.single('cover'), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  if (group.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ chủ nhóm mới có thể đổi ảnh bìa.' });
  if (!req.file) return res.status(400).json({ error: 'Không có file được tải lên.' });
  group.cover = `/uploads/groups/${req.file.filename}`;
  saveDB(db);
  res.json({ group: withMeta(db, group) });
});

// POST /api/groups/:id/join
router.post('/:id/join', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  if (!group.members.includes(req.user.id)) {
    group.members.push(req.user.id);
    addNotification(db, {
      userId: group.ownerId,
      fromId: req.user.id,
      type: 'group_join',
      message: `${req.user.fullName || req.user.username} đã tham gia nhóm "${group.name}" của bạn.`,
      link: `groups.html?id=${group.id}`
    });
  }
  saveDB(db);
  res.json({ group: withMeta(db, group) });
});

// POST /api/groups/:id/leave
router.post('/:id/leave', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  if (group.ownerId === req.user.id) return res.status(400).json({ error: 'Chủ nhóm không thể rời nhóm — hãy xoá nhóm nếu muốn.' });
  group.members = group.members.filter(id => id !== req.user.id);
  saveDB(db);
  res.json({ group: withMeta(db, group) });
});

// DELETE /api/groups/:id
router.delete('/:id', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  if (group.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Không đủ quyền.' });
  db.groups = db.groups.filter(g => g.id !== req.params.id);
  db.groupPosts = db.groupPosts.filter(p => p.groupId !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// POST /api/groups/:id/posts  (text + up to 6 images)
const uploadGroupPostImg = makeUploader('groups');
router.post('/:id/posts', requireAuth, requireTool('groups'), uploadGroupPostImg.array('images', 6), (req, res) => {
  const db = getDB();
  const group = db.groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Không tìm thấy nhóm.' });
  if (!group.members.includes(req.user.id)) return res.status(403).json({ error: 'Hãy tham gia nhóm trước khi đăng bài.' });
  const { content } = req.body || {};
  if (!content && (!req.files || !req.files.length)) return res.status(400).json({ error: 'Bài viết trống.' });
  const images = (req.files || []).map(f => `/uploads/groups/${f.filename}`);
  const post = {
    id: uuid(),
    groupId: group.id,
    authorId: req.user.id,
    content: content || '',
    images,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString()
  };
  db.groupPosts.push(post);
  saveDB(db);
  const author = db.users.find(u => u.id === req.user.id);
  res.status(201).json({
    post: { ...post, author: { id: author.id, username: author.username, fullName: author.fullName, avatar: author.avatar }, likeCount: 0, commentCount: 0 }
  });
});

// POST /api/groups/:groupId/posts/:postId/like
router.post('/:groupId/posts/:postId/like', requireAuth, requireTool('groups'), (req, res) => {
  const db = getDB();
  const post = db.groupPosts.find(p => p.id === req.params.postId && p.groupId === req.params.groupId);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  const idx = post.likes.indexOf(req.user.id);
  if (idx >= 0) post.likes.splice(idx, 1); else post.likes.push(req.user.id);
  saveDB(db);
  res.json({ likeCount: post.likes.length });
});

// POST /api/groups/:groupId/posts/:postId/comments
router.post('/:groupId/posts/:postId/comments', requireAuth, requireTool('groups'), (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Bình luận trống.' });
  const db = getDB();
  const post = db.groupPosts.find(p => p.id === req.params.postId && p.groupId === req.params.groupId);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  post.comments.push({ id: uuid(), authorId: req.user.id, content, createdAt: new Date().toISOString() });
  saveDB(db);
  res.status(201).json({ commentCount: post.comments.length });
});

module.exports = router;
