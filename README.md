# Finchi Webgame – Khung dự án V1

Đây là bộ khung chạy web bằng **Java + HTML/CSS/JavaScript** cho game giáo dục tài chính **Finchi**.

## Những gì đã có sẵn
- Màn hình chào mừng
- Chọn nhân vật và nhập tên
- Video intro bắt buộc xem (đã có chỗ cắm video thật)
- Bản đồ 10 level
- Video bài học cho từng level (đã có chỗ cắm video thật)
- 10 câu hỏi cho mỗi level
- Ví tiền và phần thưởng VNĐ mô phỏng
- Chuỗi tiết kiệm với các mốc 3 / 5 / 8 / 10
- Shop quà học tập mẫu
- Bảng phân loại tiền cuối tháng bản demo
- Giới hạn học mỗi ngày bằng localStorage

## Cấu trúc quan trọng
- `src/main/java/com/finchi/FinchiApplication.java`: server Java đơn giản để chạy web local
- `src/main/resources/static/index.html`: giao diện chính
- `src/main/resources/static/css/styles.css`: toàn bộ style
- `src/main/resources/static/js/app.js`: logic game phía frontend
- `src/main/resources/static/data/game-config.json`: cấu hình chung của game
- `src/main/resources/static/data/levels.json`: dữ liệu 10 level, câu hỏi, thưởng, video URL
- `src/main/resources/static/data/shop.json`: dữ liệu shop quà học tập

## Cách chạy nhanh
### Windows
- Cài JDK 21
- Double click `run.bat` hoặc chạy `run.bat 8081` nếu muốn đổi cổng
- Script sẽ tự in ra link mở game
- Mở link local hiện trên màn hình, ví dụ `http://localhost:8080`

### macOS / Linux
- Cài JDK 21
- Chạy:
  ```bash
  chmod +x run.sh
  ./run.sh
  ```
- Hoặc đổi cổng:
  ```bash
  ./run.sh 8081
  ```
- Script sẽ tự in ra link mở game
- Mở link local hiện trên màn hình, ví dụ `http://localhost:8080`

## Deploy public đầy đủ
Repo này đã được chuẩn bị để deploy full-stack bằng Docker.

### Cách deploy nhanh trên Railway
1. Push code mới nhất lên GitHub
2. Vào Railway và tạo `New Project`
3. Chọn `Deploy from GitHub repo`
4. Chọn repo `nam`
5. Railway sẽ tự build từ `Dockerfile`
6. Tạo một `Volume` và mount vào:
   - `/app/server-data`
7. Nếu muốn giữ mặc định, không cần sửa `PORT`
8. Nếu mount volume ở path khác, có thể đặt thêm:
   - `DATA_DIR=/duong-dan-ban-mount`
9. Mở phần `Networking` và bấm `Generate Domain`
10. Sau khi deploy xong, mở:
   - `/api/health` để kiểm tra server
   - link domain public để dùng web

### Vì sao cần volume
- Dự án lưu dữ liệu người chơi, parent dashboard và AI logs trong thư mục `server-data`
- Nếu không mount volume, dữ liệu đó sẽ mất sau mỗi lần redeploy hoặc restart
- App sẽ tự ưu tiên `DATA_DIR`, sau đó tới `RAILWAY_VOLUME_MOUNT_PATH`, rồi mới dùng `server-data` local

### Kiểm tra production
- Health check: `/api/health`
- Frontend: `/`
- Dữ liệu runtime: thư mục `/app/server-data`

## Truy cập từ thiết bị khác cùng mạng
Khi chạy server, script cũng sẽ in thêm một link dạng:

```text
http://192.168.x.x:8080
```

Bạn có thể mở link đó trên điện thoại hoặc máy tính khác nếu chúng cùng mạng Wi‑Fi/LAN với máy đang chạy game.

## Cách chèn video sau này
### Video intro luật chơi
Thay file vào đúng đường dẫn:
- `src/main/resources/static/videos/intro.mp4`

### Video từng level
Đặt lần lượt các file vào:
- `src/main/resources/static/videos/levels/level-1.mp4`
- `src/main/resources/static/videos/levels/level-2.mp4`
- ...
- `src/main/resources/static/videos/levels/level-10.mp4`

Nếu tên file khác, sửa URL trong:
- `src/main/resources/static/data/game-config.json` với video intro
- `src/main/resources/static/data/levels.json` với video từng level

## Cách sửa nội dung level
Bạn chỉ cần sửa file:
- `src/main/resources/static/data/levels.json`

Trong đó có thể đổi:
- tên level
- mô tả level
- câu hỏi
- đáp án đúng
- tiền thưởng
- thẻ kiến thức
- đường dẫn video

## Cách sửa shop quà học tập
Sửa file:
- `src/main/resources/static/data/shop.json`

## Ghi chú kỹ thuật
- Bản này ưu tiên **dễ sửa và chạy local nhanh**.
- Dữ liệu tiến độ lưu ở **localStorage** của trình duyệt.
- Nếu muốn, bước tiếp theo có thể nâng cấp sang **Spring Boot REST API + lưu H2/MySQL**.
- Trong môi trường tạo file lần này không có Maven/Gradle, nên mình thiết lập bộ khung theo kiểu **Java server tối giản chạy trực tiếp bằng JDK** để bạn có thể test ngay.

## Gợi ý bước tiếp theo
1. Gửi video intro luật chơi
2. Gửi 10 video level
3. Mình sẽ chèn video thật vào từng level
4. Sau đó mình có thể nâng tiếp lên:
   - lưu tiến độ server-side
   - drag & drop thật cho bảng phân loại tiền
   - animation đẹp hơn
   - dashboard quản lý nội dung level

## Nâng cấp branding đã thêm
- Tab trình duyệt dùng tên **Finchi.game**
- Có màn splash khởi động với logo Finchi
- Console và script chạy local đều dùng branding **Finchi.game**
- Endpoint kiểm tra sức khỏe trả về `app: Finchi.game`


## Mo rong moi trong ban nay

- Bang xep hang Finchi voi 3 tab: Ngay / Tuan / Thang
- Finchi Score duoc cong khi xem video, hoan thanh nhiem vu, tra loi dung, hoan thanh level va nop So chi tieu
- Man hinh Giai dau voi mini-tournament hang tuan
- Badge co ban cho nguoi choi va podium Top 3
- Du lieu tournament nam trong `src/main/resources/static/data/tournaments.json`
