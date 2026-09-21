/**
 * WEBAPP NỘP NGHIỆM THU NGHIÊN CỨU KHOA HỌC CẤP CƠ SỞ - QUÝ 3/2026
 * Viện ARiHA - Bệnh viện Thống Nhất
 *
 * Cấu trúc file:
 *  - Code.gs        : logic phía server (file này)
 *  - Index.html     : khung giao diện chính
 *  - CSS.html       : toàn bộ style
 *  - JavaScript.html: toàn bộ logic phía client
 *
 * CÁCH TRIỂN KHAI: xem hướng dẫn trong README.md đi kèm.
 */

// Đổi chuỗi này mỗi khi sửa code, rồi so với dòng "Server code version" hiện ở cuối
// trang web đã deploy — nếu KHÔNG khớp nghĩa là bản deploy đang test vẫn là code CŨ,
// chưa phải bản bạn vừa sửa (phải Deploy > Manage deployments > Edit > New version).
var CODE_VERSION = 'v18-2026-09-18-auto-close-trigger';

// ============================= CẤU HÌNH =============================

// ID của Google Sheet lưu dữ liệu (Theo dõi mã số đề tài NCCCS - Bệnh viện Thống Nhất)
var SPREADSHEET_ID = '19BLa5sH0xyLrvUa-F7cbuuiVRb7KPyuzaKoWMKeLQCE';

// Tên sheet nhận kết quả nộp nghiệm thu (Quý 3/2026)
var RESPONSE_SHEET_NAME = 'Nghiệm thu 2026 - Q3';

// Map "Thời gian đăng ký đề tài" -> tên sheet chứa dữ liệu đề tài đã đăng ký tương ứng
var LOOKUP_SHEETS = {
  'Quý 1/2026': '2026 - Q1',
  'Quý 2/2026': '2026 - Q2'
};

// Giá trị đặc biệt khi đề tài đăng ký trước năm 2026 (không có trong sheet tra cứu)
var FREE_TEXT_OPTION = 'Trước năm 2026';

// Folder Google Drive lưu file PDF nghiệm thu đề tài
var PDF_FOLDER_ID = '1Sv9kJ2SlDorl04vdFR8T0Ueug5LjZMLPL9Lc9Yf-HHC9LrS1pY5J0zLcNlZEFZpm6vuPybED';

// Folder Google Drive lưu file minh chứng đã đăng trên tạp chí
var EVIDENCE_FOLDER_ID = '1kaR6Luz0HadUIRKCka1Wrz5ysHNTmJzImAnaA7CqoMQAgspF3e1-9XshIGhaGr15QNbRJjI5';

// Giới hạn dung lượng file (10MB)
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Danh sách Khoa/phòng (lấy đúng theo Google Form gốc)
var KHOA_PHONG_LIST = [
  'Khoa Cấp cứu',
  'Khoa Chẩn đoán hình ảnh',
  'Khoa Da liễu - Miễn dịch - Dị ứng',
  'Khoa Dinh dưỡng lâm sàng',
  'Khoa Dược',
  'Khoa Điều trị cán bộ cao cấp',
  'Khoa Giải phẫu bệnh',
  'Khoa Hoá sinh',
  'Khoa Hồi sức tích cực - Chống độc',
  'Khoa Huyết học',
  'Khoa Khám bệnh',
  'Khoa Khám bệnh theo yêu cầu',
  'Khoa Kiểm soát nhiễm khuẩn',
  'Khoa Mắt',
  'Khoa Ngoại Chấn thương chỉnh hình',
  'Khoa Ngoại Điều trị theo yêu cầu',
  'Khoa Ngoại Gan mật',
  'Khoa Ngoại Tiết niệu và Nam học',
  'Khoa Ngoại Thần kinh',
  'Khoa Ngoại Tiêu hóa',
  'Khoa Ngoại Tim mạch - Lồng ngực',
  'Khoa Nhịp tim',
  'Khoa Nội Cơ xương khớp',
  'Khoa Nội Điều trị theo yêu cầu',
  'Khoa Nội Hô hấp',
  'Khoa Nội nhiễm',
  'Khoa Nội thận - Lọc máu',
  'Khoa Nội Thần kinh',
  'Khoa Nội tiết',
  'Khoa Nội Tiêu hóa',
  'Khoa Nội Tim mạch',
  'Khoa Phẫu thuật - Gây mê hồi sức',
  'Khoa Phẫu thuật hàm mặt - Tạo hình thẩm mỹ',
  'Khoa Phục hồi chức năng',
  'Khoa Tai mũi họng',
  'Khoa Thăm dò chức năng và nội soi',
  'Khoa Tim mạch cấp cứu và can thiệp',
  'Khoa Ung bướu',
  'Khoa Vi sinh',
  'Khoa Y học cổ truyền',
  'Phòng Bảo vệ sức khoẻ trung ương 2B',
  'Phòng Công nghệ thông tin',
  'Phòng Đào tạo - Chỉ đạo tuyến',
  'Phòng Điều dưỡng',
  'Phòng Hành chính',
  'Phòng Kế hoạch tổng hợp',
  'Phòng Quản lý chất lượng và Công tác xã hội',
  'Phòng Quản trị',
  'Phòng Tài chính kế toán',
  'Phòng Thiết bị y tế',
  'Phòng Tổ chức cán bộ',
  'Tạp chí sức khỏe và lão hóa',
  'Trung tâm nghiên cứu Tương đương sinh học và Thử nghiệm lâm sàng Thống Nhất',
  'Trung tâm Răng Hàm Mặt Kỹ thuật cao',
  'Trung tâm Tiêm chủng Vắc-xin',
  'Viện Nghiên cứu Ứng dụng Khoa học Sức khỏe và Lão hóa'
];

// Liên hệ hỗ trợ (dùng ở thông báo sau khi nộp thành công)
var CONTACT_EMAIL = 'ariha@bvtn.edu.vn';
var CONTACT_PHONE = '028 3869 0277 (Nội bộ: 750) (Giờ hành chính)';

// ---- Bật/tắt nhận câu trả lời ----
// Sheet "Cấu hình" (tự tạo bằng hàm setupConfigSheet(), xem bên dưới), ô B2 chứa "MỞ"
// hoặc "ĐÓNG". Muốn đóng/mở nhận bài, chỉ cần mở Google Sheet, vào sheet "Cấu hình",
// đổi giá trị ô B2 (có sẵn danh sách chọn MỞ/ĐÓNG) — không cần sửa code hay deploy lại.
var CONFIG_SHEET_NAME = 'Cấu hình';
var ACCEPTING_CELL = 'B2';
var CLOSED_MESSAGE = 'Đã hết hạn nghiệm thu Đề tài Nghiên cứu Khoa học cấp Cơ sở Quý 3 năm 2026.';

// Hạn chót nộp bài — hiển thị trên form (đồng hồ đếm ngược) và dùng làm mốc thời gian.
// Sửa 2 dòng dưới nếu đổi hạn chót (nhớ giữ đúng định dạng ISO có múi giờ +07:00).
var DEADLINE_DISPLAY_TEXT = '23:59, 20/9/2026';
var DEADLINE_ISO = '2026-09-20T23:59:00+07:00';

// Thời điểm CHẠY TRIGGER tự động đóng form (xem setupAutoCloseTrigger() bên dưới) —
// thường đặt sau DEADLINE_ISO vài phút cho chắc. Mỗi khi đổi hạn chót ở trên, SỬA LUÔN
// dòng này rồi CHẠY LẠI setupAutoCloseTrigger() một lần — trigger cũ (nếu đã chạy hoặc
// đang trỏ tới thời điểm cũ) sẽ không tự cập nhật theo giá trị mới ở đây.
var AUTO_CLOSE_AT_ISO = '2026-09-21T00:01:00+07:00';

// ============================= WEB APP ENTRY =============================

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  // Truyền sẵn URL thật của web app từ server xuống trang, thay vì để trang tự dò qua
  // google.script.url.getLocation() phía client — API đó trên thực tế không luôn gọi lại
  // callback (gây lỗi "chưa xác định được URL" khi bấm Nộp). ScriptApp.getService().getUrl()
  // luôn trả đúng và đáng tin cậy hơn nhiều.
  template.scriptUrl = ScriptApp.getService().getUrl();

  // Bật/tắt nhận câu trả lời + hạn chót nộp bài (xem CẤU HÌNH ở đầu file).
  template.accepting = isAcceptingResponses_();
  template.closedMessage = CLOSED_MESSAGE;
  template.deadlineText = DEADLINE_DISPLAY_TEXT;
  template.deadlineIso = DEADLINE_ISO;

  return template
    .evaluate()
    .setTitle('Nộp nghiệm thu NCKH cấp cơ sở - Quý 3/2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Nhận dữ liệu nộp bài gửi bằng fetch() (POST tới chính URL web app).
 * Dùng cách này (thay vì google.script.run) để không bị giới hạn dung lượng
 * tham số của google.script.run khi gửi kèm file PDF lớn.
 */
function doPost(e) {
  var result;
  try {
    var payload = JSON.parse(e.postData.contents);
    result = handleSubmit(payload);
  } catch (err) {
    result = { success: false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================= DỮ LIỆU CHO FORM =============================

function getKhoaPhongList() {
  return KHOA_PHONG_LIST;
}

/**
 * Dùng để kiểm tra xem trang web đang mở có thực sự chạy bản code mới nhất hay không
 * (so dòng "Server code version" hiển thị ở cuối trang với CODE_VERSION trong file này).
 */
function getServerInfo() {
  return {
    version: CODE_VERSION,
    now: new Date().toString()
  };
}

/**
 * Đọc ô cấu hình "Cấu hình" (ô B2) để biết webapp có đang nhận câu trả lời hay không.
 * - Chưa tạo sheet "Cấu hình" (chưa chạy setupConfigSheet() lần nào) -> mặc định MỞ.
 * - Ô B2 = "ĐÓNG" (không phân biệt hoa/thường, có thể có khoảng trắng thừa) -> ĐÓNG.
 * - Mọi giá trị khác (kể cả "MỞ", trống, hoặc giá trị lạ) -> mặc định MỞ, để tránh
 *   trường hợp lỗi/gõ nhầm ở ô cấu hình vô tình khoá toàn bộ form ngoài ý muốn.
 */
function isAcceptingResponses_() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) return true;
    var raw = sheet.getRange(ACCEPTING_CELL).getValue();
    var text = String(raw).trim().toUpperCase();
    return text !== 'ĐÓNG' && text !== 'DONG' && text !== 'CLOSED';
  } catch (err) {
    // Lỗi đọc cấu hình (ví dụ mất quyền tạm thời) -> vẫn cho nhận bài, không khoá nhầm
    // toàn bộ người dùng chỉ vì một lỗi phụ không liên quan tới việc nộp bài.
    return true;
  }
}

/**
 * CHẠY THỦ CÔNG 1 LẦN để tạo sheet "Cấu hình" (nút bật/tắt nhận câu trả lời).
 * Cách chạy: trong trình soạn thảo Apps Script, chọn hàm "setupConfigSheet" ở thanh
 * Run ▶ rồi bấm nút chạy. Sau khi chạy xong, mở Google Sheet lên sẽ thấy 1 sheet mới tên
 * "Cấu hình" — ô B2 có sẵn danh sách chọn "MỞ" / "ĐÓNG". Muốn đóng/mở nhận bài về sau,
 * CHỈ CẦN đổi giá trị ô B2 đó (không cần sửa code, không cần deploy lại):
 *   - B2 = "MỞ"   -> webapp hiện form nộp bài bình thường.
 *   - B2 = "ĐÓNG" -> webapp hiện thông báo đã đóng thay vì form.
 * An toàn khi chạy lại nhiều lần: nếu sheet đã tồn tại, hàm chỉ đọc lại chứ không ghi đè
 * giá trị B2 đang có.
 */
function setupConfigSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  var justCreated = false;
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    justCreated = true;
  }

  if (justCreated || !sheet.getRange(ACCEPTING_CELL).getValue()) {
    sheet.getRange('A1').setValue('Cấu hình webapp Nộp nghiệm thu NCKH cấp cơ sở - Quý 3/2026 (đừng xoá sheet này)');
    sheet.getRange('A2').setValue('Trạng thái nhận câu trả lời:');
    sheet.getRange('B2').setValue('MỞ');
    sheet.getRange('A1').setFontWeight('bold');
    sheet.getRange('A2:B2').setFontWeight('bold');
    sheet.setColumnWidth(1, 260);
    sheet.setColumnWidth(2, 120);

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['MỞ', 'ĐÓNG'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(ACCEPTING_CELL).setDataValidation(rule);
  }

  Logger.log('=> Sheet "Cấu hình" đã sẵn sàng. Trạng thái hiện tại ô %s: "%s"',
    ACCEPTING_CELL, sheet.getRange(ACCEPTING_CELL).getValue());
}

/**
 * Tự động đổi ô Cấu hình!B2 sang "ĐÓNG" khi đã tới hạn chót — được gọi bởi trigger đã
 * hẹn giờ (xem setupAutoCloseTrigger() bên dưới), KHÔNG tự chạy khi có người mở trang.
 *
 * Cố tình chỉ ĐÓNG, không bao giờ tự MỞ LẠI: nếu sau này bạn dời hạn chót ra xa hơn
 * (sửa DEADLINE_ISO/AUTO_CLOSE_AT_ISO), việc mở lại form vẫn cần bạn tự tay đổi ô B2
 * về "MỞ" — để đó luôn là một quyết định chủ động, không bị hàm này âm thầm ghi đè.
 */
function autoCloseIfPastDeadline_() {
  try {
    var deadline = new Date(DEADLINE_ISO);
    if (isNaN(deadline.getTime())) {
      Logger.log('autoCloseIfPastDeadline_: DEADLINE_ISO sai định dạng, bỏ qua.');
      return;
    }
    if (new Date() < deadline) {
      Logger.log('autoCloseIfPastDeadline_: chưa tới hạn chót (%s), bỏ qua.', DEADLINE_ISO);
      return;
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) {
      Logger.log('autoCloseIfPastDeadline_: chưa có sheet "Cấu hình" (chưa chạy setupConfigSheet()), bỏ qua.');
      return;
    }

    var cell = sheet.getRange(ACCEPTING_CELL);
    var current = String(cell.getValue()).trim().toUpperCase();
    if (current === 'ĐÓNG' || current === 'DONG' || current === 'CLOSED') {
      Logger.log('autoCloseIfPastDeadline_: form đã ở trạng thái ĐÓNG từ trước, không cần đổi.');
      return;
    }

    cell.setValue('ĐÓNG');
    Logger.log('=> autoCloseIfPastDeadline_: ĐÃ TỰ ĐỘNG ĐÓNG FORM (quá hạn chót %s).', DEADLINE_ISO);
  } catch (err) {
    // Có lỗi (ví dụ mất quyền tạm thời) -> ghi log, KHÔNG ném lỗi tiếp, để không làm
    // trigger bị Google tự tắt sau nhiều lần lỗi liên tiếp.
    Logger.log('autoCloseIfPastDeadline_ lỗi: %s', err);
  }
}

/**
 * CHẠY THỦ CÔNG 1 LẦN (giống setupConfigSheet()) để hẹn giờ tự động đóng form đúng
 * thời điểm AUTO_CLOSE_AT_ISO ở phần CẤU HÌNH. An toàn khi chạy lại nhiều lần — hàm
 * luôn xoá hết trigger cũ của autoCloseIfPastDeadline_ trước khi tạo trigger mới, nên
 * không bao giờ bị tạo trùng.
 *
 * QUAN TRỌNG: mỗi khi bạn đổi DEADLINE_ISO / AUTO_CLOSE_AT_ISO sang một hạn chót khác,
 * phải CHẠY LẠI hàm này một lần nữa — trigger đã hẹn giờ theo giá trị CŨ vẫn giữ
 * nguyên thời điểm cũ, nó không tự cập nhật theo hằng số mới trong code.
 */
function setupAutoCloseTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'autoCloseIfPastDeadline_') {
      ScriptApp.deleteTrigger(t);
    }
  });

  var at = new Date(AUTO_CLOSE_AT_ISO);
  if (isNaN(at.getTime())) {
    throw new Error('AUTO_CLOSE_AT_ISO sai định dạng: ' + AUTO_CLOSE_AT_ISO);
  }

  ScriptApp.newTrigger('autoCloseIfPastDeadline_')
    .timeBased()
    .at(at)
    .create();

  Logger.log('=> Đã hẹn giờ tự động đóng form vào lúc %s (%s).', AUTO_CLOSE_AT_ISO, at.toString());
}

// Mỗi cột cần dùng có thể có nhiều tên khác nhau tuỳ sheet đã được đặt/đổi tên thế nào
// (ví dụ cột đơn vị từng là "Đơn vị", sau đổi thành "Khoa/phòng"). Liệt kê hết các tên
// có thể gặp ở đây để việc đổi tên cột trong Sheet sau này KHÔNG làm hỏng tra cứu.
var COLUMN_ALIASES = {
  tenDeTai: ['Tên đề tài'],
  donVi: ['Khoa/phòng', 'Đơn vị', 'Đơn vị '],
  chuNhiem: ['Chủ nhiệm đề tài'],
  thanhVien: ['Thành viên', 'Thành viên tham gia đề tài'],
  maSo: ['Mã số đề tài']
};

/**
 * Tìm vị trí cột (index) trong header dựa theo danh sách các tên có thể có (alias).
 * headerMap: object { "tên header đã trim": index }
 */
function findColumnIndex_(headerMap, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    if (aliases[i] in headerMap) return headerMap[aliases[i]];
  }
  return -1;
}

/**
 * Trả về danh sách đề tài đã đăng ký của một Khoa/phòng trong một quý cụ thể,
 * lấy từ sheet tra cứu tương ứng ("2026 - Q1" hoặc "2026 - Q2").
 */
function getDeTaiList(khoaPhong, thoiGian) {
  // Trả JSON dạng chuỗi (thay vì mảng object thô) để tránh trường hợp
  // google.script.run tự marshal object phức tạp và làm rớt/đổi thứ tự field
  // (đã thấy trên thực tế: field "tenDeTai" bị mất khi trả object thô qua google.script.run).
  return JSON.stringify(getDeTaiList_(khoaPhong, thoiGian));
}

function getDeTaiList_(khoaPhong, thoiGian) {
  var sheetName = LOOKUP_SHEETS[thoiGian];
  if (!sheetName || !khoaPhong) return [];

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet tra cứu "' + sheetName + '". Kiểm tra lại tên sheet trong SPREADSHEET_ID.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = {};
  headers.forEach(function (h, i) {
    var key = String(h).trim();
    if (key && !(key in headerMap)) headerMap[key] = i; // giữ cột đầu tiên nếu trùng tên
  });

  var idx = {};
  var missing = [];
  Object.keys(COLUMN_ALIASES).forEach(function (field) {
    var found = findColumnIndex_(headerMap, COLUMN_ALIASES[field]);
    if (found === -1) missing.push(COLUMN_ALIASES[field].join(' / '));
    idx[field] = found;
  });

  if (missing.length) {
    throw new Error(
      'Sheet "' + sheetName + '" thiếu cột: ' + missing.join('; ') +
      '. Cột hiện có: ' + Object.keys(headerMap).join(', ')
    );
  }

  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var khoaTrim = String(khoaPhong).trim();
  var out = [];

  data.forEach(function (row) {
    var tenDeTai = String(row[idx.tenDeTai] || '').trim();
    var donVi = String(row[idx.donVi] || '').trim();
    if (!tenDeTai || donVi !== khoaTrim) return;

    var chuNhiem = String(row[idx.chuNhiem] || '').trim();
    var thanhVien = String(row[idx.thanhVien] || '').trim();
    var maSoRaw = row[idx.maSo];
    var maSo = '';
    if (typeof maSoRaw === 'number') {
      maSo = String(Math.round(maSoRaw));
    } else if (maSoRaw) {
      maSo = String(maSoRaw).trim();
    }

    out.push({
      tenDeTai: tenDeTai,
      chuNhiem: chuNhiem,
      thanhVien: thanhVien,
      maSo: maSo
    });
  });

  return out;
}

/**
 * BẮT BUỘC CHẠY 1 LẦN TRƯỚC KHI DÙNG THẬT (hoặc sau khi đổi tài khoản deploy).
 * Web app này chạy dưới quyền tài khoản NGƯỜI DEPLOY (executeAs: USER_DEPLOYING trong
 * appsscript.json) — nghĩa là mọi lượt nộp bài của BẤT KỲ ai đều dùng quyền Drive/Sheets
 * của tài khoản bạn dùng để Deploy, không phải quyền của người điền form. Tài khoản đó
 * cần cấp quyền Drive + Sheets cho script MỘT LẦN DUY NHẤT.
 *
 * Cách chạy: mở trình soạn thảo Apps Script bằng ĐÚNG tài khoản bạn dùng để Deploy
 * (ví dụ ariha@bvtn.edu.vn) → chọn hàm "authorizeDriveAndSheets" ở thanh Run ▶ → bấm nút
 * chạy (biểu tượng hình tam giác) → khi hộp thoại "Authorization required" hiện ra, bấm
 * "Review permissions" → chọn đúng tài khoản → bấm "Allow"/"Cho phép". Nếu Google cảnh
 * báo "App chưa được xác minh (unverified)", bấm "Advanced"/"Nâng cao" → "Go to ... (unsafe)"
 * → "Allow" (đây là bình thường với script tự viết, chưa đăng ký với Google).
 *
 * Sau khi chạy thành công 1 lần (xem log "Đã cấp quyền OK"), KHÔNG cần chạy lại nữa —
 * trừ khi bạn đổi tài khoản deploy hoặc revoke quyền theo cách khác.
 */
function authorizeDriveAndSheets() {
  var folder1 = DriveApp.getFolderById(PDF_FOLDER_ID);
  var folder2 = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(RESPONSE_SHEET_NAME);
  Logger.log('Đọc OK. Folder nghiệm thu: "%s" | Folder minh chứng: "%s" | Sheet: "%s"',
    folder1.getName(), folder2.getName(), sheet.getName());

  // Thử TẠO thật 1 file nháp trong folder nghiệm thu rồi xoá ngay — đây chính là thao
  // tác doPost() sẽ làm khi có người nộp bài, nên phải test đúng thao tác này (không chỉ
  // đọc) mới chắc chắn quyền ghi (createFile) đã được cấp đầy đủ.
  var testBlob = Utilities.newBlob('test', 'text/plain', '_authorize_test_xoa_duoc.txt');
  var testFile = folder1.createFile(testBlob);
  testFile.setTrashed(true);
  Logger.log('Tạo/xoá file thử OK — quyền ghi Drive đã đủ.');

  Logger.log('=> ĐÃ CẤP QUYỀN ĐẦY ĐỦ (đọc + ghi Drive, đọc + ghi Sheets). Có thể Deploy.');
}

/**
 * HÀM DEBUG THỦ CÔNG — không dùng trong webapp.
 * Chạy trực tiếp trong trình soạn thảo Apps Script (chọn hàm này ở thanh Run ▶) để
 * kiểm tra nhanh việc tra cứu có hoạt động đúng không, xem log ở View → Execution log.
 * Sửa 2 dòng bên dưới theo Khoa/phòng và Quý bạn muốn thử.
 */
function debugGetDeTaiList() {
  var khoaPhong = 'Khoa Cấp cứu';
  var thoiGian = 'Quý 1/2026';

  var sheetName = LOOKUP_SHEETS[thoiGian];
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  Logger.log('Sheet: %s | Header thực tế: %s', sheetName, JSON.stringify(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]));

  var result = getDeTaiList_(khoaPhong, thoiGian);
  Logger.log('Khoa/phòng="%s", Thời gian="%s" -> tìm thấy %s đề tài', khoaPhong, thoiGian, result.length);
  Logger.log(JSON.stringify(result.slice(0, 5), null, 2));
}

// ============================= XỬ LÝ NỘP BÀI =============================

function handleSubmit(payload) {
  // Chặn nộp bài nếu webapp đang ở trạng thái ĐÓNG (xem sheet "Cấu hình" / isAcceptingResponses_).
  // Kiểm tra lại ở đây (không chỉ ở doGet) để phòng trường hợp người dùng đã mở sẵn trang
  // từ lúc form còn MỞ rồi mới bấm Nộp sau khi form đã bị đóng.
  if (!isAcceptingResponses_()) {
    return { success: false, error: CLOSED_MESSAGE };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    validatePayload_(payload);

    var pdfUrl = uploadFileToFolder_(payload.pdfFile, PDF_FOLDER_ID, true, 'file PDF nghiệm thu đề tài');

    var hasEvidence = payload.hasEvidence === 'Có';
    var evidenceValue = '';
    if (hasEvidence) {
      if (payload.evidenceFile && payload.evidenceFile.data) {
        evidenceValue = uploadFileToFolder_(payload.evidenceFile, EVIDENCE_FOLDER_ID, true, 'file minh chứng');
      } else if (payload.evidenceLink) {
        evidenceValue = String(payload.evidenceLink).trim();
      }
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
    if (!sheet) throw new Error('Không tìm thấy sheet "' + RESPONSE_SHEET_NAME + '".');

    var isFreeText = payload.thoiGian === FREE_TEXT_OPTION;

    // Thứ tự cột đúng theo sheet "Nghiệm thu 2026 - Q3" hiện tại (A -> P):
    // Dấu thời gian | Địa chỉ email | Họ và tên người điền | SĐT người điền | Khoa/phòng |
    // Thời gian đăng ký | Tên đề tài | Chủ nhiệm | Thành viên | Mã số đề tài |
    // File PDF nghiệm thu | Có minh chứng đăng tạp chí? | Minh chứng đã đăng trên tạp chí |
    // Nộp mới/Nộp lại | Đề xuất người bình duyệt | Đề xuất không mong muốn
    sheet.appendRow([
      new Date(),                                  // Dấu thời gian
      payload.email || '',                          // Địa chỉ email (người dùng tự nhập)
      payload.hoTen,                                // Họ và tên của người điền form
      payload.soDienThoai,                          // Số điện thoại của người điền form
      payload.khoaPhong,                            // Khoa/phòng
      payload.thoiGian,                             // Thời gian đăng ký đề tài
      payload.tenDeTai,                             // Tên đề tài
      payload.chuNhiem,                             // Chủ nhiệm đề tài
      payload.thanhVien,                            // Thành viên tham gia đề tài
      isFreeText ? '' : (payload.maSo || ''),       // Mã số đề tài
      pdfUrl,                                        // Tải lên file PDF nghiệm thu đề tài
      hasEvidence ? 'Có' : 'Không',                  // Có minh chứng đăng tạp chí?
      evidenceValue,                                 // Minh chứng đã đăng trên tạp chí
      payload.submitType,                            // Nộp mới / Nộp lại
      payload.reviewers,                             // Đề xuất người bình duyệt
      payload.unwantedReviewers || ''                // Đề xuất không mong muốn
    ]);

    // Google Sheets tự động hiểu chuỗi số như "0917951026" là một con số và làm mất số 0
    // ở đầu (thành 917951026) khi ghi qua appendRow ở ô định dạng "Automatic". Sửa lại
    // ngay ô SĐT (cột D = cột thứ 4) của dòng vừa ghi: đặt định dạng ô về "Văn bản thô"
    // (Plain text) RỒI mới ghi lại đúng chuỗi gốc, để Sheets lưu nguyên văn không tự suy
    // luận thành số nữa.
    var newRowIndex = sheet.getLastRow();
    sheet.getRange(newRowIndex, 4).setNumberFormat('@').setValue(payload.soDienThoai);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function validatePayload_(p) {
  var missing = [];
  if (!p.hoTen) missing.push('Họ và tên của người điền form');
  if (!p.soDienThoai) missing.push('Số điện thoại của người điền form');
  if (!p.email) missing.push('Email của người điền form');
  if (!p.khoaPhong) missing.push('Khoa/phòng');
  if (!p.thoiGian) missing.push('Thời gian đăng ký đề tài');
  if (!p.tenDeTai) missing.push('Tên đề tài');
  if (!p.chuNhiem) missing.push('Chủ nhiệm đề tài');
  if (!p.thanhVien) missing.push('Thành viên tham gia đề tài');
  if (!p.submitType) missing.push('Nộp mới / Nộp lại');
  if (!p.hasEvidence) missing.push('Có minh chứng đăng tạp chí?');
  // Đề xuất người bình duyệt: không còn bắt buộc, có thể để trống.
  if (!p.pdfFile || !p.pdfFile.data) missing.push('File PDF nghiệm thu đề tài');

  if (missing.length) {
    throw new Error('Vui lòng điền đầy đủ: ' + missing.join(', '));
  }
  if (!/^0\d{9}$/.test(p.soDienThoai)) {
    throw new Error('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    throw new Error('Email của người điền form không hợp lệ.');
  }
  if (p.hasEvidence === 'Có' && !(p.evidenceFile && p.evidenceFile.data) && !p.evidenceLink) {
    throw new Error('Đã chọn "Có minh chứng đăng tạp chí" nhưng chưa có file hoặc liên kết minh chứng.');
  }
}

function uploadFileToFolder_(fileObj, folderId, mustBePdf, label) {
  if (!fileObj || !fileObj.data) {
    throw new Error('Thiếu dữ liệu ' + label + '.');
  }
  var mime = fileObj.mimeType || 'application/pdf';
  if (mustBePdf && mime.indexOf('pdf') === -1) {
    throw new Error('Chỉ chấp nhận định dạng PDF cho ' + label + '.');
  }

  var bytes;
  try {
    bytes = Utilities.base64Decode(fileObj.data);
  } catch (e) {
    throw new Error('Không đọc được dữ liệu ' + label + '.');
  }
  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('Dung lượng ' + label + ' vượt quá 10MB.');
  }

  var fileName = fileObj.name || 'file.pdf';
  if (mustBePdf && fileName.toLowerCase().indexOf('.pdf') === -1) {
    fileName += '.pdf';
  }

  var blob = Utilities.newBlob(bytes, mime, fileName);
  var folder = DriveApp.getFolderById(folderId);
  var file = folder.createFile(blob);
  return file.getUrl();
}
