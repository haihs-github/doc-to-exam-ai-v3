<!-- Created by Haihs on 11/11/2026 -->
<!-- Changelog theo Keep a Changelog 1.1.0 và SemVer. -->
# Changelog

## [Unreleased]

### Added
- Khung monorepo npm workspaces (`apps/*`, `packages/*`).
<!-- Haihs: entry M0 kèm commit hash - start -->
- Cấu hình công cụ gốc: wrapper giới hạn tài nguyên `scripts/limited.sh` (2 CPU/3GB), cấu hình ESLint/Prettier (`5caf6ba`, `06193b5`).
- `packages/contract`: kiểu lỗi/response chung `ErrorCode`, `ApiError`, `ApiOk`, `isApiError` (`8c2ba53`, `a60f928`, `6b93c43`).
- `apps/api`: scaffold Next.js, `GET /api/health`, helper test (`e4ca35a`).
- `apps/api`: `apiResponse`, `HttpError`, `withErrors` (`95a3442`).
- `apps/api`: env có kiểm tra và kết nối Mongo singleton `connectDb` (`aad094f`, `4ceaf66`).
- `apps/api`: `/api/health` trả envelope `ok()` của contract (D10) (`3dc2836`).
- `apps/web`: scaffold Angular + Tailwind 3.4 + theme (`c5a5021`).
- `apps/web`: `ApiClient`, `errorMessage` tiếng Việt, utils dùng chung (`a8f7bc4`).
- `apps/web`: trang chủ hiển thị tiêu đề và trạng thái API health, hủy subscription khi destroy (`5bd630a`, `5eb22c8`).
<!-- Haihs: M0 changelog: thay tên commit bằng hash thật, đổi tên job e2e - start -->
<!-- đóng code cũ -->
<!-- - Smoke E2E Playwright (Chromium, 1 worker, tự khởi động API + web) `e2e/smoke.spec.ts` và `playwright.config.ts` (commit `chore: CI, smoke E2E, tài liệu M0`). -->
<!-- - CI GitHub Actions: job lint, test-api, test-web, build, e2e-smoke, audit (`npm audit --audit-level=high`) (cùng commit trên). -->
- Smoke E2E Playwright (Chromium, 1 worker, tự khởi động API + web) `e2e/smoke.spec.ts` và `playwright.config.ts` (`f2c8d26`).
- CI GitHub Actions: job lint, test-api, test-web, build, e2e, audit (`npm audit --audit-level=high`) (`f2c8d26`).
- Merge các nhánh M0 và sửa lỗi sau merge: `a9be4c6`, `082cdb4`, `f601422` (merge); `5c0b306`, `4ceaf66`, `80088d3`, `3dc2836`, `6941bc2` (api); `3a2be71`, `2d2ece2`, `5eb22c8`, `0afaaf4`, `a084b43` (web/README).
<!-- Haihs: M0 changelog: thay tên commit bằng hash thật, đổi tên job e2e - end -->
- `packages/contract`: `npm test`, script gốc `test:contract` và bước CI (`bdd259e`); script `format`/`format:check` và bước CI `format:check` (`201bda9`).
- README: hướng dẫn chạy dev, test qua `scripts/limited.sh`, giới hạn một instance (D9), same-origin (D13).

<!-- Haihs: changelog M2 (lớp học) - start -->
### M2 — Lớp và học sinh (chưa chạy test: theo yêu cầu "native", test dồn về cuối)
- `packages/contract`: kiểu lớp/thành viên/mời/import, 8 mã lỗi lớp, `normalizePhone` dùng chung (`0cb2cb3`).
- `apps/api`: plugin soft-delete, `Class`, `ClassMember`, `toUpperVi` (`59a023e`, `aadc321`); `withClassPermission` (404 cho người ngoài lớp), CRUD/khôi phục lớp (`772e6d8`); link mời + `POST /api/classes/join` (`02d94da`); quản lý học sinh, đặt lại mật khẩu, quản lý giáo viên, `/api/me/classes`, import CSV/XLSX (commit native cuối nhánh `m2/api`).
- `apps/web`: `ClassesApi`, tiện ích lớp (`dec05d5`), UI kit Pager/Skeleton/ActionMenu/QR/Select (`37d0281`, `5e986c8`), danh sách lớp giáo viên với 3 tab (`f50f269`, `abd3175`), chi tiết lớp + tab học sinh/giáo viên/mời + import + mật khẩu tạm, trang học sinh Join/MyClasses/MyClassDetail (`a869929`).
- `e2e/classes.spec.ts`: luồng lớp (viết, chưa chạy).
<!-- Haihs: changelog M2 (lớp học) - end -->

### Changed
- Bỏ `.nvmrc`, dùng `engines.node >=22` (`06193b5`, `052a4a7`); README sửa theo.
- CI: quyền `contents: read`, timeout, concurrency, đổi tên job e2e, cấu hình Playwright, ignore `apps/api/AGENTS.md` (`8b97c41`).
- `apps/web`: `npm test` chạy `ng test --watch=false`, giới hạn 2 worker Vitest qua `vitest.config.mts` (`bdd259e`).
- `apps/api`: secret dev/test sinh ngẫu nhiên theo process; `NODE_ENV` khác `development`/`test` theo luật production (`65b9b13`).
- Prettier áp dụng toàn repo, `.prettierignore`, `apps/web/.prettierrc` chuyển YAML, header cho `tsconfig.json` (`e30bb15`, `201bda9`).
- `apiResponse` dùng `satisfies`, README (D6), `npm run dev` dọn tiến trình khi Ctrl-C (`2455d51`).

### Reverted
- Hoàn tác format Prettier toàn repo (`201bda9`) và bước CI `format:check` theo quyết định người dùng: Prettier chỉ áp từ M1; giữ script `format` thủ công và header `tsconfig.json` (`e6f2d47`).

### Fixed
- `connectDb` không còn rò MongoClient khi driver tự reconnect (`0b84bc9`).
<!-- Haihs: entry M0 kèm commit hash - end -->

<!-- Haihs: mục M1 tách khỏi vùng M0 ở trên (không lồng cặp marker) - start -->
### M1 (chưa phát hành): tài khoản, xác thực

### Added
- M1 plan (14 task) và đánh dấu Accepted (`803759a`, `beeef6e`); spec §8 quyết định bổ sung M1: parity auth, DB in-memory dev, localStorage, merge sau cùng (`1a14520`).
- `packages/contract`: kiểu auth (`AuthUser`, `RegisterBody`, `LoginBody`...), mã lỗi auth, `HttpError` bắt buộc message, `readJson` có trần byte (`67c2a64`, `595efe1`).
- `apps/api`: rate limit RAM tự viết, `clientIp`, header bảo mật, bộ giới hạn theo route (`4881f06`, `c6b8149`).
- `apps/api`: fallback MongoDB in-memory cho dev/E2E (`f505274`, `14a7eab`).
- `apps/api`: `secureField` AES-GCM và `passwordHash` bcrypt có cổng đồng thời (`b0903bb`, `5c478e7`).
- `apps/api`: model `User`, `Role`, RBAC, `seedRbac` (`c980d34`, `673c0f1`).
- `apps/api`: JWT thu hồi được, `withAuth`/`withPermission`/`withApiKey` (`f3feddc`, `d1144be`).
- `apps/api`: đăng ký/đăng nhập giáo viên và học sinh (`bc77208`, `75df3c0`).
- `apps/api`: `GET /api/auth/me`, `PUT /api/auth/api-key`, `POST /api/auth/logout-all`, `POST /api/auth/change-password`, `instrumentation.ts` fail-fast khi cấu hình production sai (`3b17dc1`, `6d8f6f6`, `55f37f2`, `1666202`, `4dee7eb`).
- `apps/web`: router, tiện ích auth thuần, token store (`951091a`, `ac7a99d`); `AuthService`, interceptor, guard (`315f307`, `cc652d0`).
- `apps/web`: UI kit tối thiểu cho auth (`320774d`, `21782d2`); trang Login/Register/ChangePassword/SessionError và app shell (`1e872c6`, `41e1ac2`).
- `apps/web`: trang About, `ApiKeyModal`, gắn `app-api-health` (`d4b8cc1`, `07019e2`).
- E2E auth `e2e/auth.spec.ts` (`6cb0930`), smoke chuyển sang `/about` (`aedad7b`), env E2E cho API và timeout 240s (`9a60dfe`), CI cache binary MongoDB (`904aa96`).
- README M1 (`c4a6299`), `.env.example` (`68b597b`), About mô tả DB dev (`70d0b0d`); handoff `docs/handoff/2026-11-12-m1.md`.
- Merge m1/api và m1/web (`e8decd3`, `f261009`).

### Changed
- `apps/api`: `withErrors` generic, bổ sung test `parsePage`/`call` (nợ M0) (`5aa23c6`).
- Prettier áp lên 3 file M1 (`apps/api/src/models/User.ts`, `auth-rules.ts` và spec) (`e250cbe`).

### Fixed
- `apps/web`: mất phiên hoặc bị buộc đổi mật khẩu giữa chừng tự điều hướng (`SessionNavigation`) (`acae001`); lỗi server `geminiApiKey` hiện dưới ô ở trang đăng ký giáo viên (`64eefd6`).
- Test ghim cờ `count`/`refund5xx` từng bucket rate limit (`257c3b1`); marker CHANGELOG/.env.example/User.ts (`24a0f42`); ghi chú đóng TODO (`20a8aa9`); E2E API key không lộ (`36305d2`).
- `mongodb-memory-server` thành devDependency (`3e1621f`); CI cache binary trước `npm ci` (`0a507c5`).
<!-- Haihs: mục M1 tách khỏi vùng M0 ở trên (không lồng cặp marker) - end -->
