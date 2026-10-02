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
    var topics = sheet.getRange(i, 3).getValue();
    var status = sheet.getRange(i, 4).getValue();

    if (!email || status === 'Đã gửi') continue;

    var personalizedBody = htmlTemplate
      .replace(/\{\{Họ và tên\}\}/g, name)
      .replace(/\{\{Danh_sách_đề_tài\}\}/g, String(topics).replace(/\n/g, '<br>'));

    Logger.log('📤 Đang gửi đến: ' + email);

    GmailApp.sendEmail(email, subject, '', { htmlBody: personalizedBody });
    sheet.getRange(i, 4).setValue('Đã gửi');

    Logger.log('✅ Đã gửi đến: ' + email);
  }

  SpreadsheetApp.flush();
  Logger.log('🎉 Hoàn tất gửi tất cả thư mời.');
}
