/**
 * Quantum Chat OS - Shared sidebar/topbar/bottom-nav/notifications.
 * Keeps navigation consistent & easy to upgrade (add one entry here and it appears everywhere).
 */
const EduLayout = (() => {
  const NAV = [
    { id: 'social', href: 'social.html', icon: 'fa-house', label: 'Bảng Tin', color: 'text-pink-400' },
    { id: 'reels', href: 'reels.html', icon: 'fa-clapperboard', label: 'Reels', color: 'text-fuchsia-400' },
    { id: 'friends', href: 'friends.html', icon: 'fa-user-group', label: 'Bạn Bè', color: 'text-cyan-400' },
    { id: 'messages', href: 'messages.html', icon: 'fa-comment-dots', label: 'Tin Nhắn', color: 'text-sky-400' },
    { id: 'accounts', href: 'admin.html', icon: 'fa-users-gear', label: 'Quản Lý Người Dùng', color: 'text-rose-500', adminOnly: true },
    { id: 'settings', href: 'settings.html', icon: 'fa-gear', label: 'Cài Đặt Tài Khoản', color: 'text-slate-400' }
  ];

  // Bottom mobile nav = a curated subset of NAV, Facebook-style (Home / Reels / Friends / Notifications / More).
  const BOTTOM_NAV = [
    { id: 'social', href: 'social.html', icon: 'fa-house' },
    { id: 'reels', href: 'reels.html', icon: 'fa-clapperboard' },
    { id: 'messages', href: 'messages.html', icon: 'fa-comment-dots' },
    { id: 'notifications', icon: 'fa-bell', action: 'toggleNotifPanel' },
    { id: 'more', icon: 'fa-bars', action: 'toggleMoreSheet' }
  ];

  let notifPollTimer = null;

  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase();
  }

  function verifiedBadge(user) {
    return user && user.verified ? '<i class="fa-solid fa-circle-check text-sky-400 text-xs ml-1" title="Đã xác minh"></i>' : '';
  }

  function applyTheme(user) {
    const theme = (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function avatarHtml(user, size) {
    return user.avatar
      ? `<img src="${EduAPI.fileUrl(user.avatar)}" class="w-${size} h-${size} rounded-full object-cover">`
      : `<img src="assets/img/default-avatar.svg" class="w-${size} h-${size} rounded-full object-cover">`;
  }

  function render(activeId) {
    const user = EduAPI.getUser();
    if (!user) return;
    applyTheme(user);
    const allowedTools = user.security && Array.isArray(user.security.allowedTools) ? user.security.allowedTools : null;
    const items = NAV.filter(n => {
      if (n.adminOnly && user.role !== 'admin') return false;
      if (user.role !== 'admin' && allowedTools && n.id !== 'settings' && !allowedTools.includes(n.id)) return false;
      return true;
    }).map(n => `
      <a href="${n.href}" class="tab-link ${activeId === n.id ? 'active-tab-style' : ''} w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-indigo-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold">
        <i class="fa-solid ${n.icon} text-lg w-6 ${n.color}"></i> ${n.label}
      </a>`).join('');

    const sidebarSlot = document.getElementById('sidebar-slot');
    if (sidebarSlot) {
      sidebarSlot.outerHTML = `
      <aside class="w-80 glass-panel border-r border-white/5 flex flex-col justify-between hidden lg:flex m-4 rounded-3xl overflow-hidden shadow-2xl transition-all" id="main-sidebar">
        <div>
          <div class="p-6 border-b border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="assets/img/quantum-chat-logo.svg" class="w-9 h-9 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]">
              <div class="flex flex-col">
                <span class="text-sm font-black text-slate-100 tracking-tight uppercase">Quantum Chat OS</span>
                <span class="text-[9px] text-cyan-400 font-bold tracking-widest uppercase block mt-0.5">${user.role}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <a href="messages.html" id="msg-bell-btn" class="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-sky-300" title="Tin nhắn">
                <i class="fa-solid fa-comment-dots"></i>
                <span id="msg-badge" class="hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">0</span>
              </a>
              <button onclick="EduLayout.toggleNotifPanel()" id="notif-bell-btn" class="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-cyan-300" title="Thông báo">
                <i class="fa-solid fa-bell"></i>
                <span id="notif-badge" class="hidden absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">0</span>
              </button>
              <button onclick="EduLayout.toggleMoreSheet()" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-fuchsia-300" title="Xem thêm">
                <i class="fa-solid fa-grip"></i>
              </button>
              <button onclick="EduLayout.toggleTheme()" id="theme-toggle-btn" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-amber-300" title="Chuyển giao diện Sáng/Tối">
                <i class="fa-solid ${user.theme === 'light' ? 'fa-sun' : 'fa-moon'}"></i>
              </button>
            </div>
          </div>
          <nav class="p-4 space-y-1 overflow-y-auto max-h-[70vh]">${items}</nav>
        </div>
        <div class="p-6 border-t border-white/5 space-y-4">
          <a href="profile.html?id=${user.id}" class="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-xl">
            ${avatarHtml(user, 9)}
            <span class="truncate flex-1 text-xs font-bold text-slate-300 flex items-center">${user.fullName || user.username}${verifiedBadge(user)}</span>
            <button onclick="event.preventDefault();EduLayout.logout()" class="text-rose-400 hover:text-rose-300" title="Đăng xuất"><i class="fa-solid fa-power-off"></i></button>
          </a>
        </div>
      </aside>`;
    }

    const mobileSlot = document.getElementById('mobile-nav-slot');
    if (mobileSlot) mobileSlot.innerHTML = `<div class="p-4 space-y-1">${items}</div>`;

    injectBottomNav(activeId, user);
    injectMoreSheet(user);
    injectNotifPanel();
    refreshNotifications();
    refreshMessageBadge();
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = setInterval(() => { refreshNotifications(); refreshMessageBadge(); }, 30000);
  }

  function injectBottomNav(activeId, user) {
    if (document.getElementById('bottom-nav-bar')) { updateBottomNavActive(activeId); return; }
    const html = `
    <nav id="bottom-nav-bar" class="lg:hidden fixed bottom-0 inset-x-0 z-[1400] bg-[#121018]/95 backdrop-blur border-t border-white/10 flex items-stretch" style="padding-bottom:env(safe-area-inset-bottom)">
      ${BOTTOM_NAV.map(n => `
        <${n.href ? 'a href="' + n.href + '"' : 'button onclick="EduLayout.' + n.action + '()"'} data-nav-id="${n.id}"
          class="flex-1 flex flex-col items-center justify-center py-2.5 relative ${activeId === n.id ? 'text-cyan-400' : 'text-slate-400'}">
          <i class="fa-solid ${n.icon} text-xl"></i>
          ${n.id === 'notifications' ? '<span id="bottom-notif-badge" class="hidden absolute top-1 right-[28%] min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">0</span>' : ''}
          ${n.id === 'messages' ? '<span id="bottom-msg-badge" class="hidden absolute top-1 right-[28%] min-w-[15px] h-[15px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">0</span>' : ''}
          ${activeId === n.id ? '<span class="absolute bottom-0 w-8 h-0.5 bg-cyan-400 rounded-full"></span>' : ''}
        </${n.href ? 'a' : 'button'}>`).join('')}
    </nav>
    <div class="lg:hidden" style="height:64px"></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function updateBottomNavActive(activeId) {
    document.querySelectorAll('#bottom-nav-bar [data-nav-id]').forEach(el => {
      const isActive = el.dataset.navId === activeId;
      el.classList.toggle('text-cyan-400', isActive);
      el.classList.toggle('text-slate-400', !isActive);
    });
  }

  function injectMoreSheet(user) {
    if (document.getElementById('more-sheet-backdrop')) return;
    const entries = [
      { icon: 'fa-id-badge', bg: 'from-indigo-500 to-purple-500', label: 'Trang cá nhân', href: `profile.html?id=${user.id}` },
      { icon: 'fa-user-group', bg: 'from-cyan-500 to-blue-500', label: 'Bạn bè', href: 'friends.html' },
      { icon: 'fa-comment-dots', bg: 'from-sky-500 to-cyan-500', label: 'Tin nhắn', href: 'messages.html' },
      { icon: 'fa-clapperboard', bg: 'from-fuchsia-500 to-pink-500', label: 'Reels', href: 'reels.html' },
      { icon: 'fa-bell', bg: 'from-amber-500 to-orange-500', label: 'Thông báo', action: 'toggleNotifPanel' },
      user.role === 'admin' ? { icon: 'fa-users-gear', bg: 'from-rose-500 to-red-500', label: 'Quản lý người dùng', href: 'admin.html' } : null,
      { icon: 'fa-gear', bg: 'from-slate-500 to-slate-600', label: 'Cài đặt tài khoản', href: 'settings.html' },
      { icon: 'fa-power-off', bg: 'from-rose-600 to-rose-700', label: 'Đăng xuất', action: 'logout' }
    ].filter(Boolean);
    const html = `
    <div id="more-sheet-backdrop" class="fixed inset-0 bg-black/70 z-[1600] hidden" onclick="EduLayout.toggleMoreSheet()"></div>
    <div id="more-sheet" class="fixed left-0 right-0 bottom-0 lg:left-auto lg:right-6 lg:bottom-auto lg:top-20 lg:w-80 z-[1700] glass-panel rounded-t-3xl lg:rounded-3xl p-3 hidden translate-y-full lg:translate-y-0 transition-transform">
      <div class="lg:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mb-2"></div>
      ${entries.map(e => `
        <${e.href ? 'a href="' + e.href + '"' : 'button onclick="EduLayout.' + e.action + '()"'} class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 text-left">
          <span class="w-9 h-9 rounded-full bg-gradient-to-br ${e.bg} flex items-center justify-center text-white text-sm"><i class="fa-solid ${e.icon}"></i></span>
          <span class="text-sm font-bold text-slate-100">${e.label}</span>
        </${e.href ? 'a' : 'button'}>`).join('')}
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function toggleMoreSheet() {
    const backdrop = document.getElementById('more-sheet-backdrop');
    const sheet = document.getElementById('more-sheet');
    const opening = sheet.classList.contains('hidden');
    if (opening) {
      backdrop.classList.remove('hidden');
      sheet.classList.remove('hidden');
      requestAnimationFrame(() => sheet.classList.remove('translate-y-full'));
    } else {
      sheet.classList.add('translate-y-full');
      backdrop.classList.add('hidden');
      setTimeout(() => sheet.classList.add('hidden'), 200);
    }
  }

  function injectNotifPanel() {
    if (document.getElementById('notif-panel-backdrop')) return;
    const html = `
    <div id="notif-panel-backdrop" class="fixed inset-0 z-[1600] hidden" onclick="EduLayout.toggleNotifPanel()"></div>
    <div id="notif-panel" class="fixed right-3 left-3 sm:left-auto sm:w-96 top-20 lg:top-6 lg:right-96 z-[1700] glass-panel rounded-3xl p-4 hidden max-h-[70vh] overflow-y-auto shadow-2xl">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-black text-sm"><i class="fa-solid fa-bell text-cyan-400 mr-2"></i>Thông báo</h3>
        <button onclick="EduLayout.markAllNotifsRead()" class="text-[11px] text-cyan-400 hover:underline">Đánh dấu đã đọc</button>
      </div>
      <div id="notif-list" class="space-y-1"><p class="text-xs text-slate-500 text-center py-6">Đang tải...</p></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function toggleNotifPanel() {
    const backdrop = document.getElementById('notif-panel-backdrop');
    const panel = document.getElementById('notif-panel');
    const opening = panel.classList.contains('hidden');
    backdrop.classList.toggle('hidden', !opening);
    panel.classList.toggle('hidden', !opening);
    if (opening) refreshNotifications(true);
  }

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  }

  async function refreshMessageBadge() {
    try {
      const { conversations } = await EduAPI.request('/api/messages');
      const total = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      [document.getElementById('msg-badge'), document.getElementById('bottom-msg-badge')].forEach(b => {
        if (!b) return;
        b.textContent = total > 9 ? '9+' : total;
        b.classList.toggle('hidden', total === 0);
      });
    } catch { /* silent */ }
  }

  async function refreshNotifications(renderList) {
    try {
      const { notifications, unread } = await EduAPI.request('/api/notifications');
      const badges = [document.getElementById('notif-badge'), document.getElementById('bottom-notif-badge')];
      badges.forEach(b => { if (!b) return; b.textContent = unread > 9 ? '9+' : unread; b.classList.toggle('hidden', unread === 0); });
      const list = document.getElementById('notif-list');
      if (renderList && list) {
        list.innerHTML = notifications.length ? notifications.map(n => `
          <button onclick="EduLayout.markNotifRead('${n.id}')" class="w-full flex items-start gap-3 p-3 rounded-2xl hover:bg-white/5 text-left ${n.read ? 'opacity-60' : ''}">
            <div class="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
              ${n.actor && n.actor.avatar ? `<img src="${EduAPI.fileUrl(n.actor.avatar)}" class="w-full h-full object-cover">` : `<i class="fa-solid ${n.type === 'birthday' ? 'fa-cake-candles text-amber-300' : 'fa-user text-slate-400'}"></i>`}
            </div>
            <div class="flex-1">
              <p class="text-xs text-slate-200 leading-snug">${n.text}</p>
              <p class="text-[10px] text-slate-500 mt-0.5">${timeAgo(n.createdAt)}</p>
            </div>
            ${!n.read ? '<span class="w-2 h-2 rounded-full bg-cyan-400 mt-1.5"></span>' : ''}
          </button>`).join('') : '<p class="text-xs text-slate-500 text-center py-6">Chưa có thông báo nào.</p>';
      }
    } catch { /* silent — notifications are non-critical */ }
  }
  async function markNotifRead(id) {
    try { await EduAPI.request(`/api/notifications/${id}/read`, { method: 'POST' }); refreshNotifications(true); } catch {}
  }
  async function markAllNotifsRead() {
    try { await EduAPI.request('/api/notifications/read-all', { method: 'POST' }); refreshNotifications(true); } catch {}
  }

  function logout() {
    EduAPI.clearToken();
    window.location.href = 'index.html';
  }

  async function toggleTheme() {
    const user = EduAPI.getUser();
    const next = (user && user.theme) === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    if (user) {
      user.theme = next;
      EduAPI.setUser(user);
      try {
        const { user: updated } = await EduAPI.request('/api/users/me/preferences', { method: 'PUT', body: { theme: next } });
        EduAPI.setUser(updated);
      } catch { /* keep local theme even if the save fails */ }
    } else {
      localStorage.setItem('edu_theme_guest', next);
    }
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = `<i class="fa-solid ${next === 'light' ? 'fa-sun' : 'fa-moon'}"></i>`;
  }

  function guard(activeId, opts = {}) {
    if (!EduAPI.requireLogin()) return false;
    const user = EduAPI.getUser();
    if (opts.adminOnly && user.role !== 'admin') {
      EduAPI.toast('Yêu cầu quyền Admin.', 'error');
      window.location.href = 'index.html';
      return false;
    }
    render(activeId);
    return true;
  }

  return {
    render, guard, logout, toggleTheme, applyTheme, NAV,
    toggleMoreSheet, toggleNotifPanel, refreshNotifications, markNotifRead, markAllNotifsRead, refreshMessageBadge,
    initials, avatarHtml, verifiedBadge, timeAgo
  };
})();

// Apply saved theme immediately (before sidebar renders) to avoid a flash of the wrong theme.
(function () {
  const user = (() => { try { return JSON.parse(localStorage.getItem('edu_user') || 'null'); } catch { return null; } })();
  document.documentElement.setAttribute('data-theme', (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark');
})();
