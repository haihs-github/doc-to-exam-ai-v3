<!-- Created by Haihs on 22/11/2026 -->
<!-- Design doc ngắn: artifact xem trước giao diện sidebar + khung "Tạo đề từ file (AI)" ở giữa. Trạng thái: Draft (chờ người dùng duyệt artifact). -->
# Thiết kế: artifact xem trước sidebar + nút AI trung tâm

Trạng thái: **Draft**. Chưa sửa code app; chỉ làm artifact để người dùng xem và duyệt.

## Ý định
"Tạo đề từ file (AI)" là chức năng chính của giáo viên nhưng hiện là nút nhỏ ở trang Đề mẫu. Người dùng muốn nút to, ở giữa, và đưa các mục menu sang sidebar. Trước khi sửa app, cần một bản xem trước bấm được để duyệt.

## Quyết định của người dùng (22/11/2026)
- Sidebar trái cố định cho giáo viên và học sinh đã đăng nhập; trang Đề mẫu có khung AI lớn ở giữa phía trên danh sách.
- Giữ thanh trên xanh mỏng (logo, tên, đổi theme); menu chuyển sang sidebar. Khách (About/Đăng nhập/Đăng ký) vẫn dùng thanh trên, không sidebar.
- Điện thoại: sidebar thành menu trượt (hamburger).
- Yêu cầu quy trình: subagent một việc một con, không commit/push khi chưa hỏi, không E2E, hỏi bằng bảng khi cần quyết định.

## Lựa chọn của tôi (người dùng chưa quyết)
- Artifact là prototype HTML một file, vanilla JS, dữ liệu mẫu tiếng Việt, không gọi API.
- Thanh điều khiển nổi (không thuộc app) chọn: Web / Điện thoại (khung 390px), vai trò (Khách / Giáo viên / Học sinh), Sáng / Tối, danh sách trang để nhảy nhanh.
- Trang bên trong giữ nội dung, chữ, chức năng như app hiện tại; chỉ khác phần khung (sidebar) và khung AI ở Đề mẫu.
- Chức năng thật nặng (AI phân tích, upload) mô phỏng bằng tiến trình giả.

## Không làm
Không đổi hành vi app, không thêm tính năng mới ngoài sidebar và khung AI.

## Cách làm
Mỗi nhóm trang một file JS, ghép bằng build.sh thành một HTML. Bản đã duyệt mới đưa vào kế hoạch sửa app Angular.
