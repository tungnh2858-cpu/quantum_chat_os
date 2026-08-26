/**
 * Quantum Chat OS - Shared sidebar/topbar. Keeps navigation consistent & easy to upgrade
 * (add one entry here and it appears on every page).
 */
const EduLayout = (() => {
  const NAV = [
    { id: 'social', href: 'social.html', icon: 'fa-house', label: 'Bảng Tin', color: 'text-pink-400' },
    { id: 'accounts', href: 'admin.html', icon: 'fa-users-gear', label: 'Quản Lý Người Dùng', color: 'text-rose-500', adminOnly: true },
    { id: 'settings', href: 'settings.html', icon: 'fa-gear', label: 'Cài Đặt Tài Khoản', color: 'text-slate-400' }
  ];

  function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase();
  }

  function applyTheme(user) {
    const theme = (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }

  function render(activeId) {
    const user = EduAPI.getUser();
    if (!user) return;
    applyTheme(user);
    const allowedTools = user.security && Array.isArray(user.security.allowedTools) ? user.security.allowedTools : null;
    const items = NAV.filter(n => {
      if (n.adminOnly && user.role !== 'admin') return false;
      // Per-account tool restriction set by Admin (settings always visible).
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
            <button onclick="EduLayout.toggleTheme()" id="theme-toggle-btn" class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-amber-300" title="Chuyển giao diện Sáng/Tối">
              <i class="fa-solid ${user.theme === 'light' ? 'fa-sun' : 'fa-moon'}"></i>
            </button>
          </div>
          <nav class="p-4 space-y-1 overflow-y-auto max-h-[70vh]">${items}</nav>
        </div>
        <div class="p-6 border-t border-white/5 space-y-4">
          <div class="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
            <div class="avatar-initial w-9 h-9 text-xs overflow-hidden">${user.avatar ? `<img src="${EduAPI.fileUrl(user.avatar)}" class="w-full h-full object-cover">` : initials(user.fullName || user.username)}</div>
            <span class="truncate flex-1 text-xs font-bold text-slate-300">${user.fullName || user.username}</span>
            <button onclick="EduLayout.logout()" class="text-rose-400 hover:text-rose-300" title="Đăng xuất"><i class="fa-solid fa-power-off"></i></button>
          </div>
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

  return { render, guard, logout, toggleTheme, applyTheme, NAV };
})();

// Apply saved theme immediately (before sidebar renders) to avoid a flash of the wrong theme.
(function () {
  const user = (() => { try { return JSON.parse(localStorage.getItem('edu_user') || 'null'); } catch { return null; } })();
  document.documentElement.setAttribute('data-theme', (user && user.theme) || localStorage.getItem('edu_theme_guest') || 'dark');
})();
