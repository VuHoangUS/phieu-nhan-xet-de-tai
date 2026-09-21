# Webapp Phiếu nhận xét đề tài — link cá nhân hoá

Thay thế cho cách cũ (prefill Google Form + rút gọn qua TinyURL, bị giới hạn số
lượng link). Mỗi người nhận xét / mỗi đề tài có **một link ngắn cố định**:

```
<URL webapp>?id=<Mã liên kết 8 ký tự>
```

Link không chứa dữ liệu — chỉ chứa mã. Toàn bộ dữ liệu điền sẵn (họ tên người
nhận xét, email, tên đề tài, chủ nhiệm, link PDF) được **tra cứu trực tiếp từ
Google Sheet mỗi lần link được mở**, nên khi bạn sửa dữ liệu trong sheet, form sẽ
tự cập nhật theo — không cần tạo lại link.

## Cấu trúc file

- `Code.gs` — logic server: tra cứu theo Mã liên kết, sinh link, nhận nộp bài.
- `Index.html` — khung giao diện chính (chỉ file này được templated qua `<?!= ?>`).
- `CSS.html` — style (đồng bộ với webapp Nộp nghiệm thu, xem
  `../reference/webapp-nghiem-thu-2026-q3/README.md`).
- `JavaScript.html` — logic phía client.
- `appsscript.json` — manifest (quyền, chạy dưới quyền tài khoản Deploy).

## Cách triển khai

1. Tạo Apps Script project mới (script.google.com), xoá `Code.gs` mặc định, tạo
   4 file HTML (`Index`, `CSS`, `JavaScript`) và paste đúng nội dung từng file ở
   đây (Apps Script không có thư mục con, tên file phải khớp y hệt).
2. Trong `Code.gs`, kiểm tra lại phần **CẤU HÌNH** ở đầu file:
   - `LOOKUP_SPREADSHEET_ID` / `LOOKUP_SHEET_NAME`: đang trỏ tới sheet
     "DS_đề_tài_thẩm_định" (file `1IuQdVd1944TKO8gMo98VuG-7-BPQ421q5tx1GDWOWRs`).
     Sheet này **phải có đủ các cột** (tên cột có thể khác chút, xem
     `LOOKUP_COLUMN_ALIASES` trong Code.gs để thêm alias nếu cần):
     - Họ và tên người nhận xét
     - Email người nhận xét
     - Tên đề tài
     - Chủ nhiệm đề tài
     - File PDF của đề tài nghiên cứu trên (đường link Drive tới file PDF)
     - Cột **"Mã liên kết"** sẽ được **script tự tạo** nếu chưa có — không cần tạo tay.
   - `RESPONSE_SPREADSHEET_ID` / `RESPONSE_SHEET_NAME`: đang trỏ tới sheet ghi kết
     quả (file `1H894S9x3JUWtZBCEdgsP5EiBbyBOjKkuGybgpSgXUK4`). Nếu tên sheet thực
     tế khác `RESPONSE_SHEET_NAME`, sửa lại hằng số này cho khớp (nếu không tìm
     thấy, script tự dùng sheet đầu tiên của file, không bị crash — nhưng nên sửa
     đúng tên để tránh nhầm sheet).
3. Chạy hàm `authorizeSheets` (chọn trong thanh Run ▶) **bằng đúng tài khoản sẽ
   Deploy**, bấm Allow khi được hỏi quyền. Chỉ cần làm 1 lần.
4. Deploy → New deployment → Web app → Execute as: *Me (tài khoản vừa authorize)*
   → Who has access: *Anyone*. Bấm Deploy, copy URL `/exec`.
5. Chạy hàm `setupConfigSheet` một lần để tạo sheet "Cấu hình" (nút bật/tắt nhận
   nhận xét, ô B2 = MỞ/ĐÓNG) trong file kết quả.
6. Chạy hàm `generateReviewLinks` — script sẽ:
   - Sinh Mã liên kết cho mọi dòng trong sheet tra cứu **chưa có mã**.
   - Ghi link đầy đủ (`<URL webapp>?id=...`) vào cột **"Đường link cá nhân hoá"**
     (script tự tạo cột này) — copy trực tiếp từ đó để gửi cho từng người.
   - An toàn khi chạy lại nhiều lần: dòng đã có mã sẽ **giữ nguyên** mã cũ, chỉ
     dòng mới thêm sau này mới được cấp mã mới. Muốn cấp lại mã cho một dòng cụ
     thể: xoá tay ô "Mã liên kết" của dòng đó rồi chạy lại hàm này.
7. Mỗi lần sửa code sau này: **Deploy → Manage deployments → Edit → New version**
   (sửa file không tự cập nhật link `/exec` đang chạy).

## Vì sao an toàn hơn cách cũ

- Link ngắn cố định `?id=xxx` — không cần TinyURL, không giới hạn số lượng.
- Server **không tin** dữ liệu người/đề tài mà trình duyệt gửi lên khi nộp bài —
  luôn tra cứu lại theo Mã liên kết, nên không thể sửa (F12) để mạo danh người
  khác hoặc đổi đề tài đang nhận xét.
- Nộp lại đúng link cũ (sửa nhận xét) sẽ **ghi đè** lên dòng cũ của chính người đó
  trong sheet kết quả, không tạo dòng trùng lặp.
- Sheet tra cứu có thêm cột "Đã nhận xét lúc" (tự tạo) để biết ai đã nộp, ai chưa,
  không cần mở sheet kết quả để dò.
