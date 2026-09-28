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


## P2P bandwidth sharing (Admin mini-CDN)

- WebRTC DataChannel direct from Admin browser to player browser.
- Render only carries signaling plus fallback traffic; match authority, account, shop, cookies and tokens remain on Render/Supabase.
- Eligible heavy static group: Fortnite assets plus cover/background files, about 2.61 MiB raw in this revision (~89.7% of the repo's measured user-facing static asset bytes used in the audit).
- Fortnite JSON and sprites try P2P first; homepage covers and Robot/Breakout backgrounds do the same.
- If no Admin donor is available, the client backs off and uses Render normally. If ICE/DataChannel negotiation fails, it also falls back to Render.
- Admin keeps a versioned Cache Storage copy. A cache miss may consume Render bandwidth once; later P2P sends reuse the cached copy.
- Dashboard counters:
  - servedBytes: bytes sent directly Admin -> players.
  - originBytes: raw bytes fetched by Admin on P2P Cache Storage misses.
  - savedBytes = max(0, servedBytes - originBytes), shown as an estimate rather than billing-grade Render usage.
- Signaling uses an 18-second long poll while idle, woken immediately by a new client or ICE signal, to avoid wasting quota on frequent polling.
- No TURN relay is configured on Render. Direct P2P uses STUN; restrictive NAT/firewall cases fall back to Render instead of relaying heavy assets through Render.


# Production hardening 2026-09-27 · v2.6.0-beta

Đợt này không thay luật Battle/Fortnite/Zombie. Mục tiêu là băng thông, độ bền production, UX và khả năng kiểm chứng.

- P2P asset có manifest SHA-256 do Render tạo từ file thật; client và Admin cache đều kiểm tra kích thước + hash trước khi dùng.
- P2P giới hạn 8 client trực tiếp trên một Admin donor, giới hạn queue ICE/signaling và rate-limit endpoint. Khi đầy hoặc lỗi NAT, client fallback Render.
- Admin có nút nạp trước cache P2P theo yêu cầu; không tự tải 2.6 MiB asset khi chưa cần.
- WebRTC fallback rút từ 2.2 giây xuống 1.5 giây để tránh làm người chơi chờ quá lâu.
- Server ưu tiên Brotli rồi mới gzip cho HTML/JS/CSS/SVG/JSON và vẫn giữ ETag.
- Thêm PWA/service worker: asset nặng cache-first theo build, navigation/code network-first với cache fallback. Cache cũ vẫn dùng được khi khởi động offline.
- Thêm manifest cài ứng dụng và nút "Cài Xanh Arcade" khi trình duyệt hỗ trợ.
- Thêm /health v2.6.0-beta với build SHA, branch, uptime và trạng thái/capacity P2P để xác định chính xác bản production đang chạy.
- CSP/Permissions-Policy được siết chặt; blob: chỉ mở cho ảnh P2P; camera, microphone, geolocation và payment bị tắt vì web không dùng.
- Battle và Fortnite có nút toàn màn hình.
- Tôn trọng prefers-reduced-motion; catalog/shop dùng content-visibility để bỏ qua render card ngoài viewport.
- Thêm social link preview cho trang chủ.
- CI chạy cho mọi nhánh optimize-*.
- Thêm production-test: /health, PWA routes, Brotli, CSP/Permissions-Policy và SHA-256 manifest.
- Thêm performance-budget-test để chặn JS/CSS/HTML phình quá ngưỡng.

## Kiểm chứng CI

HEAD tối ưu đã qua:
- npm run check
- npm test
- npm run benchmark:zombie
- production regression test
- P2P broker tests
- performance budget tests

Performance budget tại run kiểm chứng:
- Runtime JS/MJS: 252,043 B
- CSS: 40,778 B
- HTML: 31,238 B
- Module runtime lớn nhất: battle.js 31,358 B

Ba run CI liên tiếp (cùng nhánh, engine không thay đổi) cho thấy độ dao động của shared runner:
- Battle simulation: 2412 / 2253 / 2423 ms
- Fortnite simulation: 480 / 431 / 440 ms
- Zombie p95: 0.681 / 0.640 / 0.793 ms

Dùng median để quan sát xu hướng; không coi một run CI là FPS thiết bị thật. Đợt v2.6 không sửa engine mô phỏng, nên các số trên chủ yếu xác nhận không có lỗi chức năng/performance-budget ở lớp production mới.


## Resource sharing v3 · 2026-09-28

- CPU donation remains a dedicated Web Worker with a capped duty cycle. Player donation is now explicit opt-in; Admin donation remains an explicit Admin action.
- Worker RAM is now used for a bounded LRU cache of navigation grids and reported separately from network task bytes. This is client-side task cache, not extra Render RAM.
- WebGPU capability is detected for telemetry only. No GPU task is dispatched yet; the UI says this explicitly instead of implying GPU offload.
- P2P distinguishes signaling pairs from actually opened WebRTC DataChannels. Dashboard shows handshaking, direct-open and failure counts separately.
- WebRTC negotiation can continue in the background for up to 8 seconds, while an asset waits only briefly before falling back to Render, avoiding a slow game load.
- ICE candidates received before remote SDP are queued rather than discarded.
- Open DataChannels are no longer expired by the handshake TTL.
- Client signaling uses long-polling to reduce Render request overhead.
