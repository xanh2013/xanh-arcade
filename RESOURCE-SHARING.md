# Chia sẻ CPU máy admin

Sau triển khai, mở `/account` trên máy admin, đăng nhập, bấm **Chia sẻ CPU máy này**. Không cần vào phòng. Giữ trang mở và máy không ngủ. Worker nhận tác vụ tìm đường cho các trận Battle, Zombie, Fortnite online; không có tác vụ phù hợp thì mức đóng góp bằng 0. Solo cục bộ không gửi mô phỏng lên máy chủ.

Bấm **Dừng máy này** để dừng máy đóng góp. **Tắt hỗ trợ tài nguyên** tắt toàn hệ thống. Đóng trang/mất kết nối: máy chủ hết hạn quyền nhận tác vụ sau 8 giây; tác vụ tìm đường hết hạn sau 1,8 giây và game luôn có xử lý dự phòng. Phiên admin được máy chủ xác nhận lại qua cơ chế tài khoản hiện có trên mỗi lệnh admin.

Sửa lỗi: số thứ tự SSE bị dùng nhầm như thời gian ping; kết quả tìm đường vượt giới hạn 2 KB; tác vụ chạy trên luồng vẽ; tác vụ hết hạn không được dọn. Bây giờ dùng Worker riêng, hàng đợi có giới hạn và payload kết quả tối đa 64 KB. Ngừng giao quyết định va chạm đạn sang trình duyệt: sát thương được tính trên máy chủ, tránh xuyên tường hoặc mất kiểm tra va chạm khi chờ kết quả.

Mục tiêu lịch chạy là 45 ms tính toán mỗi giây trên một luồng. Một tác vụ đang chạy không thể bị ngắt giữa chừng nên đây không phải trần CPU toàn máy. Số ms tính toán không phải % sử dụng CPU của hệ điều hành. Byte/s là dữ liệu tác vụ, không phải băng thông RAM. Dung lượng RAM trong bảng là ước lượng khả năng thiết bị; RAM máy admin không cộng vào RAM Render. Chưa chạy tác vụ GPU.

Kiểm thử: Worker thật trong Node worker_threads; kết quả tìm đường; timeout; RTT 220ms; thu hồi khi dừng/mất kết nối; admin ngoài phòng nhận và trả kết quả cho Zombie; từ chối non-admin và kết quả cũ. Bộ kiểm thử game/phòng hiện có vẫn qua. Chưa xác nhận trực tiếp trên máy admin hoặc đo ping/FPS mạng thật sau Render; Xanh tự triển khai.
