# M0 Nền móng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo chạy được với API Next.js và SPA Angular rỗng, hạ tầng test/lint/CI, hợp đồng lỗi chung, và smoke test end-to-end, để các milestone sau chỉ thêm tính năng.

**Architecture:** npm workspaces: `packages/contract` (chỉ types), `apps/api` (Next.js App Router, chỉ `app/api/**/route.ts`, `runtime='nodejs'`), `apps/web` (Angular standalone + signals + Tailwind 3.4). Mọi test chạy qua `scripts/limited.sh`.

**Tech Stack:** Node 22, Next 16.4, Angular 22.2 (TypeScript theo peer-dependency của Angular, KHÔNG tự nâng lên 7.x nếu Angular không hỗ trợ — báo lại), Tailwind 3.4, Mongoose 9, Vitest 5 (API), runner mặc định Angular (web), Playwright 1.65, mongodb-memory-server 11, ESLint 10.

**Spec:** `docs/superpowers/specs/2026-11-11-doc-to-exam-ts-design.md`

## Global Constraints
- Quy ước comment WF-DEV-14: file mới có header `Created by Haihs on 11/11/2026` + 1 dòng vai trò (cú pháp comment của ngôn ngữ); sửa/ẩn code theo marker `Haihs: <lý do> - start|end`; không xóa code. File không hỗ trợ comment (JSON…) → báo lại, không tự bỏ qua. Cuối mỗi task chạy `python3 -I ~/.claude/scripts/check_comment_convention.py` (0 vi phạm).
- Mỗi lần chạy test bọc bằng `scripts/limited.sh` (2 CPU, 3GB RAM), chạy từng nhóm, không chạy cả bộ cùng lúc.
- Lỗi API: `{ success:false, code, message, data? }`; giữ mã HTTP status của nguồn (D10). Thành công: `{ success:true, data? , message? }` (dạng chính xác theo `server/utils/apiResponse.js` của nguồn, chỉ đọc).
- Một instance `next start`, cùng origin qua reverse proxy, không CORS (D9, D13). Database mới hoàn toàn (D12).
- Tailwind 3.4: copy `tailwind.config.js`, `postcss.config.js`, `src/index.css` từ `ts_doc_to_exam_ai/client` (chỉ đọc nguồn, không sửa).
- Giới hạn nội dung giữ khớp nguồn: 255/100/30 (`utils/limits`), múi giờ UTC+7 cố định.
- Commit Conventional Commits, kết thúc bằng dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Không thêm tính năng ngoài plan (Ponytail); không thêm dependency khi đã có sẵn.

## Review Focus
1. Body JSON hỏng hoặc rỗng gửi vào handler → `400 VALIDATION`, không `500`. (Task 5)
2. `page`/`limit` âm, `NaN`, chuỗi, quá lớn → `parsePage` kẹp về giá trị hợp lệ, không ném lỗi. (Task 5)
3. Lỗi bất ngờ trong handler → `500 INTERNAL`, message chung chung, KHÔNG lộ stack/chi tiết nội bộ. (Task 5)
4. Thiếu biến môi trường bắt buộc ở production → dừng ngay với thông báo rõ; ở dev tự sinh/bỏ qua có cảnh báo. (Task 6)
5. Hot reload không tạo nhiều kết nối Mongo (singleton); `ObjectId` sai định dạng → `404`/`400`, không crash. (Task 6)

---

## Luồng thực thi
Task 1–3 tuần tự trên `main`. Sau đó mở 2 worktree song song: **api** (Task 4–6) và **web** (Task 7–9). Task 10 làm sau khi merge cả hai. Agent riêng: implementer / test-writer độc lập / reviewer / `comment-checker` / merge.

### Task 1: Khung monorepo
**Files:** Create `package.json` (workspaces `apps/*`, `packages/*`), `.gitignore`, `.nvmrc` (`22`), `README.md` (chạy dev, giới hạn D9), `CHANGELOG.md` (Keep a Changelog, mục `[Unreleased]`), `.editorconfig`.
**Interfaces:** Produces: scripts gốc `lint`, `test:api`, `test:web`, `build`, `dev` (chạy 2 app).
- [ ] **Step 1:** Tạo các file trên; `.gitignore` gồm `node_modules`, `.next`, `dist`, `.angular`, `coverage`, `.env*` (trừ `.env.example`), `playwright-report`.
- [ ] **Step 2:** Chạy `npm install` ở gốc. Expected: thành công, tạo `package-lock.json` (commit lock file).
- [ ] **Step 3:** Commit `chore: khung monorepo npm workspaces`.

### Task 2: Wrapper giới hạn tài nguyên và lint
**Files:** Create `scripts/limited.sh`, `eslint.config.js`, `.prettierrc`, `tests/scripts/limited.test.sh`.
**Interfaces:** Produces: `scripts/limited.sh <lệnh...>` chạy lệnh trong `systemd-run --user --scope` với `MemoryMax=3G`, `MemorySwapMax=0`, `CPUQuota=200%`, và `NODE_OPTIONS=--max-old-space-size=2048`; trả nguyên exit code của lệnh. Nếu không có `systemd-run`, thoát mã 2 với thông báo (không âm thầm chạy không giới hạn).
- [ ] **Step 1:** Viết `limited.test.sh`: (a) `limited.sh true` thoát 0; (b) `limited.sh false` thoát 1; (c) chạy `node -e` cấp phát >3GB thoát khác 0 (bị OOM-kill) trong < 30s.
- [ ] **Step 2:** Chạy test, expected FAIL (chưa có script).
- [ ] **Step 3:** Viết `limited.sh` theo Interfaces. Thêm ESLint flat config cho TS (api, contract) — phần Angular dùng `angular-eslint` ở Task 7.
- [ ] **Step 4:** Chạy lại `bash tests/scripts/limited.test.sh`. Expected: 3/3 pass. Đo bằng `systemd-run` thật, ghi output vào commit body.
- [ ] **Step 5:** Commit `chore: wrapper giới hạn 2CPU/3GB cho test, cấu hình lint`.

### Task 3: Gói hợp đồng `packages/contract`
**Files:** Create `packages/contract/package.json` (`name: "@doc-to-exam/contract"`), `src/index.ts`, `src/errors.ts`, `tsconfig.json`; Test `packages/contract/tests/errors.test.ts`.
**Interfaces:** Produces:
`type ErrorCode = 'VALIDATION'|'UNAUTHENTICATED'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'RATE_LIMITED'|'PAYLOAD_TOO_LARGE'|'MUST_CHANGE_PASSWORD'|'REQUIRE_API_KEY'|'INTERNAL'` · `interface ApiError { success:false; code:ErrorCode; message:string; field?:string; data?:unknown }` · `interface ApiOk<T> { success:true; data:T; message?:string }` · `const HTTP_STATUS: Record<ErrorCode, number>` (400,401,403,404,409,429,413,403→`MUST_CHANGE_PASSWORD`=403,`REQUIRE_API_KEY`=400 theo nguồn — kiểm lại `middlewares/authMiddleware.js` của nguồn, 500) · `isApiError(x: unknown): x is ApiError`.
- [ ] **Step 1:** Test: `isApiError({success:false,code:'NOT_FOUND',message:'x'})` true; `isApiError({success:true})` false; `isApiError(null)` false; `HTTP_STATUS.CONFLICT === 409`; mọi `ErrorCode` có entry trong `HTTP_STATUS`.
- [ ] **Step 2:** Chạy `scripts/limited.sh npx vitest run --root packages/contract`; expected FAIL.
- [ ] **Step 3:** Implement theo Interfaces (xác minh mã status với nguồn, ghi `file:line` vào comment).
- [ ] **Step 4:** Chạy lại; expected PASS. Commit `feat(contract): kiểu lỗi/response chung`.

### Task 4 (worktree api): Scaffold API + hạ tầng test
**Files:** Create `apps/api/package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `app/api/health/route.ts`, `tests/helpers.ts`; Test `apps/api/tests/health.test.ts`.
**Interfaces:** Produces: `GET /api/health` → `200 {status:'OK',timestamp:string,service:'Doc to Exam AI Backend'}` (khớp nguồn). `tests/helpers.ts`: `startTestDb(): Promise<{uri:string; stop():Promise<void>}>` (mongodb-memory-server) và `call(handler: (req:Request)=>Promise<Response>, init?: {method?:string; url?:string; body?:unknown; headers?:Record<string,string>}): Promise<{status:number; body:any}>`.
- [ ] **Step 1:** Test `health.test.ts`: `call(GET, {url:'http://x/api/health'})` → status 200, `body.status==='OK'`, `body.service==='Doc to Exam AI Backend'`.
- [ ] **Step 2:** Run `scripts/limited.sh npm test -w apps/api`; expected FAIL.
- [ ] **Step 3:** Scaffold Next (không `create-next-app` kéo template UI; chỉ cần Route Handlers), `export const runtime='nodejs'` trong route. Vitest: `pool:'forks'`, `maxWorkers:2`, `fileParallelism:false`.
- [ ] **Step 4:** Run lại; expected PASS. Commit `feat(api): scaffold Next.js + /api/health + helper test`.

### Task 5 (worktree api): `apiResponse` và xử lý lỗi an toàn
**Files:** Create `apps/api/src/lib/apiResponse.ts`, `apps/api/src/lib/handler.ts`; Test `apps/api/tests/apiResponse.test.ts`, `apps/api/tests/handler.test.ts`.
**Interfaces:** Produces: `fail(code: ErrorCode, message: string, extra?: {field?:string; data?:unknown}): Response` (status theo `HTTP_STATUS`) · `ok<T>(data: T, init?: {status?:number; message?:string}): Response` · `parsePage(params: URLSearchParams, opts?: {defaultLimit?:number; maxLimit?:number}): {page:number; limit:number; skip:number}` · `pageResult<T>(items:T[], total:number, p:{page:number;limit:number}): {items:T[]; total:number; page:number; limit:number; totalPages:number}` · `toObjectId(v: unknown): Types.ObjectId | null` · `readJson(req: Request): Promise<unknown>` (ném `HttpError('VALIDATION')` khi hỏng/rỗng) · `class HttpError extends Error {code: ErrorCode; extra?}` · `withErrors(h: (req: Request, ctx: any) => Promise<Response>): (req: Request, ctx: any) => Promise<Response>` (bắt `HttpError` → `fail`, lỗi khác → `500 INTERNAL` message `'Lỗi máy chủ'`, log phía server).
Hành vi chi tiết bám `server/utils/apiResponse.js` của nguồn (chỉ đọc).
- [ ] **Step 1:** Viết test (test-writer độc lập, từ test nguồn `server/tests/*apiResponse*` nếu có + Review Focus): `readJson` với body `'{bad'` → ném VALIDATION; `withErrors` với handler ném `new Error('secret stack')` → status 500, body `{success:false,code:'INTERNAL',message:'Lỗi máy chủ'}` và JSON KHÔNG chứa `'secret'`/`'stack'`; `parsePage(?page=-3&limit=abc)` → `{page:1, limit:defaultLimit}`; `limit=99999` → kẹp `maxLimit`; `toObjectId('zzz')` → `null`; `toObjectId` hợp lệ trả ObjectId; `pageResult` tính `totalPages=Math.ceil(total/limit)`, `total=0` → `totalPages=0`.
- [ ] **Step 2:** Run (`limited.sh`); expected FAIL.
- [ ] **Step 3:** Implement theo Interfaces.
- [ ] **Step 4:** Run; expected PASS. Commit `feat(api): apiResponse, HttpError, withErrors`.

### Task 6 (worktree api): Env và kết nối Mongo singleton
**Files:** Create `apps/api/src/lib/env.ts`, `apps/api/src/lib/db.ts`, `apps/api/.env.example`; Test `apps/api/tests/env.test.ts`, `apps/api/tests/db.test.ts`.
**Interfaces:** Produces: `loadEnv(src: Record<string,string|undefined> = process.env): Env` với `Env {nodeEnv:'development'|'test'|'production'; mongodbUri:string; jwtSecret:string; apiKeyEncryptionSecret:string; teacherSecretKey:string; allowInMemoryDb:boolean}`; production thiếu bất kỳ secret nào → ném `Error` liệt kê tên biến thiếu (không in giá trị). Dev: chỉ cảnh báo/bỏ qua theo `server/config/env.js` của nguồn. · `connectDb(): Promise<typeof mongoose>` (singleton lưu trên `globalThis` chống nhân đôi khi hot reload).
- [ ] **Step 1:** Test: production thiếu `JWT_SECRET` → throw, message chứa `JWT_SECRET`, không chứa giá trị secret khác; dev rỗng → không throw; `connectDb()` gọi 2 lần trả cùng instance và `mongoose.connections.length` không tăng (dùng `startTestDb`).
- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Implement (đọc `server/config/env.js`, `config/db.js` của nguồn; `ALLOW_IN_MEMORY_DB` chỉ cho dev).
- [ ] **Step 4:** Run; expected PASS. Commit `feat(api): env có kiểm tra, kết nối Mongo singleton`.

### Task 7 (worktree web): Scaffold Angular + Tailwind 3.4 + theme
**Files:** Create `apps/web/` (Angular CLI standalone, strict, SCSS không cần), `tailwind.config.js`, `postcss.config.js`, `src/styles.css`, `proxy.conf.json` (`/api` → `http://localhost:3000` cổng API), `src/app/app.ts`, `src/app/theme.ts`; Test `src/app/theme.spec.ts`.
**Interfaces:** Produces: `applyTheme(mode: 'light'|'dark'|'system'): void` (đặt class `dark` trên `<html>`; đọc/ghi `localStorage` trong try/catch) và script inline trong `index.html` áp theme TRƯỚC khi vẽ (tránh nháy); lấy logic từ `client/src/components/ThemeToggle` + `applyTheme` của nguồn.
- [ ] **Step 1:** Test: `applyTheme('dark')` thêm class `dark`; `'light'` bỏ class; `'system'` theo `matchMedia`; `localStorage` ném lỗi → không crash.
- [ ] **Step 2:** `scripts/limited.sh npm test -w apps/web -- --watch=false`; expected FAIL.
- [ ] **Step 3:** Scaffold bằng Angular CLI (không thêm routing/UI lib thừa), cài Tailwind **3.4** rồi copy 3 file cấu hình từ nguồn; giữ alias màu (`primary/sky/blue/violet/indigo`→brand, `gray/slate`→ink); cài `angular-eslint`, nối vào `eslint.config.js` gốc.
- [ ] **Step 4:** Run test; expected PASS. `npm run build -w apps/web` thành công. Commit `feat(web): scaffold Angular + Tailwind 3.4 + theme`.

### Task 8 (worktree web): HTTP client và utils chéo
**Files:** Create `apps/web/src/app/core/api-client.ts`, `core/api-errors.ts`, `shared/utils/{limits,date-format,retry}.ts`; Tests tương ứng `*.spec.ts` (port từ `client/tests/*` của nguồn: `limits`, `dateFormat`, `retry`, `apiErrors`).
**Interfaces:** Produces: `ApiClient` (inject `HttpClient`): `get<T>(url:string, params?:Record<string,string|number>): Observable<T>`, `post<T>`, `put<T>`, `delete<T>` — tự unwrap `ApiOk<T>.data`; lỗi → ném `ApiError` (từ `@doc-to-exam/contract`; body không đúng dạng → `{code:'INTERNAL'}`). · `errorMessage(e: unknown): string` (tiếng Việt, port `apiErrors`). · `LIMITS` (255/100/30 khớp nguồn), `formatVn(date: Date|string): string` (UTC+7), `retry` theo nguồn (`RETRYABLE_STATUSES`).
- [ ] **Step 1:** Test-writer độc lập port test nguồn sang Angular runner (đổi sang Vitest API mặc định); thêm: `ApiClient.get` với lỗi `{success:false,code:'NOT_FOUND',...}` ném `ApiError`; body HTML/null → `INTERNAL`.
- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Port/implement; `file:line` nguồn ghi trong comment.
- [ ] **Step 4:** Run; expected PASS. Commit `feat(web): ApiClient, errorMessage, utils chéo`.

### Task 9 (worktree web): Vỏ ứng dụng rỗng + smoke
**Files:** Modify `apps/web/src/app/app.ts`, `app.html`; Test `app.spec.ts`.
**Interfaces:** Produces: trang chủ hiển thị `Doc to Exam AI` và trạng thái API (gọi `ApiClient.get('/api/health')`, hiển thị `OK` hoặc thông báo lỗi tiếng Việt).
- [ ] **Step 1:** Test: mock `ApiClient` trả `{status:'OK'}` → màn hình có text `OK`; trả lỗi → có thông báo lỗi (không crash).
- [ ] **Step 2–4:** Run FAIL → implement → run PASS. Commit `feat(web): vỏ ứng dụng + kiểm tra sức khỏe API`.

### Task 10 (sau merge): CI, Playwright smoke, tài liệu
**Files:** Create `.github/workflows/ci.yml`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `docs/handoff/2026-11-11-m0.md`; Modify `CHANGELOG.md`, `README.md`.
**Interfaces:** Consumes: `/api/health`, trang chủ Angular.
- [ ] **Step 1:** `e2e/smoke.spec.ts`: mở `http://localhost:4200` (proxy tới API), thấy `Doc to Exam AI` và `OK`. Playwright chạy `workers:1`, qua `limited.sh`, Chromium một browser.
- [ ] **Step 2:** Chạy; expected FAIL khi API tắt, PASS khi bật cả hai (`npm run dev`).
- [ ] **Step 3:** CI: lint, `test:api`, `test:web`, build, e2e smoke (từng job riêng, cache npm, `npm audit --audit-level=high`).
- [ ] **Step 4:** Cập nhật CHANGELOG (entry kèm commit hash), viết handoff, chạy `comment-checker` trên toàn bộ diff M0. Commit `chore: CI, smoke E2E, tài liệu M0`.

---
## Self-review
- Spec §6 M0: monorepo ✔(T1), CI ✔(T10), lint ✔(T2/T7), wrapper tài nguyên ✔(T2), helper test ✔(T4), smoke ✔(T4/T9/T10), `apiResponse`/lỗi chuẩn ✔(T5), Tailwind theme ✔(T7), utils ✔(T8, giảm phạm vi — ghi trong roadmap).
- Tên dùng chéo nhất quán: `ErrorCode`, `ApiError`, `ApiOk`, `HTTP_STATUS`, `ApiClient`, `startTestDb`, `call`.
- Điểm cần xác minh với nguồn khi thực thi (không đoán): mã status của `MUST_CHANGE_PASSWORD`/`REQUIRE_API_KEY`, hình dạng chính xác của `ok()`.
