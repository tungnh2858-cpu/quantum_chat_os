/**
 * Quantum Chat OS - Shared top bar + sidebar (Facebook-style layout).
 * Included on every logged-in page. Add one entry to NAV and it shows up
 * everywhere (top bar center icons, left sidebar, mobile drawer).
 */
const EduLayout = (() => {
  const NAV = [
    { id: 'social', href: 'social.html', icon: 'fa-house', label: 'Bảng Tin', color: 'text-pink-400' },
    { id: 'reels', href: 'reels.html', icon: 'fa-clapperboard', label: 'Reels', color: 'text-fuchsia-400' },
    { id: 'groups', href: 'groups.html', icon: 'fa-people-group', label: 'Nhóm', color: 'text-emerald-400' },
    { id: 'accounts', href: 'admin.html', icon: 'fa-users-gear', label: 'Quản Lý Người Dùng', color: 'text-rose-500', adminOnly: true },
    { id: 'settings', href: 'settings.html', icon: 'fa-gear', label: 'Cài Đặt Tài Khoản', color: 'text-slate-400' }
  ];
  // Only these show as round icon buttons in the center of the top bar (Facebook does the same —
  // admin/settings live in the avatar menu, not the icon row).
  const TOPBAR_ICON_IDS = ['social', 'reels', 'groups'];

  let notifPollTimer = null;

  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase();
  }

  function applyTheme(user) {
    const theme = (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function allowedItems(user) {
    const allowedTools = user.security && Array.isArray(user.security.allowedTools) ? user.security.allowedTools : null;
    return NAV.filter(n => {
      if (n.adminOnly && user.role !== 'admin') return false;
      if (user.role !== 'admin' && allowedTools && n.id !== 'settings' && !allowedTools.includes(n.id)) return false;
      return true;
    });
  }

  function avatarBoxHtml(user, sizeClass) {
    return user.avatar
      ? `<img src="${EduAPI.fileUrl(user.avatar)}" class="${sizeClass} rounded-full object-cover">`
      : `<div class="avatar-initial ${sizeClass} text-xs">${initials(user.fullName || user.username)}</div>`;
  }

  /* ---------------------------- Top bar (Facebook-style) ---------------------------- */
  function renderTopbar(activeId) {
    const user = EduAPI.getUser();
    if (!user) return;
    if (document.getElementById('qc-topbar')) return; // already injected (e.g. re-render on theme toggle)

    const items = allowedItems(user);
    const iconItems = items.filter(n => TOPBAR_ICON_IDS.includes(n.id));

    const bar = document.createElement('div');
    bar.id = 'qc-topbar';
    bar.className = 'fixed top-0 left-0 right-0 z-[1200] glass-panel border-b border-white/5 shadow-xl';
    bar.style.height = '64px';
    bar.innerHTML = `
      <div class="h-full max-w-[1600px] mx-auto flex items-center justify-between gap-3 px-3 lg:px-6">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <button id="qc-hamburger" class="lg:hidden w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-bars"></i></button>
          <a href="social.html" class="flex items-center gap-2 flex-shrink-0">
            <img src="assets/img/quantum-chat-logo.svg" class="w-10 h-10 rounded-full bg-white/5 p-0.5">
            <span class="hidden md:inline text-sm font-black tracking-tight uppercase whitespace-nowrap">Quantum Chat <span class="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-amber-300">OS</span></span>
          </a>
          <div class="relative hidden sm:block ml-2 w-full max-w-[220px]">
            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500"></i>
            <input id="qc-search-input" class="w-full pl-8 pr-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs focus:outline-none focus:border-cyan-400/60" placeholder="Tìm kiếm trên Quantum Chat OS">
            <div id="qc-search-results" class="hidden absolute top-[110%] left-0 w-72 glass-panel rounded-2xl p-2 shadow-2xl max-h-80 overflow-y-auto"></div>
          </div>
        </div>

        <nav class="hidden lg:flex items-center gap-1">
          ${iconItems.map(n => `
            <a href="${n.href}" title="${n.label}" class="qc-topbar-icon w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all hover:bg-white/10 ${activeId === n.id ? 'bg-white/10 border-b-4 border-cyan-400 ' + n.color : 'text-slate-400'}">
              <i class="fa-solid ${n.icon}"></i>
            </a>`).join('')}
        </nav>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button onclick="EduLayout.toggleTheme()" id="theme-toggle-btn" class="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-amber-300" title="Chuyển giao diện Sáng/Tối">
            <i class="fa-solid ${user.theme === 'light' ? 'fa-sun' : 'fa-moon'}"></i>
          </button>
          <a href="social.html" id="qc-messenger-btn" class="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-cyan-300" title="Trò chuyện"><i class="fa-solid fa-message"></i></a>

          <div class="relative">
            <button id="qc-notif-btn" class="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-200" title="Thông báo">
              <i class="fa-solid fa-bell"></i>
              <span id="qc-notif-badge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">0</span>
            </button>
            <div id="qc-notif-dropdown" class="hidden absolute right-0 top-[120%] w-80 max-w-[85vw] glass-panel rounded-2xl shadow-2xl overflow-hidden z-[1300]">
              <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span class="font-black text-sm">Thông báo</span>
                <button onclick="EduLayout.markAllNotifsRead()" class="text-[11px] text-cyan-400 hover:underline">Đánh dấu đã đọc tất cả</button>
              </div>
              <div id="qc-notif-list" class="max-h-96 overflow-y-auto divide-y divide-white/5"></div>
              <a href="notifications.html" class="block text-center text-xs py-2.5 text-cyan-400 hover:bg-white/5 border-t border-white/10">Xem tất cả thông báo</a>
            </div>
          </div>

          <div class="relative">
            <button id="qc-avatar-btn" class="w-10 h-10 rounded-full overflow-hidden bg-white/5 hover:brightness-110 flex items-center justify-center">
              ${avatarBoxHtml(user, 'w-10 h-10')}
            </button>
            <div id="qc-avatar-dropdown" class="hidden absolute right-0 top-[120%] w-64 glass-panel rounded-2xl shadow-2xl overflow-hidden z-[1300]">
              <a href="profile.html?id=${user.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/10">
                ${avatarBoxHtml(user, 'w-10 h-10')}
                <div class="min-w-0"><p class="font-black text-sm truncate">${user.fullName || user.username}</p><p class="text-[10px] text-cyan-400 uppercase font-bold">${user.role}</p></div>
              </a>
              <div class="py-2">
                <a href="profile.html?id=${user.id}" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5"><i class="fa-solid fa-id-badge w-5 text-cyan-400"></i>Trang cá nhân</a>
                <a href="groups.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5"><i class="fa-solid fa-people-group w-5 text-emerald-400"></i>Nhóm của tôi</a>
                <a href="settings.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5"><i class="fa-solid fa-gear w-5 text-slate-400"></i>Cài đặt tài khoản</a>
                ${user.role === 'admin' ? `<a href="admin.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5"><i class="fa-solid fa-users-gear w-5 text-rose-500"></i>Quản lý người dùng</a>` : ''}
                <button onclick="EduLayout.toggleTheme()" class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 text-left"><i class="fa-solid fa-circle-half-stroke w-5 text-amber-300"></i>Chuyển giao diện Sáng/Tối</button>
              </div>
              <button onclick="EduLayout.logout()" class="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/10 border-t border-white/10 text-left"><i class="fa-solid fa-power-off w-5"></i>Đăng xuất</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.prepend(bar);

    // Push page content below the fixed bar.
    const shell = document.querySelector('body > div.flex.h-screen') || document.querySelector('body > div.h-screen');
    if (shell) {
      shell.style.marginTop = '64px';
      shell.style.height = 'calc(100vh - 64px)';
    }

    wireTopbarInteractions();
    loadNotifBadge();
    if (notifPollTimer) clearInterval(notifPollTimer);
    notifPollTimer = setInterval(loadNotifBadge, 20000);
  }

  function closeAllPopovers(except) {
    ['qc-notif-dropdown', 'qc-avatar-dropdown', 'qc-search-results'].forEach(id => {
      if (id === except) return;
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function wireTopbarInteractions() {
    const hamburger = document.getElementById('qc-hamburger');
    if (hamburger) hamburger.addEventListener('click', () => {
      const drawer = document.getElementById('mobile-drawer');
      if (drawer) drawer.classList.toggle('hidden');
    });

    const notifBtn = document.getElementById('qc-notif-btn');
    const notifDropdown = document.getElementById('qc-notif-dropdown');
    if (notifBtn) notifBtn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = notifDropdown.classList.contains('hidden');
      closeAllPopovers('qc-notif-dropdown');
      notifDropdown.classList.toggle('hidden');
      if (willOpen) loadNotifList();
    });

    const avatarBtn = document.getElementById('qc-avatar-btn');
    const avatarDropdown = document.getElementById('qc-avatar-dropdown');
    if (avatarBtn) avatarBtn.addEventListener('click', e => {
      e.stopPropagation();
      closeAllPopovers('qc-avatar-dropdown');
      avatarDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => closeAllPopovers());

    const searchInput = document.getElementById('qc-search-input');
    const searchResults = document.getElementById('qc-search-results');
    if (searchInput) {
      let debounce = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        const q = searchInput.value.trim().toLowerCase();
        if (!q) { searchResults.classList.add('hidden'); return; }
        debounce = setTimeout(async () => {
          try {
            const { users } = await EduAPI.request('/api/users/directory');
            const matches = users.filter(u => (u.fullName || u.username || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q)).slice(0, 8);
            searchResults.innerHTML = matches.map(u => `
              <a href="profile.html?id=${u.id}" class="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5">
                ${avatarBoxHtml(u, 'w-8 h-8')}<span class="text-xs font-bold truncate">${u.fullName || u.username}</span>
              </a>`).join('') || '<p class="text-xs text-slate-500 p-2">Không tìm thấy kết quả.</p>';
            searchResults.classList.remove('hidden');
          } catch { /* ignore search errors */ }
        }, 250);
      });
      searchInput.addEventListener('click', e => e.stopPropagation());
    }
  }

  async function loadNotifBadge() {
    try {
      const { count } = await EduAPI.request('/api/notifications/unread-count');
      const badge = document.getElementById('qc-notif-badge');
      if (!badge) return;
      if (count > 0) { badge.textContent = count > 99 ? '99+' : String(count); badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch { /* silent — user may have just logged out */ }
  }

  function timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'Vừa xong';
    if (s < 3600) return Math.floor(s / 60) + ' phút trước';
    if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
    return Math.floor(s / 86400) + ' ngày trước';
  }

  function notifIcon(type) {
    return {
      like: 'fa-heart text-pink-400', comment: 'fa-comment text-cyan-400',
      reel_like: 'fa-heart text-fuchsia-400', reel_comment: 'fa-comment text-fuchsia-400',
      group_join: 'fa-people-group text-emerald-400', group_post: 'fa-note-sticky text-emerald-400'
    }[type] || 'fa-bell text-amber-300';
  }

  async function loadNotifList() {
    const list = document.getElementById('qc-notif-list');
    if (!list) return;
    list.innerHTML = '<p class="text-xs text-slate-500 p-4 text-center">Đang tải...</p>';
    try {
      const { notifications } = await EduAPI.request('/api/notifications');
      list.innerHTML = notifications.map(n => `
        <a href="${n.link || '#'}" onclick="EduLayout.markNotifRead('${n.id}')" class="flex items-start gap-3 px-4 py-3 hover:bg-white/5 ${n.read ? 'opacity-60' : ''}">
          <i class="fa-solid ${notifIcon(n.type)} mt-1"></i>
          <div class="min-w-0"><p class="text-xs leading-snug">${n.message}</p><p class="text-[10px] text-slate-500 mt-1">${timeAgo(n.createdAt)}</p></div>
          ${!n.read ? '<span class="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0"></span>' : ''}
        </a>`).join('') || '<p class="text-xs text-slate-500 p-4 text-center">Chưa có thông báo nào.</p>';
    } catch { list.innerHTML = '<p class="text-xs text-rose-400 p-4 text-center">Không tải được thông báo.</p>'; }
  }

  async function markNotifRead(id) {
    try { await EduAPI.request(`/api/notifications/${id}/read`, { method: 'PUT' }); loadNotifBadge(); } catch { /* ignore */ }
  }
  async function markAllNotifsRead() {
    try { await EduAPI.request('/api/notifications/read-all', { method: 'PUT' }); loadNotifBadge(); loadNotifList(); } catch { /* ignore */ }
  }

  /* ---------------------------- Left sidebar (unchanged behaviour, kept as secondary nav) ---------------------------- */
  function render(activeId) {
    const user = EduAPI.getUser();
    if (!user) return;
    applyTheme(user);
    renderTopbar(activeId);

    const items = allowedItems(user).map(n => `
      <a href="${n.href}" class="tab-link ${activeId === n.id ? 'active-tab-style' : ''} w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-indigo-400 hover:text-white hover:bg-white/5 transition-all text-sm font-bold">
        <i class="fa-solid ${n.icon} text-lg w-6 ${n.color}"></i> ${n.label}
      </a>`).join('');

    const sidebarSlot = document.getElementById('sidebar-slot');
    if (sidebarSlot) {
      sidebarSlot.outerHTML = `
      <aside class="w-72 glass-panel border-r border-white/5 flex flex-col justify-between hidden lg:flex m-4 rounded-3xl overflow-hidden shadow-2xl transition-all" id="main-sidebar">
        <div>
          <div class="p-5 border-b border-white/5">
            <a href="profile.html?id=${user.id}" class="flex items-center gap-3 bg-white/5 p-3 rounded-2xl hover:bg-white/10">
              ${avatarBoxHtml(user, 'w-10 h-10')}
              <div class="min-w-0"><p class="truncate text-sm font-bold">${user.fullName || user.username}</p><p class="text-[10px] text-cyan-400 font-bold uppercase">${user.role}</p></div>
            </a>
          </div>
          <nav class="p-4 space-y-1 overflow-y-auto max-h-[65vh]">${items}</nav>
        </div>
        <div class="p-6 border-t border-white/5">
          <button onclick="EduLayout.logout()" class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold text-xs"><i class="fa-solid fa-power-off"></i> Đăng xuất</button>
        </div>
      </aside>`;
    }

    const mobileSlot = document.getElementById('mobile-nav-slot');
    if (mobileSlot) {
      mobileSlot.innerHTML = `<div class="p-4 space-y-1">${items}</div>`;
    }
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
    if (opts.staffOnly && !['admin', 'teacher'].includes(user.role)) {
      EduAPI.toast('Yêu cầu quyền Giáo viên/Admin.', 'error');
      window.location.href = 'index.html';
      return false;
    }
    render(activeId);
    return true;
  }

  return { render, guard, logout, toggleTheme, applyTheme, markNotifRead, markAllNotifsRead, NAV };
})();

// Apply saved theme immediately (before sidebar renders) to avoid a flash of the wrong theme.
(function () {
  const user = (() => { try { return JSON.parse(localStorage.getItem('edu_user') || 'null'); } catch { return null; } })();
  document.documentElement.setAttribute('data-theme', (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark');
})();
