/**
 * Gửi thư mời thẩm định hàng loạt từ một thư NHÁP (draft) Gmail có sẵn, thay thế
 * các biến {{Họ và tên}} / {{Danh_sách_đề_tài}} trong thư nháp theo từng dòng của
 * sheet "test" (Họ và tên | Email | Danh_sách_đề_tài | Trạng thái).
 *
 * LỖI GẶP PHẢI:
 *   Exception: Specified permissions are not sufficient to perform the action.
 *   Required permissions: (https://mail.google.com/ || .../gmail.send || ...)
 *
 * NGUYÊN NHÂN: file appsscript.json của project đang khai báo "oauthScopes" tường
 * minh (một mảng cụ thể) mà KHÔNG có quyền Gmail nào trong đó. Khi "oauthScopes"
 * đã được khai báo tay, Apps Script TẮT LUÔN việc tự dò quyền cần thiết theo code —
 * chỉ cấp đúng những quyền liệt kê trong mảng đó, dù code có gọi GmailApp hay
 * không. Vì vậy GmailApp.getDrafts() / sendEmail() luôn bị từ chối cho tới khi
 * thêm quyền Gmail vào đúng mảng này.
 *
 * CÁCH SỬA (làm 1 lần, cho project Apps Script đang chứa hàm này):
 *   1. Trong Apps Script editor: Project Settings (biểu tượng bánh răng) → tick
 *      "Show appsscript.json manifest file in editor" (nếu chưa thấy file này).
 *   2. Mở appsscript.json, thêm "https://mail.google.com/" vào mảng
 *      "oauthScopes" (giữ nguyên các quyền Drive/Sheets đã có, chỉ thêm, không
 *      thay thế — ví dụ repo này đã thêm sẵn vào
 *      webapp-phieu-nhan-xet/appsscript.json nếu bạn dán hàm này vào cùng
 *      project với webapp Phiếu nhận xét).
 *   3. QUAN TRỌNG: phải CẤP QUYỀN LẠI vì phạm vi quyền đã đổi — chọn hàm
 *      sendInvitationsFromDraft ở thanh Run ▶, bấm chạy, hộp thoại "Authorization
 *      required" sẽ hiện lại (lần này có thêm dòng quyền Gmail) → Allow. Chỉ cần
 *      làm 1 lần, trừ khi sau này đổi tài khoản chạy script.
 *
 * (Dùng "https://mail.google.com/" — quyền Gmail đầy đủ — thay vì cố chọn đúng 1
 * trong các quyền hẹp hơn (gmail.send/gmail.compose/gmail.modify) vì hàm này cần
 * CẢ đọc danh sách thư nháp (getDrafts) LẪN gửi thư (sendEmail); dùng quyền đầy đủ
 * là cách chắc chắn nhất, phù hợp với một script quản trị nội bộ như thế này.)
 *
 * LỖI THỨ 2 ĐÃ SỬA: mail gửi ra bị MẤT ĐỊNH DẠNG (in đậm "Tên đề tài:", ...) dù ô
 * "Danh_sách_đề_tài" trong Sheet vẫn có in đậm. Nguyên nhân: bản cũ đọc ô bằng
 * sheet.getRange(i, 3).getValue() — getValue() CHỈ trả về chữ thuần, không mang
 * theo định dạng rich text của ô. Bản dưới đổi sang getRichTextValue() rồi tự ghép
 * thành HTML, đoạn nào đang in đậm trong Sheet thì bọc trong <b>...</b> khi chèn
 * vào mail (xem rw_richTextToHtml_ bên dưới).
 */
function sendInvitationsFromDraft() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('test');
  var lastRow = sheet.getLastRow();

  var subject = 'Thư mời thẩm định Đề tài Nghiên cứu Khoa học cấp Cơ sở năm 2026 (Tháng 9/2026)';
  var drafts = GmailApp.getDrafts();
  Logger.log('📄 Tổng số thư nháp: ' + drafts.length);

  var draft = drafts.find(function (d) { return d.getMessage().getSubject().trim() === subject.trim(); });
  if (!draft) {
    Logger.log('❌ Không tìm thấy thư nháp có tiêu đề: ' + subject);
    return;
  }

  var message = draft.getMessage();
  var htmlTemplate = message.getBody();

  for (var i = 2; i <= lastRow; i++) {
    var name = sheet.getRange(i, 1).getValue();
    var email = sheet.getRange(i, 2).getValue();
    // getRichTextValue() (không phải getValue()) để giữ lại phần in đậm đã có
    // trong ô (vd. "Tên đề tài: ...") khi chuyển sang HTML cho mail.
    var topicsRichText = sheet.getRange(i, 3).getRichTextValue();
    var status = sheet.getRange(i, 4).getValue();

    if (!email || status === 'Đã gửi') continue;

    var personalizedBody = htmlTemplate
      .replace(/\{\{Họ và tên\}\}/g, rw_escapeHtml_(name))
      .replace(/\{\{Danh_sách_đề_tài\}\}/g, rw_richTextToHtml_(topicsRichText));

    Logger.log('📤 Đang gửi đến: ' + email);

    GmailApp.sendEmail(email, subject, '', { htmlBody: personalizedBody });
    sheet.getRange(i, 4).setValue('Đã gửi');

    Logger.log('✅ Đã gửi đến: ' + email);
  }

  SpreadsheetApp.flush();
  Logger.log('🎉 Hoàn tất gửi tất cả thư mời.');
}

/**
 * Chuyển một RichTextValue (giá trị + định dạng của 1 ô) sang chuỗi HTML, giữ lại
 * in đậm (đoạn nào set bold trong Sheet thì bọc <b>...</b> trong HTML) và xuống
 * dòng (\n -> <br>). Duyệt qua getRuns() — mỗi run là một đoạn liên tục có CÙNG
 * định dạng (Apps Script tự gộp sẵn, không cần tự dò ranh giới bold).
 */
function rw_richTextToHtml_(richText) {
  if (!richText) return '';
  var runs = richText.getRuns();
  var html = '';
  runs.forEach(function (run) {
    var text = rw_escapeHtml_(run.getText()).replace(/\n/g, '<br>');
    var style = run.getTextStyle();
    html += (style && style.isBold()) ? '<b>' + text + '</b>' : text;
  });
  return html;
}

/** Escape ký tự đặc biệt HTML (&, <, >) để không làm vỡ mail khi chèn dữ liệu thô. */
function rw_escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
