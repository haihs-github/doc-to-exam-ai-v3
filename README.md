<!-- Created by Haihs on 11/11/2026 -->
<!-- Project overview: how to run dev and resource limits. -->
# doc-to-exam-ts

Monorepo (npm workspaces `apps/*`, `packages/*`): Next.js API + Angular SPA.

## Chạy dev

```bash
<!-- Haihs: .nvmrc đã bị bỏ, dùng engines.node >=22 - start -->
<!-- đóng code cũ -->
<!-- nvm use          # Node 22 -->
# Cần Node >= 22 (package.json engines.node)
<!-- Haihs: .nvmrc đã bị bỏ, dùng engines.node >=22 - end -->
npm install
npm run dev      # chạy apps/api và apps/web
```

Scripts gốc: `lint`, `format` (thủ công, ví dụ `npm run format -- <file>`), `test:api`, `test:web`, `test:contract`, `build`, `dev`.

Prettier chỉ áp cho file mới/sửa từ M1; M0 chưa format.

## Giới hạn tài nguyên (D6)

Lệnh test/build/install nặng chạy qua `scripts/limited.sh <lệnh>` (2 CPU, 3GB RAM, không swap). Chạy từng nhóm test, không chạy song song.

## Ngoại lệ quy ước header

<!-- Haihs: đóng code cũ, tsconfig*.json nay có header - start --> <!-- đóng code cũ: `package.json`, `package-lock.json` và các file JSON khác không mang header `Created by Haihs` vì JSON không hỗ trợ comment (người dùng đã duyệt 11/11/2026) --> <!-- Haihs: đóng code cũ, tsconfig*.json nay có header - end -->

`package.json`, `package-lock.json` và các file JSON thuần (không comment được) miễn header `Created by Haihs` (người dùng đã duyệt 11/11/2026); `tsconfig*.json` (JSONC) có header. <!-- Haihs: tsconfig*.json nay có header - start - end -->
`apps/web/src/index.html` giữ `<!doctype html>` ở dòng 1, header đặt ngay sau (tránh quirks mode; người dùng đã duyệt 11/11/2026). <!-- Haihs: ghi nhận ngoại lệ index.html - start - end -->

<!-- Haihs: tài liệu M0 (test, E2E, triển khai) - start -->
## Chạy test

Mọi lệnh nặng qua wrapper, từng nhóm một:

```bash
scripts/limited.sh npm run lint
scripts/limited.sh npm run test:api
scripts/limited.sh npm run test:web
scripts/limited.sh npm run build
scripts/limited.sh npx playwright install chromium   # lần đầu
scripts/limited.sh npx playwright test               # smoke E2E, tự khởi động API (3000) + web (4200), không cần Mongo
```

CI (`.github/workflows/ci.yml`): các job lint, test-api, test-web, build, e2e, audit.

## Triển khai

- D9: chỉ hỗ trợ một instance (state như rate limit/kết nối nằm trong bộ nhớ tiến trình); chưa hỗ trợ scale ngang.
- D13: web và API phải cùng origin. Dev dùng proxy `/api` của Angular tới `localhost:3000`; production đặt reverse proxy để `/api` và SPA chung một origin.
<!-- Haihs: tài liệu M0 (test, E2E, triển khai) - end -->

<!-- Haihs: tài liệu M1 (tài khoản, auth, biến môi trường, DB dev, E2E) - start -->
## Tài khoản và xác thực (M1)

Route API (JSON, envelope `{ success, data | code, message }`):

- `POST /api/auth/teacher/register`, `POST /api/auth/teacher/login`
- `POST /api/auth/student/register`, `POST /api/auth/student/login`
- `GET /api/auth/me`, `PUT /api/auth/api-key` (Gemini API Key của giáo viên, mã hóa AES-GCM), `POST /api/auth/logout-all`, `POST /api/auth/change-password`

Trang web: `/about`, `/login`, `/register`, `/teacher/login`, `/teacher/register`, `/change-password`. Trang `/` hiện là placeholder cho người đã đăng nhập (đến M2/M3).

### Tạo tài khoản giáo viên đầu tiên

Đặt `TEACHER_SECRET_KEY` (>= 8 ký tự) cho API, mở `/teacher/register`, nhập họ tên, số điện thoại (bắt đầu bằng 0, 10-11 số), mật khẩu và **mã bí mật giáo viên** đúng bằng giá trị đó. Trong dev nếu để trống, secret được sinh ngẫu nhiên mỗi lần khởi động (đặt giá trị cố định để đăng ký được).

### Biến môi trường (apps/api, xem `apps/api/.env.example`)

| Biến | Ý nghĩa |
| --- | --- |
| `JWT_SECRET` | Khóa ký JWT (>= 16 ký tự ở production) |
| `JWT_EXPIRES_IN` | Hạn token, mặc định `7d` (số thuần = giây) |
| `API_KEY_ENCRYPTION_SECRET` | Khóa mã hóa Gemini API Key (>= 16 ký tự ở production) |
| `TEACHER_SECRET_KEY` | Mã bí mật để đăng ký giáo viên (>= 8 ký tự ở production) |
| `BCRYPT_COST`, `BCRYPT_TEMP_COST` | Chi phí bcrypt (mặc định 10 và 8) |
| `TRUST_PROXY` | Số reverse proxy tin cậy phía trước (X-Forwarded-For); mặc định 1 ở production, 0 nơi khác. Phải khớp hạ tầng, vì rate limit đăng nhập tính theo IP |
| `RATE_LIMIT_<TÊN>_MAX` | Ghi đè số lần tối đa của từng bộ giới hạn (ví dụ `RATE_LIMIT_LOGIN_MAX`); chỉ bỏ qua hoàn toàn khi `NODE_ENV=test` |
| `MONGODB_URI`, `ALLOW_IN_MEMORY_DB` | Xem mục DB dev bên dưới |

Production (`NODE_ENV=production` hoặc giá trị lạ) kiểm tra cấu hình khi khởi động (`instrumentation.ts`): thiếu hoặc quá ngắn `JWT_SECRET`, `API_KEY_ENCRYPTION_SECRET`, `TEACHER_SECRET_KEY`, `MONGODB_URI` thì tiến trình ghi tên biến (không ghi giá trị) và thoát `process.exit(1)` (fail-fast).

### DB khi phát triển

Không đặt `MONGODB_URI` ở development/test: API tự khởi động MongoDB in-memory (mongodb-memory-server), dữ liệu mất khi dừng; lần chạy đầu tải binary `mongod` về `~/.cache/mongodb-binaries`. `ALLOW_IN_MEMORY_DB=false` để tắt. Luôn tắt ở production, nơi bắt buộc có `MONGODB_URI`.

### Rate limit và một instance

Rate limit lưu trong RAM tiến trình, nên chỉ đúng khi chạy một instance duy nhất (D9); scale ngang cần kho dùng chung.

### Chạy E2E (smoke + auth)

```bash
scripts/limited.sh npx playwright install chromium
scripts/limited.sh npx playwright test
```

Playwright tự khởi động API (DB in-memory, rate limit nới lên 100000, `TEACHER_SECRET_KEY` lấy từ `E2E_TEACHER_SECRET_KEY`, mặc định `e2e-teacher-secret`) và web. Timeout khởi động API là 240 giây vì lần đầu phải tải binary MongoDB. Server đang chạy sẵn (ngoài CI) được tái dùng và khi đó cấu hình env của Playwright không áp dụng.
<!-- Haihs: tài liệu M1 (tài khoản, auth, biến môi trường, DB dev, E2E) - end -->

<!-- Haihs: tài liệu M2 (lớp học) - start -->
## Lớp học (M2)
- API: `/api/classes/**` (giáo viên) và `/api/me/classes/**` (học sinh); người ngoài lớp luôn nhận 404; token mời chỉ trả cho giáo viên của lớp, mật khẩu tạm chỉ xuất hiện một lần trong response (`Cache-Control: no-store`).
- Web: `/teacher/classes`, `/teacher/classes/:id?tab=students|teachers|invite`, `/join`, `/join/:token`, `/classes`, `/classes/:id`.
- Import học sinh: `.csv` ≤ 256KB hoặc `.xlsx` ≤ 1MB, tối đa 200 dòng; dependency `read-excel-file` (API) và `qrcode` (web).
- Trạng thái: M2 đã có test tích hợp API (`classMembers.test.ts`) và E2E (`e2e/classes.spec.ts`).
<!-- Haihs: tài liệu M2 (lớp học) - end -->

<!-- Haihs: tài liệu M3-M8 - start -->
## Đề mẫu, ca thi, làm bài, kết quả (M3–M8)
- Giáo viên: `/teacher/templates` (đề mẫu, thùng rác, tạo đề từ file bằng Gemini — cần API key của chính giáo viên), `/teacher/sittings` (ca thi: mã `/ca/<mã>`, QR, lớp, quyền vào ca, kết quả, chấm tự luận, công bố, xuất Excel).
- Học sinh: `/sittings` (ca của tôi, nhập mã), `/ca/:mã` → phòng thi `/ca/:mã/room` → `/ca/:mã/result` khi giáo viên đã công bố.
- Bảo mật: đáp án/giải thích/rubric không bao giờ có trong câu hỏi gửi cho học sinh; điểm tính ở server; nộp trùng bị chặn bằng unique index; route upload dùng cùng kiểm tra `tokenVersion` với các route khác.
- Biến môi trường tùy chọn: `TEMPLATE_TRASH_DAYS`, `EXAM_CACHE_TTL_MS`, `ESSAY_UPLOAD_*`, `ESSAY_MEDIA_*`, `HTTPS_PROXY` (gọi Gemini qua proxy). Tạo secret: `node scripts/generate-secrets.mjs`.
- Chạy một instance duy nhất (cache đề, rate limit và semaphore upload nằm trong RAM).
- Trạng thái: M3–M8 đã có test tích hợp API và E2E (xem `docs/handoff/2026-11-13-m3-m8.md`).
<!-- Haihs: tài liệu M3-M8 - end -->
