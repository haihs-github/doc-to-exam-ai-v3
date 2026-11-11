# Doc to Exam AI — bản TypeScript (Next.js API + Angular SPA)

Trạng thái: **Accepted** (người dùng duyệt 11/11/2026) — 11/11/2026

## 1. Mục đích
Viết lại app `ts_doc_to_exam_ai` (Express + React, JS) thành bản mới hoàn toàn bằng TypeScript: **Next.js làm API backend**, **Angular làm SPA riêng**. Thư mục nguồn chỉ để đọc, không sửa. Mục tiêu là tương đương hành vi (parity) với CODE hiện tại, không phải với README.

Chi tiết hành vi nguồn (đã khảo sát, là tài liệu tham chiếu bắt buộc cho người lập kế hoạch):
- `docs/research/2026-11-11-backend-inventory.md` (model, ~endpoint, quy tắc nghiệp vụ, milestone backend M0–M13)
- `docs/research/2026-11-11-frontend-inventory.md` (route, 21 trang, component/utils, Tailwind token, milestone frontend M0–M11)

## 2. Quyết định của người dùng (đã chốt)
| # | Quyết định |
|---|---|
| D1 | Phạm vi: parity đầy đủ, chia nhiều milestone |
| D2 | Next.js = chỉ API (Route Handlers); Angular = SPA riêng gọi REST `/api`; hai app trong một monorepo |
| D3 | MongoDB + Mongoose như bản gốc (in-memory Mongo cho dev/test) |
| D4 | Angular mới nhất (standalone components + signals) + Tailwind (tái dùng config/`index.css`/token màu của bản React) |
| D5 | Test: Vitest cho API, test runner mặc định của Angular, Playwright cho E2E |
| D6 | Mỗi lần chạy test giới hạn **2 CPU, 3GB RAM**, chạy từng nhóm, không chạy cả bộ cùng lúc |
| D7 | Song song tối đa **2 worktree** (api / web); mỗi task nhỏ một commit; một agent riêng merge |
| D8 | Tự luận **chỉ chấm tay** (theo code). Gemini chỉ dùng cho `POST /api/templates/parse`. Không làm chấm AI |
| D9 | Triển khai **một instance `next start`** trên máy chủ Node; giữ trạng thái RAM (cache đề 20s, cache role, rate limit, semaphore upload) như nguồn. Không serverless, không multi-instance (ghi vào README) |
| D10 | **Chuẩn hóa lỗi API** về `{success:false, code, message, data?}` (kể cả route upload và các 409). Test nguồn khi port phải chỉnh theo dạng này |
| D11 | Port test nguồn (server ~62 file, client ~40 file) sang TypeScript làm đặc tả hành vi, viết test trước (TDD) |
| D12 | Database **mới hoàn toàn**, không cần tương thích dữ liệu/hash/mã hóa của app cũ (model vẫn port sát nguồn) |
| D13 | Angular và API **cùng origin qua reverse proxy**: không CORS; link/QR dùng `window.location.origin`; dev dùng proxy của Angular |
| D14 | UI giống bản React về **hành vi + bố cục + chữ tiếng Việt** (giữ thông báo/nhãn và key draft), không đối chiếu pixel; E2E kiểm bằng role/text, không so ảnh |

**Các điểm do người viết tự quyết (chưa được người dùng duyệt riêng, hãy kiểm tra):**
- Khóa Gemini vẫn **theo từng giáo viên** (mã hóa, `PUT /auth/api-key`, `requireApiKey`), đúng parity D1.
- Test API gọi **thẳng Route Handler bằng `Request`** + in-memory Mongo (nhẹ, hợp D6); chỉ vài test smoke chạy qua `next start` thật cho giới hạn upload/timeout/IP rate limit.
- D10: **giữ nguyên mã HTTP status** của nguồn (413, 415, 422, 408, 503...), chỉ đổi dạng body; các lý do upload chi tiết (`heic_not_supported`, `content_mismatch`...) giữ làm giá trị `code`.
- `sweepUnattachedMedia`/`healMediaAttachment` **không lên lịch** như nguồn (chỉ TTL index của Mongo dọn dữ liệu).

## 3. Goals / Non-goals / Anti-goals
**Goals**: tương đương hành vi code nguồn; an toàn như nguồn (ẩn đáp án trước khi công bố, 404 cho lớp không thuộc quyền, token/khóa/mật khẩu tạm được bảo vệ, tính đúng đắn đồng thời bằng thao tác Mongo nguyên tử).
**Non-goals**: chấm tự luận bằng AI; fullscreen / device fingerprint / zip (nguồn không có); Redis; serverless; SSR của Next cho giao diện; đổi sang PostgreSQL.
**Anti-goals** (coi là thất bại dù test xanh): lộ `correctAnswer/explanation/rubric` trước công bố; nộp trùng hoặc mất điểm do "đọc rồi ghi" không nguyên tử; route upload bỏ qua kiểm `tokenVersion`/`mustChangePassword`; test làm treo máy.

## 4. Ràng buộc
- Node 22, npm workspaces. Máy 8 core / 15GB nhưng đang dùng ~6GB: mọi lệnh test qua wrapper giới hạn (D6).
- Quy ước người dùng: comment truy vết `Haihs:` (WF-DEV-14), không xóa code chỉ ẩn bằng comment, Conventional Commits, spec/plan trong `docs/superpowers/`, CHANGELOG, handoff, hạ tầng test + CI + lint ngay milestone đầu.
- Hỏi lại người dùng (AskUserQuestion) cho mọi quyết định chưa rõ, dù nhỏ.

## 5. Kiến trúc (các lựa chọn của người viết — người dùng chưa duyệt từng cái)
- **Cấu trúc**: `apps/api` (Next.js App Router, chỉ `app/api/**/route.ts`, `runtime = 'nodejs'`), `apps/web` (Angular), `packages/contract` (chỉ TypeScript types + mã lỗi dùng chung để hai worktree làm song song không lệch; không có logic).
- Tách tầng trong `apps/api/src`: `routes handlers` mỏng → `services` (nghiệp vụ) → `models` (Mongoose). Middleware nguồn thành hàm bọc handler (`withAuth`, `withPermission`, `withRateLimit`), **dùng chung một hàm xác thực** cho cả route upload.
- Mongoose connection singleton an toàn với hot reload; Gemini qua `@google/generative-ai`; upload multipart bằng Web `Request.formData()`/stream có giới hạn kích thước sớm, magic-bytes, chống docx zip-bomb (xem backend inventory §5).
- Angular: standalone + signals, `HttpInterceptor` (Bearer, 401, `MUST_CHANGE_PASSWORD`, apiActivity), guard theo role, typed API client dùng `packages/contract`. Dropdown/DateTime tự viết cần port đủ bàn phím/a11y; các cơ chế "chỉ kết quả mới nhất thắng" cần giữ bằng RxJS (`switchMap`) hoặc signals + test.
- Dev: Angular proxy `/api` → cổng API. Production: hai tiến trình hoặc reverse proxy; cách đóng gói cụ thể để builder đề xuất.

## 6. Quy trình & milestone
Kế hoạch (writing-plans) gộp hai đề xuất milestone trong inventory thành các **lát dọc**, mỗi lát có việc API và việc Angular chạy song song ở 2 worktree:
- **M0 Nền móng**: monorepo, CI, lint/format, wrapper giới hạn tài nguyên, helper test (in-memory Mongo), smoke test API + web + Playwright, `apiResponse`/lỗi chuẩn, Tailwind theme + utils thuần có test vàng.
- **M1 Tài khoản**: User/Role/RBAC, JWT, `/api/auth`; Login/Register/ChangePassword + UI kit cơ bản.
- **M2 Lớp & học sinh**: Class/ClassMember, mời, import CSV/XLSX, reset mật khẩu.
- **M3 Đề mẫu**: CRUD, thùng rác, nhân bản, validation câu hỏi, tách đề Gemini.
- **M4 Ca thi (giáo viên)**: ExamSitting, mã ca, overlap, grants.
- **M5 Làm bài trắc nghiệm** (học sinh): session, đảo đề, chấm mcq, chống nộp trùng, ExamRoom + anti-cheat.
- **M6 Tự luận**: upload/media, chấm tay, chấm lại + `essayStale`.
- **M7 Công bố, kết quả, xuất xlsx**.
- **M8 Hoàn thiện**: a11y, responsive 375/1024/1280, E2E luồng giáo viên + học sinh, vận hành (seed, secrets).
Thứ tự có thể điều chỉnh khi lập plan, nhưng phải có luồng end-to-end trắc nghiệm sớm (đến hết M5).

Vai trò agent (mỗi agent một việc, context riêng): nghiên cứu · viết test (TDD, từ test nguồn + spec) · implementer · reviewer (spec compliance, rồi chất lượng) · `comment-checker` · merge. Không tin báo cáo suông: đòi output test và `file:line`.

## 7. Để lại cho người lập kế hoạch
Chọn phiên bản cụ thể (Next, Angular, Tailwind 3.4 hay mới hơn — hỏi người dùng nếu đổi), thư viện validation, cách đóng gói/triển khai hai app, chia nhỏ task trong từng milestone, định dạng chính xác của `code` lỗi (liệt kê trong `packages/contract`).

## 8. Quyết định bổ sung (M1 — Tài khoản), 11/11/2026
Người dùng đã chốt qua AskUserQuestion:
| # | Quyết định |
|---|---|
| D15 | M1 làm parity auth ĐẦY ĐỦ: giáo viên + học sinh (đăng ký/đăng nhập), RBAC, đủ bucket rate limit, UI auth (Login/Register/ChangePassword/ApiKey) |
| D16 | `connectDb` có fallback MongoDB in-memory cho dev/E2E (như nguồn); production luôn tắt (giữ quy tắc M0: `ALLOW_IN_MEMORY_DB` chỉ có nghĩa ở development/test) |
| D17 | JWT lưu `localStorage['auth_token']` + header `Authorization: Bearer` như nguồn (rủi ro XSS được ghi nhận) |
| D18 | M0 chưa merge vào `main`; chỉ merge sau khi xong tất cả milestone (người dùng chốt) |
| D19 | Prettier chỉ áp cho file MỚI từ M1; file M0 giữ nguyên dòng cũ (đã chốt khi hoàn tác format M0) |

Các lựa chọn của người viết (chưa duyệt riêng): rate limit trong RAM tự viết (D9 một instance) với đủ bucket trong backend inventory §1.4; `TRUST_PROXY` đọc từ env (production mặc định 1 hop, dev 0) để lấy IP; `instrumentation.ts` gọi `loadEnv()` + `connectDb()` + `seedRbac()` lúc khởi động (fail-fast, chỉ runtime nodejs, không chạy trong `next build`); CSP/header bảo mật cho SPA đặt ở reverse proxy (API chỉ đặt `nosniff`, `Cache-Control: no-store` cho auth); sửa M0 trong M1: `HttpError` bắt buộc có `message`, `readJson` có trần byte (413 `PAYLOAD_TOO_LARGE`).
