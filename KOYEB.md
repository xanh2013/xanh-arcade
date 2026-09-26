> **Hosting hiện tại: Render (quyết định ngày 26/09/2026).** Tiếp tục dùng service `xanh-arcade` tại https://xanh-arcade.onrender.com/ và repository `xanh2013/xanh-arcade`, nhánh `main`. Xanh tự triển khai trên Render; trợ lý cập nhật mã trên GitHub. Hướng dẫn Koyeb/Firebase chỉ lưu để tham khảo, không phải yêu cầu chuyển host. Thay đổi ghi chú này không xác nhận một bản triển khai mới.

# Chuyển Xanh Arcade sang Koyeb

## Cấu hình đã chuẩn bị

- Repository: `xanh2013/xanh-arcade`, branch `main`.
- Service: Web Service, builder **Dockerfile**, đường dẫn `Dockerfile`, thư mục gốc repository.
- Tên đề xuất: `xanh-arcade`.
- Port `8000`, protocol HTTP, route `/` → `8000`.
- Biến môi trường: `PORT=8000`, `NODE_ENV=production`, `SECURE_COOKIES=true`.
- HTTP health check: `GET /health`, grace period 10 giây.
- Chỉ **1 instance / 1 region**: phòng và trạng thái trận hiện nằm trong RAM của tiến trình. Nhiều instance sẽ chia tách phòng; chưa hỗ trợ autoscaling ngang.
- Chọn cấu hình/chi phí trong tài khoản Koyeb trước khi triển khai. Chưa giả định gói miễn phí đủ cho nhiều trận; không tự đăng ký gói tính phí.

## Giữ tài khoản và vật phẩm

Trong Koyeb, đặt `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` bằng giá trị dự án Supabase đang dùng. Không đổi dự án, không tạo lại database hoặc tài khoản admin. Không cần service-role key cho mã nguồn này. Nếu đang dùng `ADMIN_BOOST_ACTIVE`, có thể sao chép giá trị đó; nút chia sẻ CPU vẫn ở trang `/account`.

Sau khi có domain Koyeb thật, cập nhật Supabase Authentication URL Configuration (Site URL / Redirect URLs) phù hợp domain mới để email xác nhận quay lại đúng nơi. Không đoán domain và không sửa URL Supabase trước khi dịch vụ mới sẵn sàng.

Người dùng cần đăng nhập lại trên domain mới. Xu/shop tài khoản trong Supabase được giữ khi dùng cùng dự án. Xu chơi khách, cài đặt phím và thành tích cục bộ thuộc origin cũ nên không tự hiện ở domain mới. Phòng đang chạy không chuyển: tạo phòng mới trên Koyeb.

## Kiểm tra trước khi chuyển người chơi

1. Tạo Web Service từ GitHub theo cấu hình trên và chờ Healthy.
2. Kiểm tra `/health`, trang chủ, Battle, Zombie và Fortnite.
3. Đăng nhập tài khoản cũ, kiểm tra đồ/xu và quyền admin.
4. Hai trình duyệt/thiết bị vào cùng phòng, bắt đầu trận, kiểm tra SSE và thao tác.
5. Admin mở `/account` → Chia sẻ CPU máy này; kiểm tra tác vụ được nhận khi có trận.
6. Chia sẻ domain Koyeb thật sau khi kiểm tra. Giữ Render làm đường quay lại cho đến khi bản mới ổn; không xóa dịch vụ Render tự động.

Các đường dẫn nội bộ của game dùng cùng origin nên không phải thay hàng loạt URL Render. Docker chạy Node 24, không cần npm install vì package hiện không có dependency.

## Trạng thái

Mã và cấu hình chuẩn bị cho Koyeb; tạo dịch vụ và domain thực tế cần tài khoản Koyeb được kết nối. Chưa coi chuyển hosting là hoàn tất chỉ vì đã đẩy GitHub.

Tài liệu: https://www.koyeb.com/docs/build-and-deploy/deploy-with-git ; https://www.koyeb.com/docs/run-and-scale/health-checks ; https://www.koyeb.com/docs/build-and-deploy/environment-variables
