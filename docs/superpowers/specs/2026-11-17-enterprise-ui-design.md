<!-- Created by Haihs on 17/11/2026 -->
<!-- Design doc: đổi toàn bộ giao diện sang phong cách enterprise utilitarian (OpenProject/Jira/Redmine). Trạng thái: Draft. -->
# Thiết kế: giao diện enterprise utilitarian

Trạng thái: **Draft** (chờ người dùng duyệt). Thay thế mục tiêu cũ "giống hệt bản gốc về giao diện" cho phần hình thức; hành vi, chữ tiếng Việt và API giữ nguyên.

## Ý định và lý do

Người dùng muốn giao diện gọn, dày thông tin, ít trang trí như OpenProject/Jira/Redmine (ảnh tham chiếu: danh sách "Assigned to me", panel bộ lọc mở/đóng, trang chi tiết có breadcrumb + tiêu đề + thanh trạng thái, dropdown chọn nhiều giá trị). Hiện tại giao diện rộng và mềm: chữ gốc 17px, ô nhập và nút cao tối thiểu 48px, màu tím, thẻ padding lớn.

## Mục tiêu

- Một ngôn ngữ thiết kế thống nhất cho **mọi trang, kể cả phòng thi** (`exam-room`), đăng nhập/đăng ký và About.
- Mật độ cao trên máy tính; trên màn hình nhỏ giữ vùng chạm ≥ 44px.
- Danh sách dữ liệu đổi sang **bảng dày** (cột rõ, sắp xếp theo cột, phân trang dưới, panel bộ lọc mở/đóng).
- Giữ và làm lại **dark mode** theo palette mới.

## Không làm (non-goals)

- Không đổi hành vi, luồng nghiệp vụ, API, hợp đồng `packages/contract`, văn bản tiếng Việt.
- Không thêm tính năng kiểu OpenProject chưa có (sidebar view đã lưu, baseline, kéo thả cột...).
- Không chạy E2E; người dùng tự xem giao diện.

## Anti-goals (coi là thất bại dù test qua)

- Học sinh trên điện thoại khó bấm đáp án/nộp bài vì nút quá nhỏ.
- Hai bộ phong cách trộn lẫn (trang mới cạnh trang cũ).
- Mất tương phản/dark mode hỏng ở trang nào đó.

## Quyết định của người dùng (17/11/2026)

| Mục | Quyết định |
|---|---|
| Khung trang | Chỉ thanh trên có menu ngang (kiểu Jira/Redmine), không sidebar |
| Màu chủ đạo | Xanh dương OpenProject: thanh trên ~#1A67A3, link xanh, nút tạo mới xanh lá, trạng thái dùng chấm màu |
| Mật độ | Dày trên máy tính (chữ ~14px, ô/nút ~32px); màn hình nhỏ giữ vùng chạm 44px |
| Phạm vi | Tất cả, kể cả phòng thi |
| Cách triển khai | Nền trước, trang sau (đợt 0 token → đợt 1 khung + component chung → đợt 2 các nhóm trang) |
| Dark mode | Giữ, làm lại theo palette mới |
| Danh sách | Đổi tất cả sang bảng |
| Sửa test | Được viết lại truy vấn/role theo DOM mới, nhưng giữ nguyên hành vi được kiểm: không xóa assertion, không giảm số test |
| Sắp xếp, lọc | Chỉ đổi hình thức: giữ đúng các bộ lọc hiện có, trình bày trong panel mở/đóng; không thêm sắp xếp, toán tử, bộ lọc hay đổi API |
| Học sinh, phòng thi | Bảng trên máy tính, dòng xếp chồng (thẻ gọn, vùng chạm 44px) trên điện thoại; phòng thi giữ dạng danh sách đáp án/bảng câu hỏi hiện tại, chỉ đổi màu và kiểu chữ |

### Lựa chọn của tôi (người dùng chưa quyết, có thể sửa)

- Alias `violet/indigo/sky/blue` trỏ về palette xanh mới: mọi điểm nhấn tím thành xanh.
- Màu trạng thái gắn theo trạng thái thật của ca thi và bài nộp; chọn màu cụ thể khi làm và báo lại người dùng.
- Không thêm chuông thông báo (chưa có tính năng); nút tạo mới chỉ hiện ở trang có hành động tạo thật.
- Chỉ đổi `font-size` gốc `html`; rà giá trị px/rem cố định trong component khi làm đợt 0/1.
- Không có ngưỡng chấp nhận hồi quy hình ảnh tự động; người dùng xem bằng mắt sau mỗi đợt.

## Cách tiếp cận đã cân nhắc

1. **Nền trước, trang sau (đã chọn):** đổi token, rồi khung trang và component chung, rồi chia nhóm trang cho nhiều subagent. Đồng nhất, ít lặp; hai đợt đầu phải xong trước.
2. Từng trang làm trọn: dễ lệch và xung đột file dùng chung.
3. Chỉ đổi token: rẻ nhưng không đạt bố cục bảng/bộ lọc.

## Hiện trạng liên quan

- Token ở `apps/web/tailwind.config.js` (palette `brand`/`ink`, `primary/sky/blue/violet/indigo` đều trỏ về `brand`, bo góc, đổ bóng, font Be Vietnam Pro) và `apps/web/src/styles.css` (`.btn*`, `.card`, `.input`, `.page-header`, `.badge`...). Đổi token tại đây lan ra toàn app.
- Phần lớn style còn lại là class Tailwind viết thẳng trong ~45 component/trang (`apps/web/src/app/pages/*`, `shared/ui/*`), khoảng 20.800 dòng. Các file lớn nhất: `questions-editor.ts` (1851), `exam-room.ts` (999), `teacher-sitting-detail.ts` (904), `class-students-tab.ts` (842), `sitting-results-panel.ts` (826), `about.ts` (714), `teacher-templates.ts` (647).
- Có sẵn component dùng được: `Select`, `SearchSelect` (nhiều giá trị chip như ảnh dropdown Assignee cần kiểm tra), `Pager`, `ActionMenu`, `Icon`, modal chung, `ThemeToggle`, `Navbar`.
- Unit test hiện 449 test/56 file; nhiều test truy vấn theo role/text, ít theo class, nhưng một số có thể bám class (cần rà khi đổi).

## Thiết kế

### Đợt 0: token (một subagent)
- Palette: `primary` xanh OpenProject (thang 50–900), `accent-green` cho nút tạo mới, màu trạng thái (new, in-progress, confirmed, resolved, closed → chấm màu), màu loại (bug đỏ, feature xanh, task xám xanh) dùng lại cho nhãn trạng thái ca thi/bài nộp. Tách `primary` khỏi alias cũ (`sky/blue/violet/indigo` hiện đều là `brand`): giữ alias trỏ về palette mới để không vỡ class đang dùng.
- Kích thước: `html` 14px (cỡ chữ gốc), `--control-h` 32px, `--nav-h` ~48px; dưới breakpoint nhỏ (<768px) `--control-h` 44px và chữ 16px. Bo góc nhỏ (2–3px), bóng tối giản, đường kẻ 1px.
- Cập nhật `.btn*`, `.input`, `.card`, `.card-header`, `.badge`, `.page-header`, `.page-title`, `.container-fluid`, `.row-hover`, `.empty-state`; thêm `.table-dense`, `.filter-panel`, `.status-dot`, `.type-label`, `.breadcrumb`, `.toolbar`.
- Dark mode: palette tối riêng (nền ~#1b2430/#222c38 thay vì đen thuần), kiểm tương phản AA.
- `:focus-visible` xanh, rõ; checkbox/radio `accent-color` đổi theo.

### Đợt 1: khung trang và component chung (các subagent, mỗi con một component)
- **Khung/`Navbar`:** thanh trên đặc màu xanh, logo trái, menu ngang theo vai trò (giáo viên: Đề mẫu / Ca thi / Lớp học; học sinh: Ca của tôi / Lớp của tôi), ô tìm kiếm giữa (nếu chưa có chức năng thì không thêm), phải: nút tạo mới xanh lá (nếu có hành động tạo mới), thông báo/tài khoản, đổi theme. Mobile: menu thu gọn.
- **Bố cục trang:** breadcrumb + tiêu đề + thanh công cụ phải (Create, Filter, menu ⋮) như ảnh; nền trắng, nội dung rộng.
- **Bảng dày** (`table-dense`): header đậm nhỏ, hàng ~32px, hover, cột hành động (`ActionMenu`), phân trang dưới (giữ `Pager` hiện có), trạng thái rỗng; <768px chuyển thành dòng xếp chồng. Không thêm sắp xếp theo cột.
- **Panel bộ lọc:** khối mở/đóng trình bày các bộ lọc hiện có theo hàng `nhãn | giá trị` (dựa trên `Select`/`SearchSelect`), nút đóng/bỏ lọc. Không thêm toán tử hay bộ lọc mới.
- **Form/ô nhập/nút/chip/badge/modal/alert/skeleton:** theo token mới, kiểu chữ nhỏ gọn.
- **Nhãn trạng thái/loại:** chấm màu + chữ, thay badge tròn lớn.

### Đợt 2: nhóm trang (mỗi nhóm một subagent, không đụng file nhóm khác)
1. Đăng nhập, đăng ký, đổi mật khẩu, About, join-class.
2. Đề mẫu (`teacher-templates`, `template-editor`) và `questions-editor` (file lớn, tách riêng).
3. Ca thi giáo viên (`teacher-sittings`, `sitting-create`, `sitting-editor`, `teacher-sitting-detail` + panel lịch, grants, kết quả, submission modal).
4. Lớp học giáo viên (`teacher-classes`, `teacher-class-detail` + các tab học sinh/giáo viên/mời/import, modal học sinh).
5. Phía học sinh (`my-sittings`, `my-classes`, `my-class-detail`, `sitting-entry`, `sitting-result`, `exam-success`).
6. Phòng thi (`exam-room`): đổi hình thức, giữ vùng chạm 44px ở mọi kích thước, người dùng duyệt riêng.

### Quy trình và ràng buộc thi công
- **Kế hoạch trước khi sửa:** plan viết theo `superpowers:writing-plans`, người dùng duyệt rồi mới làm.
- **Subagent:** mỗi con một nhiệm vụ riêng, tự đọc brief và file của mình; sau mỗi nhiệm vụ một reviewer độc lập (spec + chất lượng) để tránh thiên vị; cuối cùng một review toàn nhánh. Mọi prompt giao việc phải kèm đủ "Quy ước comment chi tiết" (WF-DEV-14).
- **Test:** chỉ unit test, chạy từng nhóm riêng qua `scripts/limited.sh` (giới hạn RAM/CPU), không chạy song song, không E2E. Kiểm giao diện bằng mắt do người dùng làm: sau mỗi đợt tôi báo "xem trang X" kèm đường dẫn.
- **Quy ước code:** không xóa code, chỉ comment (`Haihs: <lý do> - start|end`); chạy `python3 -I ~/.claude/scripts/check_comment_convention.py`.
- **Git:** không tự commit/push; hỏi trước mỗi lần (AskUserQuestion).
- **Quyết định mới phát sinh:** hỏi bằng AskUserQuestion, không tự quyết.

## Giao cho người xây dựng quyết định (đánh dấu là lựa chọn của tôi)

- Tên và giá trị cụ thể của thang màu xanh/xanh lá/trạng thái (theo ảnh OpenProject, tinh chỉnh khi kiểm tương phản).
- Chiều cao thanh trên, độ rộng tối đa nội dung.
- Thư viện bảng: không thêm thư viện, dùng `<table>` + class Tailwind (Ponytail).
- Font: giữ Be Vietnam Pro (hỗ trợ tiếng Việt tốt) trừ khi người dùng muốn đổi sang Roboto/Noto như OpenProject.

## Rủi ro

- Test unit bám class/cấu trúc DOM sẽ vỡ khi đổi markup; sửa test cùng nhiệm vụ, không sửa hành vi.
- `questions-editor.ts` (1851 dòng) và `exam-room.ts` (999) lớn, dễ lệch phong cách; đã tách nhiệm vụ riêng.
- Đổi cỡ chữ gốc 17px → 14px ảnh hưởng mọi `rem`; kiểm tra trang dùng `rem` cứng.
- Mật độ cao + màn hình nhỏ: bảng dày phải có chế độ xếp chồng.
