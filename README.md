# EduPulse Quantum OS

## 🔧 Bạn đang gặp lỗi HTTP 405 trên GitHub Pages?

Nếu trang đăng nhập của bạn hiện dòng **"Backend API: https://\<ten-cua-ban\>.github.io"** ở dưới nút Đăng Nhập và báo lỗi **405**, nguyên nhân là: bạn mới chỉ deploy **frontend** lên GitHub Pages, còn **backend chưa được deploy ở đâu cả** nên trang tự lấy nhầm chính GitHub Pages làm địa chỉ API — mà GitHub Pages không chạy được backend.

**Cách sửa nhanh nhất (1 lần, ~2 phút):**

1. Bấm nút deploy backend lên [Render](https://render.com) (miễn phí, tự đọc file `render.yaml` có sẵn trong repo):

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tungnh2858-cpu/edupulse_quantum_os)

   *(Nếu nút trên không đúng repo của bạn, vào [render.com](https://render.com) → New + → Blueprint → chọn repo GitHub của bạn, Render sẽ tự đọc `render.yaml`.)*
2. Chờ Render build xong, bạn sẽ có 1 URL dạng: `https://edupulse-backend-xxxx.onrender.com`
3. Mở file `frontend/assets/js/config.js` trong repo, sửa dòng cuối:
   ```js
   window.EDUPULSE_API_BASE = 'https://edupulse-backend-xxxx.onrender.com';
   ```
4. Commit & push lại — workflow `deploy-pages.yml` sẽ tự động build lại GitHub Pages trong ~1 phút.
5. Tải lại trang GitHub Pages — dòng "Backend API" ở dưới nút đăng nhập giờ sẽ hiện đúng URL Render, và đăng nhập sẽ hoạt động.

> Lưu ý: gói free của Render sẽ "ngủ" sau ~15 phút không có request — lần đầu gọi API sau khi ngủ có thể mất 30-50 giây để backend khởi động lại, đây là bình thường, không phải lỗi.

---

Hệ thống quản trị giáo dục tích hợp AI — backend + frontend đầy đủ, kết nối trực tiếp với nhau, đóng gói sẵn để chạy trên máy tính và điện thoại (PWA - có thể "Cài đặt vào màn hình chính").

## Tính năng chính

- **Quản lý tài khoản (Admin):** tạo tài khoản, nâng cấp/hạ cấp vai trò (student/teacher/admin), khoá/mở khoá, đặt lại mật khẩu, xoá tài khoản.
- **Trường & Lớp học:** tạo trường có logo, tạo lớp học, gán học sinh vào lớp.
- **Điểm danh học vụ:** điểm danh theo lớp/ngày, trạng thái Có mặt/Đi trễ/Có phép/Vắng.
- **AI IDE & Lập trình:** trình soạn thảo Monaco, chạy code trực tiếp với hơn 30 ngôn ngữ lập trình (JavaScript, Python, Java, C, C++, C#, Go, PHP, Ruby, Rust, TypeScript, Kotlin, Swift, Dart, Bash...) thông qua Piston API, kèm gợi ý phân tích nhanh.
- **Học Tiếng Anh:** bài học từ vựng theo trình độ, chế độ flashcard lật thẻ.
- **Mạng xã hội nội bộ:** đăng bài kèm ảnh, thích, bình luận, trò chuyện thời gian thực (WebSocket) giống Messenger.
- **Dự án & Website:** tạo dự án HTML/CSS/JS, công khai thành trang web thật với đường dẫn `/p/ten-du-an` (khi triển khai qua HTTPS, đây chính là trang web công khai của dự án).
- **Cửa hàng tiện ích mở rộng:** cài đặt/gỡ các tiện ích bổ sung cho tài khoản.
- **Cài đặt tài khoản:** hồ sơ cá nhân, ảnh đại diện, đổi mật khẩu, giao diện sáng/tối, tuỳ chọn thông báo.
- **Đa nền tảng:** giao diện responsive, cài đặt được như ứng dụng (PWA) trên cả máy tính và điện thoại.

## Cấu trúc thư mục

```
edupulse/
├── backend/            # API server (Node.js + Express, JSON file DB - không cần cài đặt native)
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   ├── middleware/
│   ├── data/            # db.json được tự tạo khi chạy lần đầu
│   └── uploads/          # avatar, logo, ảnh bài đăng
└── frontend/            # Giao diện web tĩnh (HTML + Tailwind), gọi API qua fetch/WebSocket
    ├── index.html         # Đăng nhập + Bảng điều khiển
    ├── admin.html          # Quản lý tài khoản
    ├── academic.html       # Trường & Lớp học
    ├── attendance.html     # Điểm danh
    ├── ide.html            # AI IDE
    ├── english.html        # Học tiếng Anh
    ├── social.html         # Mạng xã hội + chat
    ├── projects.html       # Dự án & Website
    ├── store.html          # Cửa hàng tiện ích
    ├── settings.html       # Cài đặt tài khoản
    ├── manifest.json / sw.js  # Hỗ trợ cài đặt PWA
    └── assets/
```

## Đưa dự án lên GitHub

```bash
cd edupulse
git init
git add .
git commit -m "Initial commit - EduPulse Quantum OS"
git branch -M main
git remote add origin https://github.com/<ten-cua-ban>/<ten-repo>.git
git push -u origin main
```

Repo đã có sẵn 2 workflow GitHub Actions trong `.github/workflows/`:

- **`backend-ci.yml`** — mỗi lần push/PR đụng tới `backend/`, tự động `npm install`, kiểm tra cú pháp toàn bộ route, và khởi động thử server để chắc chắn không lỗi trước khi merge.
- **`deploy-pages.yml`** — mỗi lần push vào nhánh `main` (đụng tới `frontend/`), tự động deploy thư mục `frontend/` lên **GitHub Pages**. Để bật:
  1. Vào repo trên GitHub → **Settings → Pages** → mục "Build and deployment" chọn **Source: GitHub Actions**.
  2. Push code lên `main`, workflow sẽ tự chạy và cho bạn 1 link dạng `https://<ten-cua-ban>.github.io/<ten-repo>/`.
  3. **Trước khi push**, nhớ deploy `backend/` (xem mục bên dưới) và điền URL backend vào `frontend/assets/js/config.js` — nếu không các trang trên GitHub Pages sẽ không gọi được API.

> `package-lock.json` trong `backend/` được commit sẵn để CI cài đặt phụ thuộc nhanh và ổn định — không xoá file này.

## Cài đặt & chạy

Yêu cầu: **Node.js >= 18** (đã có `fetch` sẵn, không cần cài thêm).

```bash
cd backend
npm install
cp .env.example .env     # chỉnh sửa JWT_SECRET, PORT nếu cần
npm start
```

Server sẽ chạy tại `http://localhost:4000` và **tự động phục vụ luôn cả frontend** (mở thẳng `http://localhost:4000` trên trình duyệt máy tính hoặc điện thoại trong cùng mạng LAN là dùng được ngay — không cần cấu hình gì thêm).

> ⚠️ **Không mở file `index.html` bằng cách double-click / kéo vào trình duyệt.** Khi mở kiểu `file://`, trình duyệt chặn toàn bộ API, `localStorage` và `manifest.json` (lỗi "Failed to fetch", CORS "origin null"...). Luôn chạy `npm start` rồi truy cập qua `http://localhost:4000`.

### Deploy frontend lên GitHub Pages / Netlify / Vercel (tách riêng backend)

**GitHub Pages KHÔNG chạy được Node.js** — nó chỉ phục vụ file tĩnh (HTML/CSS/JS). Nếu bạn push cả repo này lên và bật GitHub Pages, mọi lời gọi API sẽ báo lỗi **405/404/"Failed to fetch"** vì không có backend nào đang chạy phía sau. Cách làm đúng:

1. **Deploy `backend/`** lên một nơi chạy được Node.js: [Render](https://render.com), [Railway](https://railway.app), [Fly.io](https://fly.io), hoặc VPS riêng. Nhớ đặt biến môi trường `JWT_SECRET`, `PORT` trong phần cấu hình của dịch vụ (dựa theo `.env.example`).
2. Sau khi deploy xong, bạn sẽ có 1 URL backend, ví dụ `https://edupulse-backend.onrender.com`.
3. Mở file `frontend/assets/js/config.js` và sửa:
   ```js
   window.EDUPULSE_API_BASE = 'https://edupulse-backend.onrender.com';
   ```
4. Push riêng thư mục `frontend/` lên GitHub Pages/Netlify/Vercel như bình thường — mọi trang sẽ tự gọi API tới backend đã deploy ở bước 1.
5. Trong `backend/.env`, đặt `CORS_ORIGIN` bằng đúng domain frontend của bạn (VD: `https://your-username.github.io`) để backend chấp nhận request từ đó.

Nếu frontend và backend chạy **chung 1 server** (cách mặc định ở mục cài đặt phía trên), để nguyên `config.js` với giá trị rỗng `''` — không cần sửa gì.


## Tài khoản Admin mặc định

Được khởi tạo tự động trong `backend/db.js`, **giữ nguyên đúng như tài khoản admin gốc trong `main.html`**:

| Trường | Giá trị |
|---|---|
| Tài khoản | `tungnguyenADMIN12345678` |
| Mật khẩu | `Tunglaihoclaptrinhmobile@1142010ADMIN` |
| Email | `tung123t8@gmail.com` |
| Vai trò | `admin` |

> ⚠️ Tài khoản Admin gốc **luôn yêu cầu mã OTP gửi về email trên** mỗi lần đăng nhập (xem mục "Bảo mật đăng nhập" bên dưới). Nếu chưa cấu hình SMTP, mã OTP sẽ được in ra console của server thay vì gửi email thật.
>
> Khuyến nghị: sau khi triển khai thật, vào **Cài Đặt Tài Khoản** để đổi mật khẩu, hoặc dùng trang **Quản Lý Tài Khoản** để tạo thêm admin phụ rồi giới hạn quyền tài khoản gốc.

## Đưa dự án lên Internet (HTTPS)

1. Triển khai `backend/` lên VPS/hosting Node.js bất kỳ (Render, Railway, VPS riêng, v.v.) — nhớ đặt `JWT_SECRET` mạnh trong `.env` và bật HTTPS (qua reverse proxy Nginx/Caddy hoặc dịch vụ hosting có sẵn SSL).
2. Trỏ tên miền về server đó — toàn bộ frontend đã được phục vụ kèm theo, không cần thêm bước nào khác.
3. Các "Dự Án" mà người dùng công khai trong mục **Dự Án & Website** sẽ tự động có đường dẫn công khai dạng `https://your-domain.com/p/ten-du-an`.

## Bảo mật đăng nhập (mới)

- **Xác minh chống bot (captcha):** bắt buộc với mọi tài khoản, **trừ tài khoản Admin gốc**. Captcha là phép cộng đơn giản, tự sinh mỗi lần tải trang đăng nhập.
- **Xác thực 2 lớp qua email (OTP):** Admin gốc **luôn** phải nhập mã 6 số gửi về email (`tung123t8@gmail.com`) mỗi lần đăng nhập. Admin có thể bật/tắt yêu cầu này cho từng tài khoản khác trong trang **Quản Lý Tài Khoản** (nút biểu tượng cần gạt 🎚️).
- **Đăng nhập bằng email:** ô "Tài khoản" chấp nhận cả username lẫn email — hệ thống tự tìm tài khoản khớp với email đó.
- **Giới hạn công cụ theo tài khoản:** khi tạo tài khoản, Admin có thể tick chọn những công cụ tài khoản đó được phép dùng (Trường & Lớp, Điểm Danh, AI IDE, Tiếng Anh, Mạng Xã Hội, Dự Án, Cửa Hàng). Bỏ trống = không giới hạn. Giới hạn được áp dụng ở cả giao diện (ẩn mục trong sidebar) **và** ở backend (API trả lỗi 403 nếu cố truy cập công cụ không được phép).
- **Vai trò Developer:** ngoài student/teacher/admin, có thêm vai trò `developer` — được phép đăng (và xoá) tiện ích của chính mình trong **Cửa Hàng Tiện Ích Mở Rộng** để mở rộng tính năng cho ứng dụng.
- **Gửi email thông báo đăng nhập:** Admin có thể bật cho từng tài khoản để nhận email mỗi khi tài khoản đó đăng nhập.

### Cấu hình gửi email thật (SMTP)

Mặc định, khi chưa cấu hình SMTP, hệ thống **in mã OTP ra console server** thay vì gửi email thật (để bạn vẫn test được ngay — xem trường `devOtp` trả về khi gọi API lúc chưa cấu hình SMTP). Muốn gửi email thật, điền vào `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password   # Gmail: dùng "App Password", không dùng mật khẩu thường
SMTP_FROM=EduPulse <your-email@gmail.com>
```

Trên Render, thêm các biến này trong tab **Environment** của service (đã có sẵn placeholder trong `render.yaml`).

## Giao diện (mới)

- **Nền hiệu ứng hạt (particle constellation):** các chấm sáng cyan/tím/hồng trôi nhẹ và nối bằng đường kẻ mờ khi ở gần nhau, phủ toàn bộ nền mọi trang.
- **Dark/Light mode hoạt động thật:** bấm biểu tượng mặt trăng/mặt trời ở góc sidebar (hoặc trong Cài Đặt) để chuyển giao diện — áp dụng ngay lập tức và được lưu lại cho lần sau.
- **Select & file input theo phong cách cyberpunk:** toàn bộ thẻ `<select>` và nút chọn tệp ("Choose File") đã được thay bằng giao diện tuỳ chỉnh viền neon, không còn dùng giao diện mặc định xấu của trình duyệt.
- **Logo đồng bộ:** icon nguyên tử (⚛) cyan xuất hiện nhất quán ở trang đăng nhập lẫn sidebar của mọi trang bên trong.

## Ghi chú kỹ thuật

- CSDL dùng file JSON (`backend/data/db.json`) — không cần cài native module, chạy được trên Windows/macOS/Linux/Termux. Muốn nâng cấp lên PostgreSQL/MongoDB cho quy mô lớn, chỉ cần thay nội dung `backend/db.js` (`getDB`/`saveDB`) mà không phải sửa các route khác.
- AI IDE dùng dịch vụ chạy mã công khai [Piston](https://github.com/engineer-man/piston) (`emkc.org/api/v2/piston`) — cần kết nối Internet. Nếu mạng bị chặn, danh sách ngôn ngữ sẽ dùng bộ dự phòng tĩnh và tính năng "Chạy Code" sẽ báo lỗi kết nối.
- Chat thời gian thực dùng WebSocket thuần (`ws`), tự động fallback sang REST (`/api/messages`) nếu WebSocket không kết nối được.
- Toàn bộ mã nguồn được tổ chức theo REST route riêng biệt theo từng tính năng để dễ bảo trì và nâng cấp thêm sau này.

## Giấy phép

Phát hành theo giấy phép MIT — xem file [LICENSE](LICENSE).
