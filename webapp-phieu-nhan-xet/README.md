# Webapp Phiếu nhận xét đề tài — link cá nhân hoá

Thay thế cho cách cũ (prefill Google Form + rút gọn qua một webapp shortener riêng
ghi vào sheet "Shortener"). Mỗi đề tài có tới **2 người thẩm định** (Thẩm định 1 /
Thẩm định 2), mỗi người một link ngắn cố định riêng:

```
<URL webapp>?id=<mã 8 ký tự>
```

Link không chứa dữ liệu — chỉ chứa mã. Toàn bộ dữ liệu điền sẵn (họ tên người
nhận xét, email, tên đề tài, mã số đề tài, 2 file PDF) được **tra cứu trực tiếp từ
Google Sheet mỗi lần link được mở**, nên khi bạn sửa dữ liệu trong sheet, form sẽ
tự cập nhật theo — không cần tạo lại link.

## Cấu hình hiện tại (2026-09-22): sheet "Nghiệm thu 2026 - Q3"

`LOOKUP_SPREADSHEET_ID`/`LOOKUP_SHEET_NAME` trong `Code.gs` đang trỏ vào sheet
**"Nghiệm thu 2026 - Q3"** (file `19BLa5sH0xyLrvUa-F7cbuuiVRb7KPyuzaKoWMKeLQCE`),
sheet này đã có sẵn đúng các cột cần thiết (được thêm tay từ trước):

```
... | Mã số đề tài | Tải lên file PDF nghiệm thu đề tài | ... | File đề cương |
Khoa/phòng TĐ1 | Thẩm định 1 | Khoa/phòng TĐ2 | Thẩm định 2 | Email TĐ1 | Email TĐ2 |
Form 1 | Form 2 | Mã liên kết TĐ1 | Mã liên kết TĐ2
```

- Script ghi đè link cá nhân hoá mới thẳng vào cột **"Form 1"** (Thẩm định 1) /
  **"Form 2"** (Thẩm định 2) đã có sẵn — không tạo cột hiển thị link mới.
- Cột **"Mã liên kết TĐ1"/"TĐ2"** (lưu mã thô dùng để tra cứu) cũng đã có sẵn
  trong sheet này — script dùng luôn, không tạo trùng.
- Script tự thêm 2 cột phụ **"Đã nhận xét lúc TĐ1"/"TĐ2"** (mốc thời gian sau khi
  người đó nộp bài) vào cuối sheet khi chạy lần đầu — không cần tạo tay.
- `LOOKUP_COLUMN_ALIASES`/`REVIEWER_SLOTS` trong `Code.gs` cũng liệt kê alias cho
  bố cục cột của sheet "DS_đề_tài_thẩm_định" (đợt 2025) — muốn chuyển lại đợt cũ
  chỉ cần đổi `LOOKUP_SPREADSHEET_ID`/`LOOKUP_SHEET_NAME`, không cần sửa gì khác.
  Lưu ý: đợt cũ không có cột "File đề cương" riêng nên bắt buộc phải có cột đó
  (hoặc thêm alias mới) nếu muốn dùng lại sheet cũ.

## Cấu trúc file

- `Code.gs` — logic server: tra cứu theo Mã liên kết (2 slot/dòng), sinh link,
  nhận nộp bài.
- `Index.html` — khung giao diện chính (chỉ file này được templated qua `<?!= ?>`).
- `CSS.html` — style (copy nguyên phần dùng chung từ CSS.html thật của webapp Nộp
  nghiệm thu, xem `../reference/webapp-nghiem-thu-2026-q3/CSS.html`, cộng thêm vài
  class riêng cho form nhận xét ở cuối file).
- `JavaScript.html` — logic phía client.
- `appsscript.json` — manifest (quyền, chạy dưới quyền tài khoản Deploy).

## Cách triển khai

1. Tạo Apps Script project mới (script.google.com), tạo 4 file `Code`, `Index`,
   `CSS`, `JavaScript` và paste đúng nội dung từng file ở đây (Apps Script không
   có thư mục con, tên file phải khớp y hệt, không có phần mở rộng `.gs`/`.html`
   khi đặt tên trong trình soạn thảo).
2. Trong `Code.gs`, kiểm tra lại phần **CẤU HÌNH** ở đầu file:
   - `LOOKUP_SPREADSHEET_ID` / `LOOKUP_SHEET_NAME`: trỏ tới sheet "Nghiệm thu
     2026 - Q3" (file `19BLa5sH0xyLrvUa-F7cbuuiVRb7KPyuzaKoWMKeLQCE`).
   - `RESPONSE_SPREADSHEET_ID` / `RESPONSE_SHEET_NAME`: trỏ tới sheet ghi kết quả
     (file `1H894S9x3JUWtZBCEdgsP5EiBbyBOjKkuGybgpSgXUK4`). Nếu tên sheet thực tế
     khác `RESPONSE_SHEET_NAME` ('Trang tính1'), sửa lại hằng số này cho khớp
     (không tìm thấy thì script tự dùng sheet đầu tiên, không crash — nhưng nên
     sửa đúng tên để chắc chắn ghi vào đúng sheet).
3. Chạy hàm `authorizeSheets` (chọn trong thanh Run ▶) **bằng đúng tài khoản sẽ
   Deploy**, bấm Allow khi được hỏi quyền. Chỉ cần làm 1 lần.
4. Deploy → New deployment → Web app → Execute as: *Me (tài khoản vừa authorize)*
   → Who has access: *Anyone*. Bấm Deploy, copy **"Web app URL"** (đuôi `/exec`).
5. Dán URL vừa copy vào hằng số **`WEB_APP_URL`** ở đầu `Code.gs` (đoạn `'DÁN LINK
   /exec Ở ĐÂY'`). **Bắt buộc** — xem phần "Lỗi hay gặp" bên dưới để biết vì sao.
6. Chạy hàm `setupConfigSheet` một lần để tạo sheet "Cấu hình" (nút bật/tắt nhận
   nhận xét, ô B2 = MỞ/ĐÓNG) trong file kết quả.
7. Chạy hàm `generateReviewLinks` — script sẽ:
   - Với mỗi dòng đề tài có "Thẩm định 1" và/hoặc "Thẩm định 2": sinh mã (nếu
     dòng/slot đó **chưa có mã**) và ghi link đầy đủ (dựa trên `WEB_APP_URL`) vào
     đúng cột "Form 1" / "Form 2" tương ứng.
   - An toàn khi chạy lại nhiều lần: slot đã có mã sẽ **giữ nguyên** mã cũ (chỉ
     link hiển thị được ghi làm mới, mã không đổi). Muốn cấp lại mã cho một người
     cụ thể: xoá tay ô "Mã liên kết TĐ1"/"Mã liên kết TĐ2" của dòng đó rồi chạy
     lại hàm này.
8. Mỗi lần sửa code sau này: **Deploy → Manage deployments → Edit → New version**
   (sửa file không tự cập nhật link `/exec` đang chạy). Nếu thay vì "New version"
   bạn tạo hẳn **deployment mới**, link `/exec` sẽ đổi — nhớ cập nhật lại
   `WEB_APP_URL` rồi chạy lại `generateReviewLinks`.

### Lỗi hay gặp: cột Form 1/Form 2 bị ghi link đuôi `/dev?id=...`

Nếu mở link từ cột Form 1/Form 2 mà Google báo **"Bạn không có quyền truy cập
vào tài liệu yêu cầu"**, kiểm tra xem link đó có đuôi `/dev?id=...` thay vì
`/exec` không. Nguyên nhân: `generateReviewLinks()` được **chạy tay** từ trình
soạn thảo (không phải từ một request thật tới webapp) — trong hoàn cảnh đó,
`ScriptApp.getService().getUrl()` trả về link kiểm thử `/dev` (chỉ tài khoản có
quyền Editor của chính script mới mở được), không phải link `/exec` thật. Vì
vậy code hiện tại dùng hằng số `WEB_APP_URL` (dán tay, xem bước 5 ở trên) thay
vì tự hỏi `getUrl()`. Nếu lỡ dính lỗi này: dán đúng `WEB_APP_URL` rồi chạy lại
`generateReviewLinks` — hàm sẽ **ghi đè** lại đúng link `/exec` vào tất cả các
ô Form 1/Form 2 đang sai (mã liên kết giữ nguyên, không đổi).

## Vì sao an toàn hơn cách cũ

- Link ngắn cố định `?id=xxx` — không phụ thuộc dịch vụ rút gọn link bên ngoài.
- Server **không tin** dữ liệu người/đề tài mà trình duyệt gửi lên khi nộp bài —
  luôn tra cứu lại theo Mã liên kết, nên không thể sửa (F12) để mạo danh người
  khác hoặc đổi đề tài đang nhận xét.
- Nộp lại đúng link cũ (sửa nhận xét) sẽ **ghi đè** lên dòng cũ của chính người đó
  trong sheet kết quả (khớp theo cột "Mã liên kết"), không tạo dòng trùng lặp.
- Sheet tra cứu có thêm cột "Đã nhận xét lúc TĐ1"/"TĐ2" (tự tạo) để biết ai đã
  nộp, ai chưa — không cần mở sheet kết quả để dò.
- Sheet kết quả được ghi theo **tên cột**, khớp đúng vào các cột đã có sẵn từ các
  đợt nhận xét trước (không tạo bố cục cột khác/không phá dữ liệu cũ).

## Về việc chia sẻ Google Sheet cho Claude xem/sửa

Claude (qua kết nối Google Drive trong phiên làm việc này) hiện **không có quyền
truy cập** 2 sheet trên — đó là lý do lần trước phải nhờ bạn gửi ảnh/xlsx thay vì
để Claude tự đọc trực tiếp. Nếu muốn Claude đọc/sửa trực tiếp Google Sheet không
do Claude sở hữu, cách đơn giản nhất **không cần biết email cụ thể**: mở sheet →
nút **Share (Chia sẻ)** → đổi chế độ chia sẻ sang **"Anyone with the link" (Bất kỳ
ai có đường liên kết)** → chọn quyền **Editor (Người chỉnh sửa)** nếu muốn Claude
sửa được, hoặc **Viewer** nếu chỉ cần xem. Việc này không ảnh hưởng gì tới quyền
chạy thật của webapp (webapp luôn chạy dưới quyền tài khoản bạn dùng để Deploy,
không liên quan tới quyền chia sẻ cho Claude xem trong lúc trò chuyện).

## Các thay đổi giao diện gần nhất (2026-09-22)

- Thay trường "Chủ nhiệm đề tài" bằng **"Mã số đề tài"** ở khối thông tin điền sẵn.
- Tách 1 trường PDF thành **2 ô cạnh nhau**: "File đề cương" (trái) và "File nghiệm
  thu" (phải, chữ lớn hơn + nền vàng — đây là file dùng để chấm điểm). Cả 2 đều mở
  ở tab mới khi bấm.
- Thang điểm 1-5 đổi sang kiểu **bullet**: số ở trên, chấm tròn bên dưới, bấm vào
  số hay chấm tròn đều chọn được (cả 2 đều nằm trong cùng 1 `<label>`).
- **KẾT LUẬN = ĐẠT** thì không cho chọn Xếp loại = KHÔNG ĐẠT nữa (trước đây chỉ có
  chiều ngược lại: KHÔNG ĐẠT ép Xếp loại = KHÔNG ĐẠT).
- 5 câu hỏi ở "B. Phần nhận xét bài báo" không còn bắt buộc, có thể để trống.
