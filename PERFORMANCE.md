# Tối ưu 2026-09-25

- Kiểm tra đường thẳng/tường dùng loại trừ hộp bao và giao đoạn không cấp phát các mảng tạm theo từng tường. Test so với công thức cũ trên 30.000 đoạn, đoạn ngang/dọc, độ dài bằng 0 và góc tường đều giống nhau.
- Không dựng bảng ô va chạm nhân vật khi không có đạn.
- Battle vẽ nền tĩnh vào ô canvas 512×512 và tái sử dụng; LRU tối đa 24 ô (~24 MiB pixel thô, chi phí thực tế tùy trình duyệt). Nhân vật, vật phẩm, bom keo, đạn vẫn vẽ trực tiếp. Chế độ nhẹ/đầy đủ có ô riêng.
- Cache tra cứu các phần tử HUD cố định.
- Snapshot giữ chỉ số cần thiết cho bản thân và nhân vật gần. Nhân vật xa giữ ID, vị trí, tên/đội, trạng thái để không phá đồng bộ và thanh đồng đội; bỏ ba lô/cooldown không được dùng khi ở xa. Làm tròn số hiển thị tới 0,01 đơn vị, không đổi trạng thái mô phỏng.
- Không tạo WebGL context để hỏi khả năng thiết bị cho tác vụ CPU; thông tin máy admin chỉ đọc lại khi bấm bắt đầu chia sẻ.

## Kết quả tại môi trường kiểm thử

- 80.000 phép kiểm tra đường thẳng/tường: 398 ms → 30 ms, cùng 76.352 đường thông thoáng.
- Bài đo 4 trận Zombie, mỗi trận 4 người + 48 zombie, 60 giây mô phỏng: trung bình 0,24 ms, p95 0,51 ms tổng bốn trận mỗi bước; đỉnh một lần 10,91 ms. Bài trước đó p95 khoảng 1,70 ms. Dữ liệu này không gồm vẽ, SSE và mạng.
- Fixture 25 nhân vật với 23 nhân vật ở xa: JSON phần nhân vật 11.225 → 3.359 byte. Không phải tỷ lệ giảm cho mọi trận hoặc toàn bộ gói tin.
- Test logic, Worker, phòng/SSE, mô phỏng, quyền admin và DOM giả lập đều qua. Chưa đo FPS hoặc ping trên thiết bị Xanh / Render; không cam kết hết giật trên mọi máy.

Triển khai: chỉ cập nhật GitHub; Xanh tự triển khai Render. Xem RESOURCE-SHARING.md để bật máy admin hỗ trợ.
