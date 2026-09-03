/**
 * Quantum Chat OS - Shared post feed renderer (used by social.html + profile.html).
 * Handles: post edit/delete, nested comment threads with reply/edit/delete/like,
 * and wires the emoji picker onto composer + comment/reply inputs.
 *
 * Depends on: EduAPI, EduLayout, EduVideo, EduEmoji (all loaded before this file).
 */
const EduFeed = (() => {
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function avatarHtml(u, size) {
    if (!u) return `<img src="assets/img/default-avatar.svg" class="w-${size} h-${size} rounded-full object-cover">`;
    return u.avatar
      ? `<img src="${EduAPI.fileUrl(u.avatar)}" class="w-${size} h-${size} rounded-full object-cover" onerror="this.onerror=null;this.src='assets/img/broken-image.svg'">`
      : `<img src="assets/img/default-avatar.svg" class="w-${size} h-${size} rounded-full object-cover">`;
  }
  function gridClass(n) { return n === 1 ? 'g1' : n === 2 ? 'g2' : n === 3 ? 'g3' : 'g4'; }
  function imagesGridHtml(urls) {
    if (!urls.length) return '';
    const shown = urls.slice(0, 4);
    const extra = urls.length - 4;
    return `<div class="img-grid ${gridClass(shown.length)} mb-2">${shown.map((u, i) => `
      <div style="position:relative">
        <img src="${u}" onerror="this.onerror=null;this.src='assets/img/broken-image.svg'">
        ${i === 3 && extra > 0 ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.25rem">+${extra}</div>` : ''}
      </div>`).join('')}</div>`;
  }
  function timeAgo(iso) { return EduLayout.timeAgo(iso); }

  function buildCommentTree(comments) {
    const byParent = {};
    comments.forEach(c => {
      const key = c.parentId || 'root';
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(c);
    });
    return byParent;
  }

  function commentHtml(c, tree, depth, postId) {
    const me = EduAPI.getUser();
    if (c.deleted) {
      const kids = (tree[c.id] || []).map(k => commentHtml(k, tree, depth + 1, postId)).join('');
      return `
      <div class="flex gap-2 mt-2" style="margin-left:${depth * 24}px" data-comment-id="${c.id}">
        <div class="w-7 h-7 rounded-full bg-white/5 flex-shrink-0"></div>
        <p class="text-xs text-slate-600 italic pt-1.5">Bình luận đã bị xoá</p>
      </div>${kids}`;
    }
    const isMine = c.author && c.author.id === me.id;
    const canModerate = isMine || me.role === 'admin';
    const liked = (c.likes || []).includes(me.id);
    const kids = (tree[c.id] || []).map(k => commentHtml(k, tree, depth + 1, postId)).join('');
    return `
    <div class="mt-2" style="margin-left:${depth * 24}px" data-comment-id="${c.id}">
      <div class="flex gap-2">
        ${c.author ? `<a href="profile.html?id=${c.author.id}" class="flex-shrink-0">${avatarHtml(c.author, 7)}</a>` : `<div class="w-7 h-7 flex-shrink-0">${avatarHtml(null, 7)}</div>`}
        <div class="flex-1 min-w-0">
          <div class="bg-white/5 rounded-2xl px-3 py-2 inline-block max-w-full">
            <a href="profile.html?id=${c.author ? c.author.id : ''}" class="text-xs font-bold hover:underline flex items-center gap-1">${c.author ? escapeHtml(c.author.fullName || c.author.username) : 'Ẩn danh'}${EduLayout.verifiedBadge(c.author)}</a>
            <p class="text-xs text-slate-200 whitespace-pre-wrap comment-content" data-view>${escapeHtml(c.content)}</p>
            <textarea class="input-field text-xs mt-1 hidden" data-edit rows="2">${escapeHtml(c.content)}</textarea>
          </div>
          ${c.edited ? '<span class="text-[10px] text-slate-600 ml-1">(đã chỉnh sửa)</span>' : ''}
          <div class="flex items-center gap-3 mt-1 text-[10px] text-slate-500 pl-1 comment-actions" data-view>
            <button onclick="EduFeed.toggleCommentLike('${postId}','${c.id}')" class="hover:text-pink-400 ${liked ? 'text-pink-400 font-bold' : ''}">Thích${c.likeCount ? ` (${c.likeCount})` : ''}</button>
            <button onclick="EduFeed.toggleReplyBox('${c.id}')" class="hover:text-cyan-400">Phản hồi</button>
            ${canModerate ? `<button onclick="EduFeed.startEditComment('${postId}','${c.id}')" class="hover:text-amber-400">Sửa</button><button onclick="EduFeed.deleteComment('${postId}','${c.id}')" class="hover:text-rose-400">Xoá</button>` : ''}
            <span>${timeAgo(c.createdAt)}</span>
          </div>
          <div class="flex items-center gap-2 mt-1 hidden comment-actions" data-edit>
            <button onclick="EduFeed.saveEditComment('${postId}','${c.id}')" class="text-[10px] text-cyan-400 font-bold">Lưu</button>
            <button onclick="EduFeed.cancelEditComment('${c.id}')" class="text-[10px] text-slate-500">Huỷ</button>
          </div>
          <div id="reply-box-${c.id}" class="hidden mt-2 flex gap-2 items-center">
            <input class="input-field text-xs flex-1" placeholder="Viết phản hồi..." onkeydown="if(event.key==='Enter')EduFeed.submitComment('${postId}', this, '${c.id}')">
            <button type="button" class="qc-emoji-trigger text-slate-400 hover:text-amber-300 w-8 h-8 flex items-center justify-center flex-shrink-0" data-for-reply="${c.id}"><i class="fa-solid fa-face-smile"></i></button>
          </div>
        </div>
      </div>
      ${kids}
    </div>`;
  }

  function commentsBlockHtml(post) {
    const tree = buildCommentTree(post.comments || []);
    const roots = tree.root || [];
    return `
    <div class="comments-wrap mt-2" data-post-id="${post.id}">
      ${roots.map(c => commentHtml(c, tree, 0, post.id)).join('')}
      <div class="flex gap-2 mt-3 items-center">
        <input class="input-field text-xs flex-1" placeholder="Viết bình luận..." onkeydown="if(event.key==='Enter')EduFeed.submitComment('${post.id}', this)">
        <button type="button" class="qc-emoji-trigger text-slate-400 hover:text-amber-300 w-8 h-8 flex items-center justify-center flex-shrink-0" data-for-post="${post.id}"><i class="fa-solid fa-face-smile"></i></button>
      </div>
    </div>`;
  }

  function postCardHtml(post, opts) {
    const me = EduAPI.getUser();
    const imgs = (post.images && post.images.length ? post.images : (post.image ? [post.image] : [])).map(EduAPI.fileUrl);
    const isMine = post.author && post.author.id === me.id;
    const canModerate = isMine || me.role === 'admin';
    const liked = (post.likes || []).includes(me.id);
    const showAuthor = opts && opts.showAuthor !== false;
    return `
    <div class="glass-panel p-4 rounded-3xl mb-4" data-post-id="${post.id}">
      <div class="flex items-center gap-3 mb-2">
        ${showAuthor && post.author ? `<a href="profile.html?id=${post.author.id}">${avatarHtml(post.author, 9)}</a>` : ''}
        <div class="flex-1 min-w-0">
          ${showAuthor ? `<a href="profile.html?id=${post.author ? post.author.id : ''}" class="font-bold text-sm hover:underline flex items-center">${post.author ? escapeHtml(post.author.fullName || post.author.username) : 'Ẩn danh'}${EduLayout.verifiedBadge(post.author)}</a>` : ''}
          <p class="text-[10px] text-slate-500">${new Date(post.createdAt).toLocaleString('vi-VN')} · ${post.privacy === 'friends' ? '👥 Bạn bè' : post.privacy === 'private' ? '🔒 Chỉ mình tôi' : '🌐 Công khai'}${post.edited ? ' · đã chỉnh sửa' : ''}</p>
        </div>
        ${canModerate ? `
          <button onclick="EduFeed.startEditPost('${post.id}')" class="text-slate-400 hover:text-amber-400 text-xs inline-flex items-center justify-center" style="min-width:26px;min-height:26px" title="Sửa bài viết"><i class="fa-solid fa-pen"></i></button>
          <button onclick="EduFeed.deletePost('${post.id}')" class="ml-2 text-rose-400 hover:text-rose-300 text-xs inline-flex items-center justify-center" style="min-width:26px;min-height:26px" title="Xoá bài viết"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
      <p class="text-sm mb-2 whitespace-pre-wrap post-content" data-view>${escapeHtml(post.content)}</p>
      <div class="hidden mb-2" data-edit>
        <textarea class="input-field text-sm" rows="3">${escapeHtml(post.content)}</textarea>
        <div class="flex gap-2 mt-2">
          <button onclick="EduFeed.saveEditPost('${post.id}')" class="btn-primary text-xs px-3 py-1.5">Lưu</button>
          <button onclick="EduFeed.cancelEditPost('${post.id}')" class="text-xs px-3 py-1.5 rounded-xl bg-white/5">Huỷ</button>
        </div>
      </div>
      <div data-view>
        ${imagesGridHtml(imgs)}
        ${post.video ? EduVideo.renderVideoBlock(EduAPI.fileUrl(post.video), { extraClass: 'max-h-[520px]' }) : ''}
      </div>
      <div class="flex items-center gap-4 text-xs text-slate-400 border-t border-white/5 pt-2">
        <button onclick="EduFeed.toggleLike('${post.id}')" class="hover:text-pink-400 ${liked ? 'text-pink-400 font-bold' : ''}"><i class="fa-solid fa-heart mr-1"></i>${post.likeCount} Thích</button>
        <span><i class="fa-solid fa-comment mr-1"></i>${post.commentCount} Bình luận</span>
      </div>
      ${commentsBlockHtml(post)}
    </div>`;
  }

  // ---- Wiring: reload callback + emoji picker attach, called after every render ----
  let reloadFn = null;
  function setReloadCallback(fn) { reloadFn = fn; }
  function reload() { if (reloadFn) reloadFn(); }

  function wireEmojiButtons(root) {
    (root || document).querySelectorAll('.qc-emoji-trigger').forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      const target = btn.closest('div').querySelector('input, textarea');
      if (target) EduEmoji.attach(btn, target);
    });
  }

  function toggleReplyBox(commentId) {
    const box = document.getElementById(`reply-box-${commentId}`);
    if (!box) return;
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) { wireEmojiButtons(box.parentElement); box.querySelector('input').focus(); }
  }

  async function submitComment(postId, input, parentId) {
    const content = input.value.trim();
    if (!content) return;
    try {
      await EduAPI.request(`/api/posts/${postId}/comments`, { method: 'POST', body: { content, parentId: parentId || undefined } });
      input.value = '';
      reload();
    } catch (err) { EduAPI.toast(err.message, 'error'); }
  }

  function startEditComment(postId, commentId) {
    const wrap = document.querySelector(`[data-comment-id="${commentId}"]`);
    wrap.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
    wrap.querySelectorAll('[data-edit]').forEach(el => el.classList.remove('hidden'));
  }
  function cancelEditComment(commentId) {
    const wrap = document.querySelector(`[data-comment-id="${commentId}"]`);
    wrap.querySelectorAll('[data-view]').forEach(el => el.classList.remove('hidden'));
    wrap.querySelectorAll('[data-edit]').forEach(el => el.classList.add('hidden'));
  }
  async function saveEditComment(postId, commentId) {
    const wrap = document.querySelector(`[data-comment-id="${commentId}"]`);
    const content = wrap.querySelector('textarea[data-edit]').value.trim();
    if (!content) { EduAPI.toast('Bình luận không thể để trống.', 'error'); return; }
    try {
      await EduAPI.request(`/api/posts/${postId}/comments/${commentId}`, { method: 'PUT', body: { content } });
      reload();
    } catch (err) { EduAPI.toast(err.message, 'error'); }
  }
  async function deleteComment(postId, commentId) {
    if (!confirm('Xoá bình luận này?')) return;
    try {
      await EduAPI.request(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      reload();
    } catch (err) { EduAPI.toast(err.message, 'error'); }
  }
  async function toggleCommentLike(postId, commentId) {
    try { await EduAPI.request(`/api/posts/${postId}/comments/${commentId}/like`, { method: 'POST' }); reload(); }
    catch (err) { EduAPI.toast(err.message, 'error'); }
  }

  function startEditPost(postId) {
    const wrap = document.querySelector(`[data-post-id="${postId}"]`);
    wrap.querySelector(':scope > p.post-content').classList.add('hidden');
    wrap.querySelector(':scope > div[data-view]').classList.add('hidden');
    wrap.querySelector(':scope > div[data-edit]').classList.remove('hidden');
  }
  function cancelEditPost(postId) {
    const wrap = document.querySelector(`[data-post-id="${postId}"]`);
    wrap.querySelector(':scope > p.post-content').classList.remove('hidden');
    wrap.querySelector(':scope > div[data-view]').classList.remove('hidden');
    wrap.querySelector(':scope > div[data-edit]').classList.add('hidden');
  }
  async function saveEditPost(postId) {
    const wrap = document.querySelector(`[data-post-id="${postId}"]`);
    const content = wrap.querySelector('div[data-edit] textarea').value.trim();
    try {
      await EduAPI.request(`/api/posts/${postId}`, { method: 'PUT', body: { content } });
      reload();
      EduAPI.toast('Đã cập nhật bài viết.', 'success');
    } catch (err) { EduAPI.toast(err.message, 'error'); }
  }
  async function deletePost(postId) {
    if (!confirm('Xoá bài viết này?')) return;
    try { await EduAPI.request(`/api/posts/${postId}`, { method: 'DELETE' }); reload(); }
    catch (err) { EduAPI.toast(err.message, 'error'); }
  }
  async function toggleLike(postId) {
    try { await EduAPI.request(`/api/posts/${postId}/like`, { method: 'POST' }); reload(); }
    catch (err) { EduAPI.toast(err.message, 'error'); }
  }

  function renderList(container, posts, opts) {
    container.innerHTML = posts.map(p => postCardHtml(p, opts)).join('') || '<p class="text-slate-500 text-sm glass-panel p-4 rounded-3xl">Chưa có bài viết nào.</p>';
    EduVideo.observeAll(container);
    wireEmojiButtons(container);
  }

  return {
    renderList, setReloadCallback, reload,
    toggleReplyBox, submitComment, startEditComment, cancelEditComment, saveEditComment, deleteComment, toggleCommentLike,
    startEditPost, cancelEditPost, saveEditPost, deletePost, toggleLike,
    avatarHtml, imagesGridHtml, escapeHtml
  };
})();
