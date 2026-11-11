<!-- Created by Haihs on 11/11/2026 -->
<!-- Project overview: how to run dev and resource limits. -->
# doc-to-exam-ts

Monorepo (npm workspaces `apps/*`, `packages/*`): Next.js API + Angular SPA.

## Chạy dev

```bash
nvm use          # Node 22
npm install
npm run dev      # chạy apps/api và apps/web
```

Scripts gốc: `lint`, `test:api`, `test:web`, `build`, `dev`.

## Giới hạn tài nguyên (D9)

Lệnh test/build/install nặng chạy qua `scripts/limited.sh <lệnh>` (2 CPU, 3GB RAM, không swap). Chạy từng nhóm test, không chạy song song.

## Ngoại lệ quy ước header

<!-- đóng code cũ: `package.json`, `package-lock.json` và các file JSON khác không mang header `Created by Haihs` vì JSON không hỗ trợ comment (người dùng đã duyệt 11/11/2026). -->
`package.json`, `package-lock.json` và các file JSON thuần (không comment được) miễn header `Created by Haihs` (người dùng đã duyệt 11/11/2026); `tsconfig*.json` (JSONC) có header. <!-- Haihs: tsconfig*.json nay có header - start - end -->
`apps/web/src/index.html` giữ `<!doctype html>` ở dòng 1, header đặt ngay sau (tránh quirks mode; người dùng đã duyệt 11/11/2026). <!-- Haihs: ghi nhận ngoại lệ index.html - start - end -->
