# Webapp "Nộp nghiệm thu NCKH cấp cơ sở - Quý 3/2026" (tham chiếu)

Đây là bản sao nguồn của một webapp Apps Script **khác** (do một phiên Claude Chat
trước đó dựng), được lưu lại **chỉ để tham chiếu định dạng/CSS** cho các webapp mới
sau này của Viện ARiHA — không phải là phần đang được phát triển trong repo này.

- `Code.gs`, `JavaScript.html`, `appsscript.json`: nguyên bản người dùng cung cấp.
- `Index.html`: nguyên bản người dùng cung cấp — cho thấy đúng các class CSS đã
  dùng (`hero`, `card`, `field`, `radio-pill`, `upload-box`, `submit-btn`, ...).
- **`CSS.html` bị thiếu** — người dùng xác nhận chưa có file này. Toàn bộ style
  của webapp `webapp-phieu-nhan-xet/` (thư mục cạnh đây) được dựng lại theo đúng
  tên class quan sát được từ `Index.html` ở trên, dùng chung bảng màu/kiểu chữ
  (Hanken Grotesk, JetBrains Mono, Montserrat 900) để hai webapp nhìn đồng bộ.

Nếu sau này tìm lại được `CSS.html` gốc, nên copy đè vào
`webapp-phieu-nhan-xet/CSS.html` (điều chỉnh lại các class riêng của form nhận xét
như `.score-pill`, `.readonly-field`, `.invalid-card` nếu chưa có trong bản gốc).
