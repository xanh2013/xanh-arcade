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


# Tối ưu sâu 2026-09-27

Phạm vi: tối ưu hiệu năng nhưng giữ nguyên luật game, chức năng, API và dữ liệu người dùng.

- Trang chủ chỉ tải nền Robot / Phá gạch khi game tương ứng thực sự được mở.
- Fortnite Z không còn chặn nút chơi cho tới khi tải đủ 135 sprite. Loader khởi động chỉ chờ 27 sprite thiết yếu ở viewport khởi đầu; 108 sprite còn lại tải theo nhu cầu. Khi mở Bản đồ, các tile bản đồ được tải đầy đủ trước khi vẽ.
- Battle và Fortnite ngừng render/HUD liên tục khi đang ở menu hoặc pause; vẫn giữ khung hình cuối và cập nhật lại khi chơi.
- Static server dùng ETag và nén gzip bất đồng bộ theo nhu cầu, tránh gzip đồng bộ hàng loạt SVG trên event loop.
- Rooms giữ SSE là luồng chính; polling chỉ dùng làm fallback khi SSE mất kết nối.
- SSE Caro/shooter loại bỏ stream hỏng hoặc backlog lớn để hạn chế giữ bộ nhớ.
- Snapshot shooter dựng actor view đầy đủ/rút gọn một lần cho mỗi trận trên mỗi nhịp publish rồi tái sử dụng cho các client; lọc gần/xa vẫn theo từng người chơi.
- Lobby Caro và shooter tái sử dụng phần trạng thái chung trong cùng một broadcast.
- Battle/Fortnite/Zombie giảm mảng/object tạm, quét/sort lặp và phép tính khoảng cách trùng lặp trong loop mô phỏng.
- Network motion tái sử dụng bộ đệm restore thay vì tạo các mảng con mới mỗi frame.
- Resource worker theo dõi open-set O(1) thay cho open.includes tuyến tính và tránh tính lại tốc độ đạn.
- Trang tài khoản tải auth state và catalog song song; homepage/account cache các DOM node tĩnh.
- Thêm GitHub Actions riêng cho nhánh tối ưu: syntax check, toàn bộ test và benchmark Zombie.

## Kết quả GitHub Actions cùng loại runner

Baseline đầu nhánh:
- Battle simulation: 2483 ms.
- Fortnite simulation: 621 ms.
- Zombie benchmark p95: 0.843 ms.

Sau tối ưu (run cuối 2026-09-27):
- Battle simulation: 1807 ms.
- Fortnite simulation: 350 ms.
- Zombie benchmark p95: 0.545 ms.
- Toàn bộ syntax check, logic test, HTTP test, mocked UI test, rooms, resource sharing, snapshot/geometry đều qua.

Các số đo CI có dao động giữa từng run; dùng để so sánh xu hướng, không phải cam kết FPS trên thiết bị thật. Loader 27/135 là số asset bắt buộc theo code path khởi động, chưa phải phép đo network sau triển khai. Render cold-start trước tối ưu khoảng 25 giây chủ yếu phụ thuộc trạng thái sleep/hosting, không thể loại bỏ hoàn toàn chỉ bằng tối ưu code.
