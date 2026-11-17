<!-- Created by Haihs on 11/11/2026 -->
<!-- Project overview: giới thiệu, cài đặt, cấu hình, triển khai và kiểm thử. -->
<!-- Haihs: viết lại README theo mẫu ts_doc_to_exam_ai; nội dung cũ (ghi chú M0-M8) lưu nguyên văn ở docs/readme-ghi-chu-m0-m8.md - start - end -->
# Doc to Exam AI

Doc to Exam AI là hệ thống thi trực tuyến mã nguồn mở dành cho giáo viên: tải lên một đề thi dạng PDF hoặc Word, Gemini AI tách thành câu hỏi và đáp án, giáo viên rà soát rồi mở ca thi cho lớp học làm bài, hệ thống tự chấm phần trắc nghiệm và thống kê kết quả.

Đây là bản viết lại của `ts_doc_to_exam_ai` với kiến trúc tách đôi: API bằng Next.js (App Router, MongoDB, Mongoose) và giao diện Angular (Tailwind CSS), chung một monorepo npm workspaces. Hành vi và giao diện giữ nguyên so với bản gốc.

## Mục lục

- [Cách hoạt động](#cách-hoạt-động)
- [Cài đặt](#cài-đặt)
  - [Chạy trên máy cá nhân](#chạy-trên-máy-cá-nhân)
  - [Triển khai lên máy chủ](#triển-khai-lên-máy-chủ)
- [Cấu hình](#cấu-hình)
- [Quy trình sử dụng cơ bản](#quy-trình-sử-dụng-cơ-bản)
- [Bên trong dự án](#bên-trong-dự-án)
- [Kiểm thử và chất lượng mã](#kiểm-thử-và-chất-lượng-mã)
- [Bảo mật](#bảo-mật)
- [Đóng góp](#đóng-góp)

## Cách hoạt động

Giáo viên đăng ký tài khoản bằng số điện thoại và một mã bí mật do quản trị viên đặt, sau đó dán Gemini API Key của riêng mình vào tài khoản. Khi tải lên file đề thi, Gemini nhận diện câu hỏi, các phương án, ngữ cảnh bài đọc và bảng đáp án cuối đề. Nếu đề không có đáp án, AI tự giải. Giáo viên xem lại toàn bộ nội dung, sửa câu hỏi hoặc đáp án, rồi lưu thành một **đề mẫu**.

Từ đề mẫu, giáo viên tạo **ca thi**: đặt giờ mở, giờ đóng, thời lượng, bật đảo thứ tự câu hỏi. Học sinh được gán vào ca thi thông qua **lớp học**, mời bằng đường dẫn hoặc nhập danh sách từ file CSV/XLSX. Học sinh đăng nhập, quét mã QR hoặc nhập mã ca là làm bài được ngay trên điện thoại.

Mọi quyết định quan trọng đều nằm ở máy chủ. Đồng hồ làm bài do máy chủ giữ, nên tải lại trang không làm mới thời gian. Đáp án đúng, lời giải và tiêu chí chấm không bao giờ được gửi xuống trình duyệt học sinh, và nội dung đề chỉ được trả về trong khung giờ làm bài. Nộp trùng bị chặn bằng unique index. Câu tự luận do giáo viên chấm tay.

## Cài đặt

Yêu cầu chung: Node.js 22 trở lên (`engines.node >=22`) và một Gemini API Key, lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/app/apikey). MongoDB là tùy chọn khi phát triển, vì API tự dùng MongoDB in-memory nếu không đặt `MONGODB_URI`.

### Chạy trên máy cá nhân

```bash
git clone https://github.com/haihs-github/doc-to-exam-v2.git
cd doc-to-exam-v2
npm install
npm run dev      # chạy đồng thời apps/api và apps/web
```

`npm run dev` chạy API (Next.js) ở cổng 3000 và giao diện (Angular) ở cổng 4200. Mở trình duyệt tại `http://localhost:4200`. Angular proxy mọi đường dẫn `/api` tới `localhost:3000`.

Lần chạy đầu tiên, API tải binary `mongod` về `~/.cache/mongodb-binaries` để chạy MongoDB in-memory (dữ liệu mất khi dừng). Ở development, nếu để trống các khóa bí mật thì chúng được sinh ngẫu nhiên mỗi lần khởi động, nên hãy đặt `TEACHER_SECRET_KEY` cố định để đăng ký được tài khoản giáo viên:

```bash
cp apps/api/.env.example apps/api/.env.local
node scripts/generate-secrets.mjs    # sinh sẵn các khóa bí mật, chép vào apps/api/.env.local
```

Dùng mã `TEACHER_SECRET_KEY` đó để đăng ký tài khoản giáo viên đầu tiên tại `http://localhost:4200/teacher/register`.

### Triển khai lên máy chủ

Bất kỳ máy chủ nào chạy được Node.js 22 (VPS, Railway, Fly.io…) đều dùng được, cần MongoDB 5 trở lên. Hai ràng buộc quan trọng:

- **Chỉ một instance.** Rate limit, cache đề và semaphore upload nằm trong RAM tiến trình, chưa hỗ trợ scale ngang.
- **Web và API phải cùng origin.** Đặt reverse proxy để `/api` trỏ tới API và mọi đường dẫn còn lại trỏ tới bản build của Angular (rewrite về `index.html`).

```bash
git clone https://github.com/haihs-github/doc-to-exam-v2.git
cd doc-to-exam-v2
npm install

cp apps/api/.env.example apps/api/.env.local
node scripts/generate-secrets.mjs    # chép kết quả vào .env.local, điền MONGODB_URI, đặt NODE_ENV=production

npm run build                        # build apps/api và apps/web
npm run start -w apps/api            # API tại http://127.0.0.1:3000
```

Bản build giao diện nằm ở `apps/web/dist/web/browser`. Giữ API chạy liên tục bằng pm2:

```bash
npm install -g pm2
pm2 start "npm run start -w apps/api" --name doc-to-exam-ai
pm2 save && pm2 startup
```

Ví dụ Nginx (HTTPS bằng `certbot --nginx`; nút "Sao chép link" chỉ hoạt động trên HTTPS hoặc localhost):

```nginx
server {
    server_name thi.truonghoc.edu.vn;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /đường/dẫn/apps/web/dist/web/browser;
        try_files $uri /index.html;
    }
}
```

Khi đặt sau proxy, đặt `TRUST_PROXY` đúng số lớp proxy để rate limit tính theo đúng IP người dùng.

## Cấu hình

Toàn bộ thông tin nhạy cảm nằm trong biến môi trường của API. Không có giá trị bí mật nào được ghi cứng trong mã nguồn. File mẫu có chú thích nằm ở `apps/api/.env.example`.

**Bắt buộc ở production** (`NODE_ENV=production` hoặc giá trị lạ). Thiếu hoặc quá ngắn thì tiến trình ghi tên biến (không ghi giá trị) và thoát `exit(1)` ngay khi khởi động.

| Biến | Mô tả |
|---|---|
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_SECRET` | Khóa ký token đăng nhập, tối thiểu 16 ký tự. Đổi khóa sẽ buộc mọi người đăng nhập lại |
| `API_KEY_ENCRYPTION_SECRET` | Khóa mã hóa AES-GCM cho Gemini API Key, tối thiểu 16 ký tự. Đổi khóa sẽ làm các API Key đã lưu không đọc được |
| `TEACHER_SECRET_KEY` | Mã để đăng ký tài khoản giáo viên, tối thiểu 8 ký tự |

**Tùy chọn**

| Biến | Mặc định | Mô tả |
|---|---|---|
| `NODE_ENV` | `development` | `production` bật chế độ kiểm tra cấu hình nghiêm ngặt |
| `JWT_EXPIRES_IN` | `7d` | Thời hạn token (số thuần được hiểu là giây) |
| `ALLOW_IN_MEMORY_DB` | `true` khi dev/test, luôn tắt ở production | Cho phép chạy bằng MongoDB in-memory khi không có `MONGODB_URI` |
| `TRUST_PROXY` | `1` ở production, `0` nơi khác | Số lớp proxy tin cậy phía trước (X-Forwarded-For). Đặt sai có thể bị giả mạo IP |
| `BCRYPT_COST`, `BCRYPT_TEMP_COST` | `10`, `8` | Chi phí băm mật khẩu và mật khẩu tạm |
| `RATE_LIMIT_<TÊN>_MAX` | theo từng bộ giới hạn | Ghi đè số lần tối đa, ví dụ `RATE_LIMIT_LOGIN_MAX`. Chỉ bỏ qua hoàn toàn khi `NODE_ENV=test` |
| `TEMPLATE_TRASH_DAYS` | `30` | Số ngày giữ đề mẫu trong thùng rác (tối đa 3650) |
| `EXAM_CACHE_TTL_MS` | `20000` | Thời gian cache đề thi (ms), `0` để tắt cache |
| `ESSAY_UPLOAD_*`, `ESSAY_MEDIA_*` | xem mã nguồn | Giới hạn upload và phục vụ ảnh bài tự luận |
| `HTTPS_PROXY` | trống | Proxy HTTP của cơ quan hoặc trường học, cần cho SDK của Gemini |

## Quy trình sử dụng cơ bản

1. **Tạo tài khoản giáo viên** bằng số điện thoại và mã bí mật, rồi nhập Gemini API Key.
2. **Tải đề thi lên.** Gemini tách câu hỏi và đáp án từ file PDF hoặc Word. Rà soát, sửa nội dung và lưu thành đề mẫu.
3. **Tạo ca thi từ đề mẫu.** Đặt giờ mở, giờ đóng, thời lượng, đảo đề.
4. **Tạo lớp học** và mời học sinh bằng đường dẫn, hoặc nhập danh sách từ CSV/XLSX (tối đa 200 dòng). Gán lớp vào ca thi.
5. **Gửi link hoặc mã QR** cho học sinh. Học sinh đăng nhập và làm bài trên điện thoại.
6. **Chấm và công bố kết quả.** Trắc nghiệm được chấm tự động, tự luận do giáo viên chấm tay. Xem bảng điểm theo lớp, xem chi tiết từng bài làm và xuất Excel.

Các trang chính: giáo viên dùng `/teacher/templates`, `/teacher/sittings`, `/teacher/classes`; học sinh dùng `/sittings` (ca của tôi), `/classes`, `/join/:token`, và `/ca/:mã` → phòng thi `/ca/:mã/room` → `/ca/:mã/result` khi giáo viên đã công bố.

## Bên trong dự án

```
apps/api/        API Next.js (App Router), Mongoose
  app/api/       Route handler: auth, classes, me, templates, sittings, essay-uploads, health
  src/lib/       Xác thực, rate limit, Gemini, chấm điểm, xuất Excel, kiểm tra cấu hình
  src/models/    Mô hình dữ liệu MongoDB
  src/services/  Nghiệp vụ
  tests/         Kiểm thử tích hợp API (vitest, MongoDB in-memory)
apps/web/        Giao diện Angular 22 (standalone, signals), Tailwind CSS
packages/contract/  Kiểu và schema dùng chung giữa API và web
e2e/             Kiểm thử Playwright
scripts/         limited.sh (giới hạn tài nguyên), generate-secrets.mjs
docs/            Thiết kế, kế hoạch, handoff, nghiên cứu
```

Các tính năng chính:

- **Xác thực và phân quyền:** giáo viên và học sinh có tài khoản riêng; người ngoài lớp luôn nhận 404; token mời chỉ trả cho giáo viên của lớp; mật khẩu tạm chỉ xuất hiện một lần (`Cache-Control: no-store`).
- **Đề mẫu:** trích xuất bằng Gemini, chỉnh sửa trước khi lưu, tạo bản sao đề, thùng rác với khả năng khôi phục.
- **Ca thi:** đảo thứ tự câu hỏi và phương án, giới hạn thời gian do máy chủ giữ, tự lưu nháp, tự nộp bài khi hết giờ, quyền vào ca theo lớp.
- **Lớp học:** mời bằng đường dẫn, nhập học sinh từ CSV/XLSX, đặt lại mật khẩu tạm, nhiều giáo viên.
- **Câu tự luận:** học sinh nộp văn bản hoặc ảnh, giáo viên chấm tay với điểm theo thang từng câu.
- **Thống kê:** lọc theo lớp, xuất Excel.
- **Giao diện:** chế độ sáng và tối, dùng được trên điện thoại.

Gemini API: mỗi giáo viên dùng API Key riêng. Hạn mức miễn phí do Google quy định theo từng project và từng model, xem tại [aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit).

## Kiểm thử và chất lượng mã

Mọi lệnh nặng chạy qua wrapper giới hạn tài nguyên (2 CPU, 3GB RAM, không swap), từng nhóm một, không chạy song song:

```bash
scripts/limited.sh npm run lint
scripts/limited.sh npm run test:contract
scripts/limited.sh npm run test:api
scripts/limited.sh npm run test:web
scripts/limited.sh npm run build
scripts/limited.sh npx playwright install chromium   # lần đầu
scripts/limited.sh npx playwright test               # E2E, tự khởi động API (3000) + web (4200), không cần Mongo
```

Playwright dùng DB in-memory, nới rate limit và lấy `TEACHER_SECRET_KEY` từ `E2E_TEACHER_SECRET_KEY` (mặc định `e2e-teacher-secret`). Nếu đã có server chạy sẵn ở cổng 3000/4200 (ngoài CI) thì nó được tái dùng và cấu hình env của Playwright không áp dụng, nên hãy tắt `npm run dev` trước khi chạy E2E.

CI (`.github/workflows/ci.yml`) chạy các job lint, test-api, test-web, build, e2e và audit.

## Bảo mật

- Thiếu cấu hình bắt buộc ở production thì API dừng, không chạy bằng giá trị mặc định.
- Mật khẩu được băm bằng bcrypt. Gemini API Key được mã hóa AES-GCM.
- Đáp án đúng, lời giải và tiêu chí chấm không bao giờ được gửi xuống trình duyệt học sinh. Việc chấm điểm diễn ra hoàn toàn ở máy chủ.
- Thời gian làm bài do máy chủ quản lý, không tin dữ liệu do trình duyệt gửi lên.
- Có giới hạn kích thước request và giới hạn tốc độ theo IP. Token bị vô hiệu bằng `tokenVersion` khi đăng xuất mọi nơi hoặc đổi mật khẩu.
- Không commit `apps/api/.env.local`.

Nếu phát hiện lỗ hổng bảo mật, vui lòng báo riêng cho tác giả thay vì mở issue công khai.

## Đóng góp

Mọi đóng góp đều được hoan nghênh. Vui lòng mở issue để trao đổi trước khi gửi thay đổi lớn. Trước khi gửi pull request, chạy `npm run lint` và các nhóm test ở trên và đảm bảo đều qua. Với thay đổi hành vi, cập nhật tài liệu tương ứng trong `docs/` và [CHANGELOG.md](CHANGELOG.md).

Quy ước tác giả: file JSON thuần (`package.json`, `package-lock.json`) miễn header `Created by Haihs`; `apps/web/src/index.html` giữ `<!doctype html>` ở dòng 1, header đặt ngay sau. Ghi chú chi tiết các milestone M0–M8 xem [docs/readme-ghi-chu-m0-m8.md](docs/readme-ghi-chu-m0-m8.md) và `docs/handoff/`.
