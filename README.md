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

Scripts gốc: `lint`, `format`, `format:check`, `test:api`, `test:web`, `test:contract`, `build`, `dev`.

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
