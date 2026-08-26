/**
 * Quantum Chat OS - Shared frontend API client.
 * Included by every page. Handles: base URL detection, JWT storage,
 * authenticated fetch helper, current-user cache, and a WebSocket helper for chat.
 */
const EduAPI = (() => {
  // Works whether the frontend is served by the backend itself (same origin)
  // or hosted separately (edit API_BASE below to point at your backend URL).
  // IMPORTANT: this page must be opened via http(s)://, never by double-clicking
  // the .html file (file:// has no valid origin, so API/storage calls fail).
  const API_BASE = window.QUANTUMCHAT_API_BASE || (location.protocol === 'file:' ? 'http://localhost:4000' : location.origin);

  if (location.protocol === 'file:') {
    console.warn('[Quantum Chat OS] Trang đang mở bằng file:// — hãy chạy backend (npm start) rồi mở http://localhost:4000 thay vì mở trực tiếp file HTML.');
  }

  function getToken() { return localStorage.getItem('edu_token') || ''; }
  function setToken(t) { localStorage.setItem('edu_token', t); }
  function clearToken() { localStorage.removeItem('edu_token'); localStorage.removeItem('edu_user'); }
  function getUser() { try { return JSON.parse(localStorage.getItem('edu_user') || 'null'); } catch { return null; } }
  function setUser(u) { localStorage.setItem('edu_user', JSON.stringify(u)); }

  async function request(pathname, { method = 'GET', body, isForm = false, auth = true } = {}) {
    const headers = {};
    if (!isForm) headers['Content-Type'] = 'application/json';
    if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;

    const resp = await fetch(`${API_BASE}${pathname}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });

    let data = null;
    try { data = await resp.json(); } catch { /* no body */ }

    if (!resp.ok) {
      if (resp.status === 401) { clearToken(); }
      throw new Error((data && data.error) || `Lỗi HTTP ${resp.status}`);
    }
    return data;
  }

  function requireLogin(redirectTo = 'index.html') {
    if (!getToken() || !getUser()) {
      window.location.href = redirectTo;
      return false;
    }
    return true;
  }

  function openChatSocket(onMessage) {
    const wsBase = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsBase}/ws?token=${encodeURIComponent(getToken())}`);
    ws.onmessage = ev => {
      try { onMessage(JSON.parse(ev.data)); } catch {}
    };
    return ws;
  }

  function fileUrl(p) {
    if (!p) return '';
    return p.startsWith('http') ? p : `${API_BASE}${p}`;
  }

  function toast(message, type = 'info') {
    let box = document.getElementById('toast-notif-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-notif-box';
      box.className = 'fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none';
      document.body.appendChild(box);
    }
    const colors = { info: 'bg-indigo-500', error: 'bg-rose-500', success: 'bg-emerald-500' };
    const el = document.createElement('div');
    el.className = `${colors[type] || colors.info} text-white text-sm font-bold px-4 py-3 rounded-xl shadow-2xl pointer-events-auto animate-[fadeIn_.2s_ease]`;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Adds a "show/hide" eye icon to a password <input>. Call once per field,
  // e.g. EduAPI.enablePasswordToggle('login-password').
  function enablePasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.pwToggleReady) return;
    input.dataset.pwToggleReady = '1';
    const wrapper = document.createElement('div');
    wrapper.className = 'pw-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
    btn.setAttribute('aria-label', 'Hiện/ẩn mật khẩu');
    wrapper.appendChild(btn);
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  }

  // Replaces the ugly native "Choose File" button with a cyberpunk-styled one.
  // Call once per file input, e.g. EduAPI.enableFancyFileInput('s-logo', 'Chọn Ảnh Logo').
  function enableFancyFileInput(inputId, label = 'Chọn Tệp') {
    const input = document.getElementById(inputId);
    if (!input || input.dataset.fancyReady) return;
    input.dataset.fancyReady = '1';
    const wrapper = document.createElement('div');
    wrapper.className = 'file-field-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'file-field-btn';
    btn.innerHTML = `<i class="fa-solid fa-upload"></i> ${label}`;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-field-name';
    nameSpan.textContent = 'Chưa chọn tệp nào';
    wrapper.appendChild(btn);
    wrapper.appendChild(nameSpan);
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      nameSpan.textContent = input.files[0] ? input.files[0].name : 'Chưa chọn tệp nào';
    });
  }

  // Applies the cyberpunk custom-arrow style class to a <select> (needed when it
  // wasn't already created with class="input-field").
  function styleSelect(selectId) {
    const el = document.getElementById(selectId);
    if (el) el.classList.add('select-field');
  }

  return { API_BASE, getToken, setToken, clearToken, getUser, setUser, request, requireLogin, openChatSocket, fileUrl, toast, enablePasswordToggle, enableFancyFileInput, styleSelect };
})();

// Register service worker (enables "Add to Home Screen" / desktop install)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
