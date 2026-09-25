# Xanh Battle 0.3 BETA — Đại dịch Zombie

## Cách chơi

- Trang chủ → Đại dịch Zombie, hoặc `/battle?mode=zombie`.
- Solo: chọn **Đại dịch Zombie · BETA**, độ khó rồi **Vào trận**. Không cần kết nối mạng để chạy mô phỏng sau khi tải xong tài nguyên.
- Chơi cùng bạn: **Tạo / Vào phòng Zombie · Đội 4**, hoặc `/rooms?game=battle&ruleset=zombie&mode=squad`. Chủ phòng tạo phòng, sao chép link mời. Người khác vào và bấm Sẵn sàng; chủ phòng bắt đầu.
- Phòng Zombie chứa tối đa 4 người thật; chỗ trống được lấp bằng bot đồng đội. Có thể tạo phòng Zombie solo 1 vị trí. Đây là co-op PvE, không phải các đội đấu nhau.
- Luật chơi, độ khó và đội bị khóa khi trận bắt đầu. Battle/Fortnite sinh tồn vẫn có 25 vị trí như trước.
- Vượt 8 đợt để thắng; cả đội bị hạ thì thua. Zombie thường, chạy nhanh và giáp nặng xuất hiện theo cấp đợt. Zombie đánh cận chiến và có thể phá bom keo chắn đường.
- Bắt đầu trên mặt đất, trang bị Cedar A1 / Tempest 12. Có đủ 20 súng mới rải quanh điểm xuất phát, nhặt bằng F và đổi bằng 1/2. Mỗi đợt hoàn tất có 15 giây nghỉ, bổ sung đạn, máu và vật phẩm cho người còn sống. Không tự hồi sinh người đã bị hạ.
- 20 súng có tên và chỉ số riêng: 4 súng ngắn, 4 tiểu liên, 4 súng trường, 4 súng tỉa, 2 shotgun và 2 súng máy. Cũng xuất hiện trong loot của Battle. Mở **20 súng mới** để xem thông số.
- Thành tích Zombie không trộn vào bảng xếp hạng Battle cũ. Xu beta solo vẫn theo giới hạn phần thưởng hiện có.

## Hiệu năng và số đo

- FPS: số khung thực tế theo khoảng thời gian gần nhất, càng cao càng tốt. Không phải cam kết 60 FPS trên mọi thiết bị.
- Khung p95: 95% khoảng cách khung hình không vượt quá mức này; thấp hơn thường mượt hơn.
- Giật: số khoảng khung >50 ms trong 10 giây gần nhất.
- Online: RTT đo từ yêu cầu điều khiển tới phản hồi; tuổi bản tin gần nhất và độ dao động chu kỳ nhận. RTT bao gồm mạng và thời gian phục vụ, không phải ping ICMP hay độ trễ đầu-vào-đến-màn-hình.
- Solo không hiển thị ping giả bằng 0. Mất bản tin trên 2,5 giây hiển thị mất kết nối và không dùng lại RTT cũ.
- Tự động giảm cây trang trí / hạt khi khung chậm liên tục; có lựa chọn Đầy đủ / Nhẹ. Giữ nguyên va chạm và sát thương ở mọi mức.
- Chia ô tường tĩnh và nhân vật để giảm số phép thử va chạm; giới hạn zombie sống tối đa 48, tái sử dụng ID, dọn vật phẩm và hiệu ứng; phân tán suy nghĩ/tìm đường.
- Solo mô phỏng 60 Hz với số bước bắt kịp có giới hạn. Máy chủ vẫn 20 Hz, bản tin 10 Hz, nội suy hình ảnh online hiện có. Gửi điều khiển tối đa 20 Hz và không chồng yêu cầu đang chờ.
- Zombie được tính trên máy chủ khi online; không giao tác vụ zombie cho thiết bị người chơi. Phần quản trị tài nguyên đã có không thay đổi.

## Kiểm tra trước khi bàn giao (2026-09-25)

`npm run check`, `npm test` đều qua, gồm Battle, Fortnite, tài khoản với nhà cung cấp giả lập, phòng cũ và test Zombie mới. Test mới bao phủ đủ 20 súng bắn được, thắng/thua, đợt 1–8, sát thương cận chiến, va chạm tường so với thuật toán cũ, sức chứa solo/đội, khóa cấu hình, quyền chủ phòng, dữ liệu đồng bộ, đồng đội không gây sát thương và chủ phòng rời đi.

`battle-ui-test.mjs` chạy module giao diện với DOM/canvas giả lập để bắt lỗi khởi động, HUD, kho súng. Không phải kiểm thử hiển thị trình duyệt. Trình duyệt đám mây từ chối URL localhost, nên chưa xác nhận bố cục bằng ảnh hoặc đo FPS trên trình duyệt thật.

`npm run benchmark:zombie`: Node v24.19.0, 4 trận đồng thời, mỗi trận 4 nhân vật + 48 zombie, 60 giây mô phỏng; nhân vật bất tử để duy trì tải. Một lần chạy cho trung bình 1,28 ms, p95 1,70 ms, đỉnh 4,70 ms **tổng 4 trận mỗi bước**; tối đa 14 viên đạn đang bay/trận. Không bao gồm mạng, SSE, trình duyệt hoặc vẽ GPU. Không đại diện cho mọi mức cấu hình Render.

100.000 phép kiểm tra điểm/tường cùng đầu vào: 40,78 ms trước, 17,64 ms sau, số va chạm bằng nhau. Số đo phụ thuộc máy và lần chạy, không dùng làm ngưỡng test cứng.

## Triển khai

Xanh tự triển khai commit mới từ GitHub lên Render theo lựa chọn đã ghi nhận. Không thêm biến môi trường, cơ sở dữ liệu hoặc thư viện phụ thuộc. Sau triển khai, mở trang Battle và kiểm tra solo; mở hai trình duyệt/thiết bị để kiểm tra co-op và RTT trên mạng thật.
