# Hướng Dẫn Triển Khai — Quantum Chat OS

Tài liệu này hướng dẫn cách chạy Quantum Chat OS trên máy cá nhân (để test) và triển khai lên server thật (để mọi người truy cập qua Internet).

---

## 1. Yêu cầu hệ thống

- **Node.js** phiên bản 18 trở lên ([tải tại nodejs.org](https://nodejs.org))
- Hệ điều hành: Windows, macOS, hoặc Linux đều chạy được (kể cả VPS giá rẻ)
- Không cần cài database riêng — dữ liệu lưu dạng file JSON (`backend/data/db.json`), đơn giản, dễ sao lưu

Kiểm tra đã cài Node.js chưa:
```bash
node -v
npm -v
```

---

## 2. Chạy thử trên máy cá nhân (local)

```bash
cd edupulse/backend
npm install
npm start
```

Mở trình duyệt tại: **http://localhost:4000**

Mặc định server chạy ở cổng `4000`. Muốn đổi cổng, tạo file `.env` trong thư mục `backend/`:
```
PORT=5000
```

**Tài khoản Admin có sẵn:**
- Tên đăng nhập: `TunglaihoclaptrinhSocialMedia`
- Mật khẩu: `Tungnguyenlaihoclaptrinhmobile@142010`
- Tài khoản này bắt buộc xác minh OTP qua email khi đăng nhập (xem mục 4 bên dưới nếu chưa cấu hình email — hệ thống sẽ hiện mã test ngay trên màn hình để bạn tự đăng nhập được).

---

## 3. Cấu trúc thư mục quan trọng

```
edupulse/
├── backend/
│   ├── server.js          ← điểm khởi động server
│   ├── data/db.json        ← TOÀN BỘ dữ liệu (tài khoản, bài viết, tin nhắn...) — NHỚ SAO LƯU FILE NÀY
│   ├── uploads/             ← ảnh/video người dùng tải lên — NHỚ SAO LƯU THƯ MỤC NÀY
│   └── templates/           ← file Excel mẫu để nhập tài khoản hàng loạt
└── frontend/                ← toàn bộ giao diện web (server tự phục vụ, không cần deploy riêng)
```

⚠️ **Quan trọng khi cập nhật lên bản mới:** không được ghi đè/xoá `backend/data/` và `backend/uploads/` khi giải nén bản cập nhật, nếu không sẽ mất hết dữ liệu người dùng thật. Chỉ thay thế code (các file `.js`, `.html`), giữ nguyên 2 thư mục này.

---

## 4. Email gửi OTP / thông báo (đã cấu hình sẵn)

File `backend/.env` đã được cấu hình sẵn để gửi email thật qua Gmail:
- Gửi từ: **tung123t8@gmail.com**, hiển thị tên người gửi là **"Quantum Chat OS Team"**
- Dùng cho: mã OTP đăng nhập, thông báo đăng nhập, chúc mừng sinh nhật, kết quả duyệt tài khoản/tích xanh...

Nếu sau này muốn đổi sang email khác, mở `backend/.env` và sửa:
```env
SMTP_USER=email-moi@gmail.com
SMTP_PASS=mat-khau-ung-dung-16-ky-tu-moi
SMTP_FROM="Quantum Chat OS Team <email-moi@gmail.com>"
```
`SMTP_PASS` phải là **App Password** (mật khẩu ứng dụng) của Gmail, không phải mật khẩu Gmail thường — tạo tại [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (cần bật xác minh 2 bước trước). Sau khi sửa, khởi động lại server (`pm2 restart quantum-chat-os` hoặc chạy lại `npm start`).

⚠️ Nếu server không có kết nối mạng tới `smtp.gmail.com` (ví dụ đang test trong môi trường nội bộ chặn mạng ngoài), hệ thống sẽ tự động in mã OTP ra console/màn hình thay vì gửi thật, để bạn vẫn đăng nhập được — không bị chặn hoàn toàn.

⚠️ **`JWT_SECRET`**: đã được tạo sẵn một chuỗi ngẫu nhiên mạnh trong `.env`. Nếu triển khai nhiều server khác nhau, hãy tạo chuỗi riêng cho mỗi nơi bằng lệnh:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 5. Chạy ổn định lâu dài trên server (PM2)

Chạy trực tiếp bằng `npm start` sẽ dừng khi bạn đóng cửa sổ terminal hoặc SSH ngắt kết nối. Dùng **PM2** để chạy nền, tự khởi động lại nếu lỗi, và tự chạy lại khi server reboot:

```bash
npm install -g pm2
cd edupulse/backend
pm2 start server.js --name quantum-chat-os
pm2 save
pm2 startup      # làm theo hướng dẫn PM2 in ra để tự chạy lại khi server khởi động lại
```

Các lệnh hữu ích:
```bash
pm2 logs quantum-chat-os     # xem log
pm2 restart quantum-chat-os  # khởi động lại (sau khi cập nhật code)
pm2 stop quantum-chat-os     # dừng
```

---

## 6. Gắn tên miền + HTTPS (reverse proxy)

Server Node.js đang chạy ở cổng nội bộ (ví dụ `4000`). Để dùng tên miền thật (`https://quantumchat.vn`) và có HTTPS, đặt một reverse proxy phía trước. Dưới đây là cấu hình cho **cả Nginx và Apache** — chỉ cần dùng một trong hai.

### 6a. Dùng Nginx (khuyến nghị — nhẹ, phổ biến cho Node.js)

```nginx
server {
    listen 80;
    server_name quantumchat.vn www.quantumchat.vn;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # bắt buộc để chat realtime (WebSocket) hoạt động
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 150M;   # cho phép tải video lên (Reels/bài viết)
}
```

### 6b. Dùng Apache HTTP Server

Bật các module cần thiết trước:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers
```

Tạo file cấu hình site (ví dụ `/etc/apache2/sites-available/quantumchat.conf`):
```apache
<VirtualHost *:80>
    ServerName quantumchat.vn
    ServerAlias www.quantumchat.vn

    # Cho phép tải file lớn (video Reels/bài viết)
    LimitRequestBody 157286400

    # Chuyển tiếp WebSocket (bắt buộc để tin nhắn/thông báo realtime hoạt động)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://127.0.0.1:4000/$1 [P,L]

    # Chuyển tiếp toàn bộ còn lại (HTTP thường)
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:4000/
    ProxyPassReverse / http://127.0.0.1:4000/

    ErrorLog ${APACHE_LOG_DIR}/quantumchat-error.log
    CustomLog ${APACHE_LOG_DIR}/quantumchat-access.log combined
</VirtualHost>
```

Kích hoạt site:
```bash
sudo a2ensite quantumchat.conf
sudo systemctl reload apache2
```

### 6c. Bật HTTPS miễn phí (Let's Encrypt) — dùng chung cho cả Nginx và Apache

```bash
sudo apt install certbot python3-certbot-nginx   # hoặc python3-certbot-apache nếu dùng Apache
sudo certbot --nginx -d quantumchat.vn -d www.quantumchat.vn
# hoặc: sudo certbot --apache -d quantumchat.vn -d www.quantumchat.vn
```

Certbot sẽ tự động sửa cấu hình để bật HTTPS và tự gia hạn chứng chỉ.

---

## 7. Cài đặt như một ứng dụng (PWA)

Sau khi truy cập qua HTTPS, người dùng có thể:
- **Điện thoại (Android/iOS)**: mở trình duyệt → menu → "Thêm vào Màn hình chính" / "Add to Home Screen"
- **Máy tính (Chrome/Edge)**: sẽ có icon "Cài đặt" (⊕) xuất hiện trên thanh địa chỉ

App sẽ dùng đúng logo Quantum Chat OS đã cấu hình sẵn trong `frontend/assets/img/`.

---

## 8. Sao lưu dữ liệu định kỳ

Toàn bộ dữ liệu nằm trong 2 nơi — hãy sao lưu định kỳ (cron job hàng ngày là đủ):

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz backend/data backend/uploads
```

---

## 9. Cập nhật lên phiên bản mới

1. Sao lưu `backend/data/` và `backend/uploads/` (xem mục 8).
2. Giải nén bản code mới **đè lên các file `.js`/`.html`**, nhưng **không đụng vào** `backend/data/` và `backend/uploads/`.
3. Chạy lại `npm install` trong `backend/` (phòng khi có thư viện mới).
4. `pm2 restart quantum-chat-os`.
5. Trên trình duyệt, nhấn Ctrl+Shift+R (hard refresh) một lần để chắc chắn tải giao diện mới — Service Worker của app đã được cấu hình tự động lấy bản mới nhất từ những lần sau.

---

## 10. Bản quyền

Dự án được phát hành theo giấy phép **Apache License 2.0** — xem file [`LICENSE`](./LICENSE) để biết đầy đủ điều khoản.
