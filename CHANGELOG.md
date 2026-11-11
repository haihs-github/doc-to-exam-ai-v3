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
