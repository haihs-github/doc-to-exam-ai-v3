<!-- Created by Haihs on 17/11/2026 -->
<!-- Plan: đổi toàn bộ giao diện web sang enterprise utilitarian, chia nhiệm vụ cho subagent. -->
# Enterprise UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi toàn bộ giao diện `apps/web` sang phong cách enterprise utilitarian (OpenProject/Jira/Redmine), giữ nguyên hành vi, API và chữ tiếng Việt.

**Architecture:** Nền trước, trang sau. T0 đổi token Tailwind/CSS; T1 thêm class dùng chung (bảng dày, bộ lọc, breadcrumb, trạng thái); T2–T4 khung trang và component chung; T5–T12 các nhóm trang, mỗi nhóm một subagent sở hữu file riêng; T13 rà soát cuối. Chỉ dùng class Tailwind + CSS trong `styles.css`, không thêm thư viện.

**Tech Stack:** Angular 22 standalone + signals, Tailwind 3.4, Vitest qua `ng test`.

**Spec:** `docs/superpowers/specs/2026-11-17-enterprise-ui-design.md`

## Global Constraints

- Phong cách: thanh trên đặc màu xanh ~#1A67A3 + menu ngang (không sidebar); link xanh; nút tạo mới xanh lá; trạng thái dạng chấm màu + chữ; bo góc 2–3px; đường kẻ 1px; font giữ Be Vietnam Pro.
- Mật độ: máy tính chữ gốc 14px, ô nhập/nút cao ~32px, thanh trên ~48px; màn hình < 768px chữ 16px, ô/nút/vùng chạm ≥ 44px.
- Mọi danh sách dữ liệu là bảng dày trên máy tính, dòng xếp chồng (thẻ gọn) trên < 768px. Không thêm sắp xếp cột, toán tử, bộ lọc mới, không đổi API/contract.
- Panel bộ lọc chỉ trình bày lại các bộ lọc hiện có (hàng `nhãn | giá trị`, mở/đóng).
- Giữ dark mode, làm lại theo palette mới, tương phản AA.
- Phòng thi (`exam-room`): chỉ đổi màu và kiểu chữ, giữ danh sách đáp án/bảng câu hỏi hiện tại, vùng chạm ≥ 44px ở mọi kích thước.
- Hành vi, luồng, văn bản tiếng Việt giữ nguyên. Không thêm chuông thông báo; nút tạo mới chỉ hiện ở trang có hành động tạo thật.
- Test: chỉ unit test của file mình sở hữu, chạy từng nhóm qua `scripts/limited.sh`, không song song, không E2E. Được viết lại truy vấn/role theo DOM mới nhưng không xóa assertion, không giảm số test.
- Quy ước code (WF-DEV-14): không xóa code, chỉ comment (`Haihs: <lý do> - start|end`); file mới có header `Created by Haihs on dd/mm/yyyy`; chạy `python3 -I ~/.claude/scripts/check_comment_convention.py` trước khi báo xong. Prompt giao việc phải kèm đủ "Quy ước comment chi tiết".
- Git: subagent KHÔNG commit/push. Controller hỏi người dùng (AskUserQuestion) trước mỗi lần commit hoặc push.
- Quyết định mới phát sinh: dừng và báo controller để hỏi người dùng, không tự quyết.
- Lệnh test mẫu (chạy ở thư mục gốc repo): `scripts/limited.sh npm test -w apps/web -- --include 'src/app/shared/ui/navbar.spec.ts'` (mỗi lần một spec hoặc một nhóm nhỏ của nhiệm vụ mình).

## Review Focus

- Chữ gốc 14px làm các `rem` cố định tụt cỡ: kiểm tra ở T0/T13 bằng grep `text-\[`/`min-h-\[`/`rem` (có 18 file dùng).
- Bảng dày trên < 768px bị tràn ngang: mỗi bảng có chế độ xếp chồng, không cuộn ngang trang.
- Dark mode thiếu `dark:` ở class mới: mỗi nhiệm vụ kiểm cả hai theme.
- Vùng chạm < 44px ở < 768px (đặc biệt phòng thi, đáp án, nút nộp bài).
- Test bám class/DOM cũ vỡ sau khi đổi markup.

## Thứ tự và quy tắc song song

T0 → T1 → (T2, T3, T4 song song vì khác file) → (T5–T12 song song vì khác file; chạy test tuần tự) → T13. Các nhiệm vụ cùng chạm `styles.css` (T0, T1) chạy tuần tự; sau T1, nhiệm vụ khác không sửa `styles.css`/`tailwind.config.js`, cần class mới thì báo controller. Mỗi nhiệm vụ có một reviewer độc lập (spec + chất lượng); cuối cùng review toàn nhánh bằng model mạnh nhất.

---

### Task 0: Token (màu, cỡ, bo góc, đổ bóng)

**Files:**
- Modify: `apps/web/tailwind.config.js`, `apps/web/src/styles.css` (khối `@layer base` và các class component hiện có), `apps/web/src/index.html` (chỉ nếu cần đổi meta/theme-color)
- Test: `apps/web/src/app/theme.spec.ts`

**Interfaces:**
- Produces: thang `primary` xanh OpenProject (50–900), `success` xanh lá (nút tạo mới), `status.{new,progress,confirmed,resolved,closed}` và `type.{bug,feature,task}` trong `theme.extend.colors`; alias `sky/blue/violet/indigo` trỏ về `primary`; biến CSS `--nav-h` (~3rem), `--control-h` (2rem; 2.75rem dưới 768px); `html` font-size 14px (16px dưới 768px); các class `.btn .btn-primary .btn-secondary .btn-danger .btn-ghost .card .card-header .input .badge .page-header .page-title .container-fluid .row-hover .empty-state .link-accent .section-band` cập nhật theo token, cả light và `dark:`.

- [ ] **Step 1: Test.** Trong `theme.spec.ts` thêm test `theme tokens` đọc `tailwind.config.js` và khẳng định: `primary[700]` tồn tại, `violet` và `indigo` bằng `primary`, `success[600]` tồn tại. (Nếu spec hiện đọc kiểu khác, giữ kiểu đó.)
- [ ] **Step 2:** chạy `scripts/limited.sh npm test -w apps/web -- --include 'src/app/theme.spec.ts'`, thấy test mới FAIL.
- [ ] **Step 3:** đổi `tailwind.config.js`: palette mới, alias, `borderRadius` nhỏ, `boxShadow` mỏng, giữ `fontFamily`. Đổi `styles.css`: `html` 14px/16px theo breakpoint, `input/select/textarea/button` dùng `var(--control-h)`, outline focus xanh, `accent-color` xanh, scrollbar, và các class ở Interfaces. Dark: nền xanh đen (~#1b2430 / #222c38), chữ sáng, AA.
- [ ] **Step 4:** chạy lại `theme.spec.ts` PASS; chạy `scripts/limited.sh npm run build -w apps/web` thành công.
- [ ] **Step 5: Báo cáo** liệt kê token mới và các `rem`/px cố định phát hiện (grep) để các nhiệm vụ sau xử lý. Không commit.

### Task 1: Class dùng chung cho bảng, bộ lọc, breadcrumb, trạng thái

**Files:**
- Modify: `apps/web/src/styles.css` (khối `@layer components`)
- Create: `apps/web/src/app/shared/ui/filter-panel.ts`, `apps/web/src/app/shared/ui/filter-panel.spec.ts`
- Test: `filter-panel.spec.ts`

**Interfaces:**
- Consumes: token từ T0.
- Produces (class trong `styles.css`): `.breadcrumb`, `.toolbar`, `.table-dense` (+ `th/td`, `.col-actions`, `.table-dense[data-stack]` xếp chồng dưới 768px với `td[data-label]`), `.filter-panel`, `.filter-row` (nhãn | giá trị), `.status-dot` + modifier `.is-new .is-progress .is-confirmed .is-resolved .is-closed`, `.type-label` + `.is-bug .is-feature .is-task`.
- Produces (component): `FilterPanel` selector `app-filter-panel`, `open = model<boolean>(false)`, `toolbarLabel = input<string>('Bộ lọc')`, `count = input<number>(0)`; nội dung chiếu (`<ng-content/>`); nút toggle `aria-expanded` bind `open`, hiển thị `count` cạnh nhãn; nút đóng × có `aria-label="Đóng bộ lọc"`.

- [ ] **Step 1: Test** `filter-panel.spec.ts`: (a) mặc định đóng, nội dung không render; (b) click nút toggle → `open()` true, nội dung hiện, `aria-expanded="true"`; (c) `count=2` hiện "2"; (d) nút × đóng lại.
- [ ] **Step 2:** chạy spec, FAIL.
- [ ] **Step 3:** viết `FilterPanel` (OnPush, `@if (open())`) và các class CSS ở Interfaces (light + dark).
- [ ] **Step 4:** chạy `filter-panel.spec.ts` PASS, `ng build` OK.
- [ ] **Step 5: Báo cáo** kèm đoạn markup mẫu cho bảng (`table-dense`, `data-stack`, `data-label`) và `status-dot` để T5–T12 dùng. Không commit.

### Task 2: Khung trang và Navbar

**Files:**
- Modify: `apps/web/src/app/shared/ui/navbar.ts`, `apps/web/src/app/app.ts`, `apps/web/src/app/shared/ui/theme-toggle.ts`
- Test: `navbar.spec.ts`, `theme-toggle.spec.ts`, `app.spec.ts`

**Interfaces:**
- Consumes: token và `.breadcrumb/.toolbar` từ T0–T1.
- Produces: thanh trên đặc màu `primary`, logo trái, menu ngang theo vai trò (giáo viên: Đề mẫu / Ca thi / Lớp học; học sinh: Ca của tôi / Lớp của tôi; khách: Đăng Nhập / Đăng Ký như hiện có), cuối: đổi theme + menu tài khoản; mobile < 768px: nút mở menu thu gọn, mục ≥ 44px. `<main id="main">` nền trắng/tối theo theme, `container-fluid`.

- [ ] **Step 1: Test** cập nhật `navbar.spec.ts` theo markup mới: khách thấy "Đăng Nhập"/"Đăng Ký" với `href` đúng; giáo viên thấy 3 mục menu đúng chữ và `routerLink`; học sinh thấy 2 mục; mobile có nút `aria-label` mở menu. Giữ toàn bộ assertion hành vi cũ.
- [ ] **Step 2:** chạy `navbar.spec.ts`, FAIL ở chỗ markup đổi.
- [ ] **Step 3:** viết lại template Navbar (giữ logic/service), bọc code cũ bằng comment theo quy ước; sửa `app.ts` chỉ phần bao `main` nếu cần.
- [ ] **Step 4:** chạy riêng `navbar.spec.ts`, `theme-toggle.spec.ts`, `app.spec.ts` PASS.
- [ ] **Step 5: Báo cáo.** Không commit.

### Task 3: Điều khiển dùng chung

**Files:**
- Modify: `shared/ui/select.ts`, `search-select.ts`, `datetime-picker.ts`, `datetime-field.ts`, `score-combobox.ts`, `password-field.ts`, `form-field.ts`, `pager.ts`, `action-menu.ts`, `skeleton.ts`, `api-progress.ts`, `scroll-to-top.ts`, `qr-code.ts` (trong `apps/web/src/app/shared/ui/`)
- Test: spec cùng tên của các file trên

**Interfaces:**
- Consumes: token + class T0–T1. Không đổi `input()/output()/model()` công khai.
- Produces: ô chọn/ô nhập/menu/pager hiển thị dày (cao `var(--control-h)`), dropdown nhiều chip kiểu ảnh tham chiếu (chip xanh nhạt có ×), vùng chạm ≥ 44px dưới 768px.

- [ ] **Step 1:** với mỗi component, nếu spec bám class cũ thì cập nhật truy vấn sang role/text; không bỏ assertion.
- [ ] **Step 2:** sửa style theo token mới (light + dark).
- [ ] **Step 3:** chạy từng spec một (hoặc nhóm ≤ 3 spec) qua `scripts/limited.sh`; tất cả PASS.
- [ ] **Step 4: Báo cáo.** Không commit.

### Task 4: Modal và thông báo dùng chung

**Files:**
- Modify: `shared/ui/alert-modal.ts`, `confirm-modal.ts`, `api-key-modal.ts`, `class-restore-code-modal.ts`, `temp-password-modal.ts`, `upload-lost-notice.ts`, `formatted-text.ts`
- Test: `confirm-modal.spec.ts`, `api-key-modal.spec.ts`, `class-restore-code-modal.spec.ts`, `alert.service.spec.ts`, `modal-stack.spec.ts`

**Interfaces:**
- Consumes: token + class T0–T1. Không đổi API công khai/service.
- Produces: modal gọn (tiêu đề nhỏ, đường kẻ, nút dày), nền mờ nhẹ, `.btn-*` mới, dark OK.

- [ ] **Step 1–3:** như T3 (cập nhật test nếu bám class, sửa style, chạy từng spec). 
- [ ] **Step 4: Báo cáo.** Không commit.

### Task 5: Đăng nhập, đăng ký, đổi mật khẩu, About, tham gia lớp

**Files:**
- Modify: `pages/login.ts`, `register.ts`, `change-password.ts`, `about.ts`, `join-class.ts`, `session-error.ts`, `form-helpers.ts` (nếu chỉ chứa class)
- Test: `login.spec.ts`, `register.spec.ts`, `change-password.spec.ts`, `about.spec.ts`, `session-error.spec.ts`, `form-helpers.spec.ts`

**Interfaces:** Consumes T0–T3. Giữ nguyên route/hành vi/chữ. About: giữ nội dung và ảnh minh họa, đổi hình thức theo token mới.

- [ ] **Step 1–3:** như T3; mỗi trang kiểm light + dark và < 768px (vùng chạm ≥ 44px).
- [ ] **Step 4: Báo cáo** kèm đường dẫn để người dùng xem: `/about`, `/login`, `/register`, `/teacher/login`, `/teacher/register`, `/change-password`, `/join`. Không commit.

### Task 6: Đề mẫu

**Files:**
- Modify: `pages/teacher-templates.ts`, `pages/template-editor.ts`
- Test: không có spec riêng; nếu đổi logic bắt buộc thì thêm; ngoài ra chạy `app.routes.spec.ts`.

**Interfaces:** Consumes T0–T4. Danh sách đề mẫu và thùng rác ("Đã xoá") thành `table-dense` có `data-stack`; panel bộ lọc dùng `FilterPanel` cho đúng các bộ lọc hiện có; breadcrumb + tiêu đề + toolbar; trạng thái bằng `status-dot`.

- [ ] **Step 1–3:** sửa template, giữ nguyên handler/logic; chạy `app.routes.spec.ts` và `ng build`.
- [ ] **Step 4: Báo cáo** kèm đường dẫn `/teacher/templates`. Không commit.

### Task 7: Trình soạn câu hỏi

**Files:** Modify: `shared/ui/questions-editor.ts` (1851 dòng). Test: không spec riêng; `ng build` + spec của `sitting-editor` nếu có tham chiếu.

**Interfaces:** Consumes T0–T4. Sidebar "Bảng đáp án và điều hướng", underline helpers, banner "Cần xác nhận loại câu hỏi", chế độ "Xem như học sinh" giữ nguyên hành vi; đổi hình thức: toolbar dày, ô nhập `--control-h`, màu theo token.

- [ ] **Step 1–3:** đổi class, không đụng logic `remember/underline/markEssay`; `ng build`.
- [ ] **Step 4: Báo cáo.** Không commit.

### Task 8: Ca thi giáo viên – danh sách, tạo, soạn, lịch, quyền

**Files:** Modify: `pages/teacher-sittings.ts`, `sitting-create.ts`, `sitting-editor.ts`, `shared/ui/sitting-schedule-panel.ts`, `sitting-grants-tab.ts`. Test: `app.routes.spec.ts`, spec của các file nếu có.

**Interfaces:** Consumes T0–T4. Danh sách ca thi thành bảng dày (mã, tên, lớp, trạng thái bằng `status-dot`, giờ, hành động `ActionMenu`) + `FilterPanel` cho bộ lọc lớp/trạng thái hiện có + `Pager`.

- [ ] **Step 1–3:** như T6; chạy spec liên quan từng cái; `ng build`.
- [ ] **Step 4: Báo cáo** kèm `/teacher/sittings`, `/teacher/sittings/new`. Không commit.

### Task 9: Ca thi giáo viên – chi tiết, kết quả, chấm điểm

**Files:** Modify: `pages/teacher-sitting-detail.ts`, `shared/ui/sitting-results-panel.ts`, `sitting-submission-modal.ts`. Test: spec liên quan nếu có (`score-combobox.spec.ts` thuộc T3, không sửa ở đây).

**Interfaces:** Consumes T0–T4. Trang chi tiết kiểu OpenProject (tiêu đề + thanh trạng thái + khối thông tin), bảng kết quả thành `table-dense` có `data-stack`, panel công bố/xuất Excel gọn.

- [ ] **Step 1–3:** như T6; `ng build`.
- [ ] **Step 4: Báo cáo** kèm đường dẫn chi tiết ca thi. Không commit.

### Task 10: Lớp học giáo viên

**Files:** Modify: `pages/teacher-classes.ts`, `teacher-class-detail.ts`, `shared/ui/class-form.ts`, `class-students-tab.ts`, `class-teachers-tab.ts`, `class-invite-tab.ts`, `class-import-panel.ts`, `student-modals.ts`. Test: `teacher-classes.spec.ts`, `teacher-classes.route.spec.ts`, `class-form.spec.ts`.

**Interfaces:** Consumes T0–T4. Danh sách lớp, học sinh, giáo viên thành `table-dense`; bộ lọc học sinh (SearchSelect "Bỏ lọc") trong `FilterPanel`; form thêm học sinh vẫn nằm ngay trong tab.

- [ ] **Step 1–3:** như T6; chạy từng spec; `ng build`.
- [ ] **Step 4: Báo cáo** kèm `/teacher/classes`, `/teacher/classes/:id`. Không commit.

### Task 11: Phía học sinh

**Files:** Modify: `pages/my-sittings.ts`, `my-classes.ts`, `my-class-detail.ts`, `sitting-entry.ts`, `sitting-result.ts`, `exam-success.ts`. Test: spec liên quan nếu có; `app.routes.spec.ts`.

**Interfaces:** Consumes T0–T4. Danh sách thành bảng dày trên máy tính, thẻ gọn xếp chồng < 768px với vùng chạm ≥ 44px; trang kết quả giữ "Tổng điểm" và nút làm lại.

- [ ] **Step 1–3:** như T6; `ng build`.
- [ ] **Step 4: Báo cáo** kèm `/sittings`, `/classes`, `/ca/:mã`. Không commit.

### Task 12: Phòng thi

**Files:** Modify: `pages/exam-room.ts` (999 dòng). Test: spec liên quan nếu có; `ng build`.

**Interfaces:** Consumes T0–T4. Chỉ đổi màu và kiểu chữ theo token; giữ header/đồng hồ, bảng câu hỏi, danh sách đáp án, ô tự luận và nén ảnh; mọi nút/đáp án ≥ 44px ở mọi kích thước.

- [ ] **Step 1–3:** đổi class, không đụng logic `timeUp`/nộp bài/nén ảnh; `ng build`.
- [ ] **Step 4: Báo cáo** kèm `/ca/:mã/room`; người dùng duyệt riêng. Không commit.

### Task 13: Rà soát cuối

**Files:** Modify: chỉ file có lỗi phát hiện; không sửa `styles.css` trừ khi báo controller.

- [ ] **Step 1:** grep còn sót: `violet|indigo|brand-` trong template, `text-\[`, `min-h-\[48px\]`, `rem` cố định, class thiếu `dark:`; liệt kê và sửa theo nhóm nhiệm vụ gốc.
- [ ] **Step 2:** chạy toàn bộ unit test theo từng đợt (từng thư mục/nhóm spec một, qua `scripts/limited.sh`, không song song) — thấy đủ 449 test (hoặc nhiều hơn), 0 fail.
- [ ] **Step 3:** `scripts/limited.sh npm run build -w apps/web`, `scripts/limited.sh npm run lint`, `python3 -I ~/.claude/scripts/check_comment_convention.py` (bỏ qua nhiễu ngày header cũ).
- [ ] **Step 4: Báo cáo** tóm tắt cho người dùng, kèm danh sách đường dẫn cần xem bằng mắt (light, dark, rộng, hẹp). Hỏi người dùng trước khi commit hoặc push.
