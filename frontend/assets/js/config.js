/**
 * EduPulse - Frontend config.
 *
 * Nếu bạn host frontend riêng (VD: GitHub Pages, Netlify, Vercel...) tách biệt
 * khỏi backend, hãy điền địa chỉ backend đã deploy (Render/Railway/VPS...) vào đây.
 * Để trống ('') nếu frontend và backend chạy CHUNG một server (node server.js
 * đã tự phục vụ cả 2 — trường hợp này không cần sửa gì).
 *
 * QUAN TRỌNG: GitHub Pages KHÔNG chạy được Node.js/Express — nó chỉ phục vụ
 * file tĩnh. Vì vậy khi push code này lên GitHub Pages, bạn PHẢI deploy
 * thư mục backend/ lên một nơi chạy được Node.js (Render, Railway, Fly.io,
 * VPS riêng...) rồi dán URL đó vào bên dưới. Nếu không, mọi lời gọi API
 * (đăng nhập, tạo lớp, chat...) sẽ báo lỗi 404/405/"Failed to fetch".
 *
 * Ví dụ: window.EDUPULSE_API_BASE = 'https://edupulse-backend.onrender.com';
 */
window.EDUPULSE_API_BASE = '';
