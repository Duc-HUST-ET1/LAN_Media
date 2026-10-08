# LAN-Media

LAN-Media là ứng dụng nhắn tin đa phương tiện ưu tiên mạng LAN. Dự án hiện có đăng ký/đăng nhập, chat thời gian thực qua WebSocket, trạng thái online, hội thoại cá nhân/nhóm và gửi tệp. Ứng dụng gồm backend và frontend trong cùng một repository; cơ sở dữ liệu MySQL lưu tài khoản, phiên đăng nhập, hội thoại và tin nhắn. Tệp tải lên được lưu trên ổ đĩa của máy chủ.

> Hướng dẫn dưới đây dùng Windows PowerShell cho các lệnh sao chép tệp và tương thích với cấu hình Docker Compose hiện tại. Có thể phát triển trên macOS/Linux bằng các lệnh tương đương. Chọn **một** trong hai cách chạy: Docker Compose (khuyến nghị cho máy mới) hoặc Node.js + MySQL cài trực tiếp.

## Yêu cầu phần cứng

Các mức dưới đây là cấu hình khuyến nghị để chạy thử và phát triển ở quy mô nhỏ, không phải kết quả kiểm thử tải:

| Thành phần | Tối thiểu khuyến nghị | Thoải mái hơn |
|---|---:|---:|
| CPU | 2 nhân 64-bit | 4 nhân trở lên |
| RAM, chạy trực tiếp | 4 GB | 8 GB trở lên |
| RAM, dùng Docker Desktop | 8 GB khả dụng cho máy và Docker | 16 GB trở lên |
| Ổ đĩa | 5 GB trống để clone, cài dependencies và khởi chạy database | SSD, còn trống thêm theo dung lượng dữ liệu/tệp |
| Mạng | LAN/Wi-Fi ổn định nếu truy cập từ thiết bị khác | Ethernet hoặc Wi-Fi cùng mạng nội bộ |

Dung lượng tệp tải lên và database tăng theo mức sử dụng; không có giới hạn tổng dung lượng ổ đĩa do ứng dụng tự quản lý. Mỗi tệp tải lên mặc định tối đa 100 MiB (`MAX_FILE_SIZE`).

## Công nghệ sử dụng

- **Backend:** Node.js 22 trở lên, TypeScript, Express 5, WebSocket (`ws`), MySQL 8+ và `mysql2`.
- **Frontend:** React 19, TypeScript, Vite 6.
- **Công cụ phát triển:** npm, TypeScript, `concurrently`; kiểm thử bằng Node.js test runner.
- **Đóng gói môi trường:** Docker Compose (tùy chọn), với Node.js 22 và MySQL 8.4.
- **Lưu trữ:** MySQL cho dữ liệu ứng dụng; thư mục `uploads/` trên máy chủ cho nội dung tệp.

## Cổng mạng mặc định

| Cổng | Dịch vụ | Ghi chú |
|---:|---|---|
| 3000 | Backend API và WebSocket | `PORT` |
| 5173 | Frontend Vite khi phát triển | `FRONTEND_PORT` |
| 3307 | MySQL được publish bởi Docker Compose | `MYSQL_PUBLISHED_PORT`; bên trong Docker, ứng dụng kết nối MySQL ở cổng 3306 |

Các cổng 3000 và 5173 cần được cho phép trên firewall của máy chủ nếu truy cập từ thiết bị khác trong LAN. Chỉ mở cổng cần thiết trên mạng riêng đáng tin cậy; không đưa database ra Internet.

## Cách 1 — Clone và chạy bằng Docker Compose (khuyến nghị)

### 1. Cài công cụ cần thiết

Cài **Git** và **Docker Desktop** (bật Docker Compose/WSL 2 nếu Docker Desktop yêu cầu). Khởi động Docker Desktop và đợi Docker báo sẵn sàng. Cách này không cần cài Node.js hoặc MySQL trực tiếp trên máy.

### 2. Clone repository

Mở PowerShell tại thư mục muốn lưu dự án:

```powershell
git clone https://github.com/Duc-HUST-ET1/LAN_Media.git
cd LAN_Media
```

Nếu repository được chuyển sang địa chỉ khác hoặc là private, thay URL bằng URL clone hiển thị trên GitHub và bảo đảm tài khoản có quyền truy cập.

### 3. Tạo và sửa tệp môi trường

Tạo `.env` từ mẫu đã có trong repository:

```powershell
Copy-Item .env.example .env
notepad .env
```

Thay các giá trị mật khẩu mẫu bằng mật khẩu riêng, tối thiểu sửa:

```dotenv
DB_PASSWORD=mat_khau_rieng_cho_ung_dung
DB_ROOT_PASSWORD=mat_khau_rieng_cho_mysql_root
```

Không dùng các giá trị mẫu `change_me`/`change_root_me` cho môi trường dùng chung hoặc production. Không commit hoặc gửi tệp `.env`; tệp này đã được Git bỏ qua. Docker Compose tự tạo database/user dựa trên `DB_NAME`, `DB_USER`, `DB_PASSWORD`, và `DB_ROOT_PASSWORD` khi khởi tạo volume MySQL lần đầu. Nếu đã có volume MySQL được tạo trước đó, thay mật khẩu trong `.env` không tự đổi mật khẩu đã lưu trong database.

### 4. Khởi động ứng dụng

Từ thư mục `LAN_Media` (nơi có `docker-compose.yml`), chạy:

```powershell
docker compose up --build
```

Lần chạy đầu tiên Docker tải image, cài npm packages trong container, khởi động MySQL, sau đó chạy backend và frontend. Giữ cửa sổ này mở khi dùng ứng dụng. Backend tự chạy các migration database lúc khởi động; không cần chạy thủ công một file migration riêng.

Mở trình duyệt tại <http://localhost:5173>. Kiểm tra backend tại <http://localhost:3000/api/health>.

Để dừng, nhấn `Ctrl+C`. Sau đó có thể dùng:

```powershell
docker compose down
```

Lệnh trên dừng và gỡ các container nhưng giữ dữ liệu trong named volume. **Không** dùng `docker compose down -v` nếu muốn giữ database.

## Cách 2 — Chạy trực tiếp với Node.js và MySQL

Chọn cách này nếu máy đã có MySQL và muốn chạy ứng dụng từ terminal của máy chủ.

### 1. Cài công cụ cần thiết

Cài:

1. Git.
2. Node.js 22 trở lên (bản LTS phù hợp) — npm đi kèm Node.js.
3. MySQL Server 8 trở lên và MySQL command-line client (`mysql`).

Xác nhận công cụ đã có trong PowerShell:

```powershell
node --version
npm --version
mysql --version
```

### 2. Clone mã nguồn

```powershell
git clone https://github.com/Duc-HUST-ET1/LAN_Media.git
cd LAN_Media
```

### 3. Tạo database và tài khoản ứng dụng

Khởi động dịch vụ MySQL, sau đó chạy script khởi tạo bằng tài khoản quản trị MySQL:

```powershell
Get-Content docs/database/setup.sql | mysql -u root -p
```

Nhập mật khẩu `root` khi được yêu cầu. Script mặc định tạo database `lan_media` và tài khoản `lan_media_user` với mật khẩu `change_me` chỉ dùng cho phát triển local. Nếu muốn dùng thông tin khác, sửa database/user/password trong `docs/database/setup.sql` **trước khi chạy**, rồi dùng đúng các giá trị đó trong `.env` ở bước tiếp theo. Không sử dụng mật khẩu mẫu trên máy chủ dùng chung.

### 4. Tạo và cấu hình `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

Với database cài trên cùng máy, đặt các giá trị kết nối tương ứng; ví dụ nếu giữ nguyên `docs/database/setup.sql`:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lan_media
DB_USER=lan_media_user
DB_PASSWORD=change_me
```

`DB_PASSWORD` phải trùng với mật khẩu tài khoản MySQL được tạo ở bước 3. Nếu MySQL chạy trên một máy khác, đặt `DB_HOST` là địa chỉ máy đó, cho phép kết nối MySQL từ máy ứng dụng, và thiết lập quyền MySQL/firewall phù hợp; không mở MySQL cho toàn Internet. `DB_ROOT_PASSWORD` và `MYSQL_PUBLISHED_PORT` chỉ phục vụ Docker Compose, không cần thiết cho cách chạy trực tiếp.

Các biến thường cần biết:

| Biến | Mặc định trong `.env.example` | Ý nghĩa |
|---   |---                            |---      |
| `HOST`, `PORT` | `0.0.0.0`, `3000` | Địa chỉ bind và cổng backend |
| `FRONTEND_PORT` | `5173` | Cổng Vite; proxy `/api` và `/ws` tới backend |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Origin được backend cho phép; nếu đổi cổng/giao thức frontend, cập nhật cho khớp |
| `DB_HOST`, `DB_PORT` | `localhost`, `3306` | Địa chỉ MySQL; trong Compose, backend tự dùng hostname `mysql` và cổng `3306` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Giá trị mẫu | Database và tài khoản ứng dụng; phải khớp với MySQL |
| `SESSION_TTL_HOURS` | `168` | Thời hạn phiên đăng nhập (giờ) |
| `MAX_MESSAGE_LENGTH` | `4000` | Số ký tự tối đa của tin nhắn |
| `UPLOAD_DIR` | `./uploads` | Thư mục lưu file tải lên; cần có quyền ghi |
| `MAX_FILE_SIZE` | `104857600` | Kích thước tệp tối đa, tính bằng byte (100 MiB) |
| `ALLOWED_FILE_TYPES` | `*` | Danh sách MIME type/đuôi tệp cách nhau bằng dấu phẩy; `*` cho phép mọi loại |
| `VITE_ICE_SERVERS` | Google STUN mặc định | Cấu hình ICE trong frontend; cấu hình STUN không tự cung cấp TURN server |
| `VITE_HTTPS_KEY_FILE`, `VITE_HTTPS_CERT_FILE` | Không đặt | Tùy chọn đường dẫn certificate/key để chạy Vite HTTPS trong LAN |
| `DB_ROOT_PASSWORD`, `MYSQL_PUBLISHED_PORT` | Giá trị mẫu, `3307` | Mật khẩu root và cổng host của MySQL khi dùng Compose |

### 5. Cài dependencies và chạy

Trong thư mục gốc dự án:

```powershell
npm install
npm run dev
```

`npm run dev` khởi động cả backend và frontend. Backend build TypeScript, chạy server và theo dõi thay đổi; frontend chạy Vite. Backend thực hiện migration khi khởi động, vì vậy phải bảo đảm MySQL đã chạy và các biến database chính xác trước khi chạy ứng dụng.

Mở <http://localhost:5173>. API health check: <http://localhost:3000/api/health>. Dừng ứng dụng bằng `Ctrl+C`.

Nếu cần chạy riêng, mở hai cửa sổ PowerShell tại thư mục dự án:

```powershell
# Cửa sổ 1: backend
npm run dev:backend
```

```powershell
# Cửa sổ 2: frontend
npm run dev:frontend
```

## Truy cập từ thiết bị khác trong mạng LAN

1. Kết nối máy chủ và thiết bị khách vào cùng mạng LAN/Wi-Fi.
2. Trên máy chủ Windows, chạy `ipconfig` rồi tìm địa chỉ IPv4 của adapter đang dùng (ví dụ `192.168.1.20`).
3. Cho phép Node.js/Docker và cổng frontend `5173` cùng backend `3000` qua Windows Firewall trên **Private network**.
4. Truy cập frontend từ thiết bị khách bằng `http://<IP-may-chu>:5173`, ví dụ `http://192.168.1.20:5173`.

Đăng nhập, API và WebSocket của ứng dụng được frontend proxy tới backend. Nếu cần quyền truy cập camera/microphone hoặc các API trình duyệt chỉ hoạt động trong secure context, `http://<IP-LAN>` thường không đủ. Khi đó có thể cấu hình HTTPS cho Vite bằng certificate tin cậy trên từng thiết bị. Ví dụ trên máy chủ Windows đã cài [mkcert](https://github.com/FiloSottile/mkcert):

```powershell
mkcert -install
New-Item -ItemType Directory -Force certs
mkcert -key-file certs/lan-media-key.pem -cert-file certs/lan-media-cert.pem localhost 127.0.0.1 <IP-may-chu>
```

Thay `<IP-may-chu>` bằng địa chỉ IPv4 của máy chủ, rồi đặt trong `.env`:

```dotenv
VITE_HTTPS_KEY_FILE=certs/lan-media-key.pem
VITE_HTTPS_CERT_FILE=certs/lan-media-cert.pem
FRONTEND_ORIGIN=https://<IP-may-chu>:5173
```

Khởi động lại ứng dụng và mở `https://<IP-may-chu>:5173`. Thiết bị khách phải tin cậy CA certificate do `mkcert -CAROOT` cung cấp; `mkcert -install` trên máy chủ **không** tự cài CA lên điện thoại/máy khác. Chỉ cài CA certificate công khai lên thiết bị cần dùng; giữ riêng CA private key và private key của server, không commit hoặc gửi các khóa này. Tệp certificate/key trong `certs/` được Git bỏ qua. Tính năng gọi WebRTC phụ thuộc hỗ trợ trình duyệt, secure context và cấu hình mạng/ICE; cấu hình STUN mặc định không bảo đảm gọi được qua mọi router/firewall.

## Kiểm tra dự án

Chạy tại thư mục gốc:

```powershell
npm run typecheck
npm run build
npm test
```

`npm test` build backend trước khi chạy unit/integration tests. Một số integration test cần MySQL với cấu hình trong `.env`; đảm bảo database khả dụng nếu cần xác nhận các luồng phụ thuộc database.

## Cấu trúc và tài liệu liên quan

- `backend/src/` — API, dịch vụ, repository, migration và WebSocket server.
- `frontend/src/` — giao diện React, API client và realtime client.
- `backend/src/core/database/migrations/` — migration được backend chạy tự động khi khởi động.
- `docs/database/README.md` và `docs/database/setup.sql` — hướng dẫn và script tạo database/tài khoản MySQL.
- `uploads/` — file upload được lưu cục bộ; cần sao lưu riêng nếu cần bảo toàn file người dùng.
- `docker-compose.yml` — cấu hình chạy ứng dụng cùng MySQL bằng Docker Compose.

Các luồng WebRTC/LAN discovery nâng cao và ứng dụng mobile chưa được bảo đảm đầy đủ chỉ bằng việc chạy các bước trên; xem trạng thái triển khai trong source hiện tại trước khi dùng như tính năng production.
