<!-- Created by Haihs on 23/11/2026 -->
<!-- Plan: áp dụng giao diện sidebar + khung AI (theo artifact đã duyệt) vào FE Angular. Nhánh haihs-fix/sua-giao-dien. -->
# Sidebar + khung AI cho FE Angular - Implementation Plan

> **For agentic workers:** dùng superpowers:subagent-driven-development; mỗi task một subagent.

**Goal:** đưa giao diện đã duyệt trong artifact (https://claude.ai/artifact/25tHEBE9jwp2Dt1qZxv9KL; nguồn prototype `/home/haihs/workspace/doc-to-exam-multi/ui-preview-sidebar/`, file `pages-*.js`, `style*.css`, `core.js`) vào `apps/web`.

**Architecture:** Thêm khung shell (thanh trên xanh mỏng + sidebar trái đóng/mở, menu trượt trên điện thoại) cho người dùng đã đăng nhập (trừ phòng thi `/ca/:code/room|done`, `/ca/:code` giữ như app); khách giữ thanh trên. Các trang giữ nguyên chức năng/chữ/route/service; chỉ đổi hình thức theo artifact. Chỉ đổi class/markup, không đổi hợp đồng API, `packages/contract`.

**Tech Stack:** Angular 22 standalone + signals + OnPush, Tailwind 3.4 (`tailwind.config.js`, `styles.css`), Vitest qua `ng test`.

**Spec:** `docs/superpowers/specs/2026-11-22-sidebar-ai-preview-design.md` (người dùng duyệt qua artifact 23/11/2026).

## Global Constraints
- Reply tiếng Việt. Nhánh `haihs-fix/sua-giao-dien`. KHÔNG commit/push khi chưa hỏi người dùng (AskUserQuestion).
- Giữ: chữ gốc 17px, ô/nút cao >=48px, xanh #1a67a3, thanh trên xanh đặc, bo góc nhỏ, bóng mỏng, light + dark (`dark:`), vùng chạm >=44px dưới 768px (đây là 'mobile' của app; artifact dùng container query, FE dùng breakpoint Tailwind `md:`).
- KHÔNG đổi hành vi, route, chữ tiếng Việt, API công khai (input/output/model), service, hợp đồng. Không thêm tính năng ngoài: sidebar, khung AI, nút Lưu cố định + Lên đầu trang ở trình soạn đề, nút chức năng hiện đủ trên web, bố cục thi/kết quả mới.
- WF-DEV-14: không xóa code, chỉ comment `Haihs: <lý do> - start|end`; file mới có `Created by Haihs on 23/11/2026`; chạy `python3 -I ~/.claude/scripts/check_comment_convention.py`.
- Test: chỉ unit, từ thư mục gốc: `flock /tmp/doc-to-exam-ng.lock scripts/limited.sh npm test -w apps/web -- --include 'src/app/<glob>'`; build `scripts/limited.sh npm run build -w apps/web`; lint `scripts/limited.sh npm run lint`. Không chạy toàn bộ cùng lúc, không E2E. Giao diện do người dùng tự xem.
- Test được viết lại truy vấn theo DOM mới nhưng KHÔNG xóa assertion, KHÔNG giảm số test. Không dùng subagent trong subagent.

## Review Focus
- Sidebar: Esc/focus/aria, trạng thái thu gọn nhớ trong phiên, không che nội dung ở <768px.
- Trang `/ca/:code/room`, done không có sidebar; `/ca/:code/result` có.
- Điện thoại: không có cuộn ngang trang; chữ không bẻ từng ký tự.
- Dark mode không mất tương phản ở mọi trang sửa.
- Web: nút chức năng hiện đủ, ⋮ chỉ trên điện thoại (ActionMenu dùng lại).

---
### Task 0: Khung shell (sidebar + thanh trên + thanh cuộn overlay)
**Files:** Modify `apps/web/src/app/app.ts`, `shared/ui/navbar.ts`, `styles.css`, `app.spec.ts`, `shared/ui/navbar.spec.ts`; Create `shared/ui/sidebar.ts` (+ spec), một service/signal nhỏ giữ `collapsed` nếu cần.
**Interfaces:** Produces: component `<app-sidebar>` (mục theo vai trò lấy đúng nhãn/route từ navbar hiện tại: GV Đề mẫu/Ca thi/Lớp học; HS Ca thi của tôi/Lớp của tôi; chung Đổi mật khẩu, Gemini API Key (GV), Đăng xuất) và layout `app.ts` (khách: chỉ navbar; đăng nhập: navbar + sidebar; phòng thi: như hiện tại).
- [ ] Viết test: sidebar đúng mục theo vai trò; nút thu gọn đổi `aria-expanded`; khách không có sidebar; Đăng xuất giữ confirm cũ.
- [ ] Implement theo artifact (`core.js` `renderSidebar`, `style.css` khối sidebar/overlay scrollbar). Thanh cuộn: CSS ẩn thanh gốc + thanh trượt mảnh phủ (nếu cần JS, giữ nhỏ trong sidebar/app shell) cho vùng chính.
- [ ] Chạy test spec của task, build, lint. Báo cáo `scratchpad/fe-t0-report.md`.

### Task 1: Đề mẫu + trình soạn đề
**Files:** `pages/teacher-templates.ts`, `pages/template-editor.ts`, `shared/ui/questions-editor.ts` (+ spec liên quan).
- Khung AI lớn giữa trang trên danh sách, nút "Tạo đề từ file (AI)" to (không icon sparkles), mô tả + định dạng hỗ trợ; hành vi upload cũ giữ nguyên.
- Web: Sửa/Tạo bản sao/Xóa (tab Đã xoá: Khôi phục/Xóa vĩnh viễn) hiện đủ; ⋮ chỉ <768px.
- Trình soạn đề: nút "Lưu đề mẫu"/"Lưu thay đổi" dưới Bảng đáp án và điều hướng (web) + nút Lên đầu trang (hiện khi cuộn >300px); điện thoại: nhóm nút nổi. Nút "U" thành "Gạch chân" có title/aria-label, hiện khi hover/focus trên web.
- [ ] Test viết lại + test mới cho nút Lưu cố định và Lên đầu. Chạy spec task, build.

### Task 2: Ca thi giáo viên
**Files:** `pages/teacher-sittings.ts`, `sitting-create.ts`, `sitting-editor.ts`, `teacher-sitting-detail.ts`, `shared/ui/sitting-*.ts`.
- Thẻ ca thi: tiêu đề full, mô tả, nhãn trạng thái to hàng dưới tiêu đề; nút Xem chi tiết/Sửa/Xóa bên PHẢI thẻ trên web; điện thoại xếp chồng + ⋮. Bộ lọc: ô trạng thái dài bằng ô lọc lớp. Không tràn ngang ở phone.
- [ ] Test, build.

### Task 3: Lớp học giáo viên
**Files:** `pages/teacher-classes.ts`, `teacher-class-detail.ts`, `shared/ui/class-*.ts`, `student-modals.ts`, `temp-password-modal.ts`.
- Nút hiện đủ trên web (danh sách lớp, tab học sinh), nhãn "Đang học/Chờ duyệt" to dưới tiêu đề; header/tab điện thoại không cắt chữ.
- [ ] Test, build.

### Task 4: Học sinh + phòng thi
**Files:** `pages/my-sittings.ts`, `my-classes.ts`, `my-class-detail.ts`, `sitting-entry.ts`, `exam-room.ts`, `exam-success.ts`, `sitting-result.ts`.
- Thiết kế lại hình thức: vào ca (thẻ 4 ô thông tin, dòng "01 lần duy nhất" riêng), phòng thi (đồng hồ viên, vạch tiến độ, đáp án thẻ chọn lớn, bảng câu hỏi nút 44px), nộp xong, kết quả (điểm tổng lớn + thanh tiến độ + thống kê). Giữ logic exam-room (chống gian lận, đồng hồ, upload tự luận) KHÔNG đổi.
- [ ] Test, build.

### Task 5: Trang công khai + chống tràn ngang toàn app
**Files:** `pages/about.ts`, `login.ts`, `register.ts`, `change-password.ts`, `join-class.ts`, `session-error.ts`, `placeholders.ts`.
- Chỉ chỉnh để khớp khung mới và không tràn ngang điện thoại (bảng About cuộn trong thẻ).
- [ ] Test, build.

### Task 6: Review + kiểm tổng
- [ ] Reviewer độc lập đọc toàn diff (spec + chất lượng), comment-checker, rồi chạy tuần tự: từng nhóm spec (shared/ui, pages, root, core, utils), build, lint. Báo người dùng xem giao diện (đường dẫn) và hỏi trước khi commit.
