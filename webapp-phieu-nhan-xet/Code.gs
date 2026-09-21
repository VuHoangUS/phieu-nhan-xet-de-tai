/**
 * WEBAPP PHIẾU NHẬN XÉT ĐỀ TÀI NCKH CẤP CƠ SỞ — LINK CÁ NHÂN HOÁ
 * Viện ARiHA - Bệnh viện Thống Nhất
 *
 * THAY THẾ cho cách cũ: prefill Google Form (link rất dài) + rút gọn qua TinyURL
 * (bị giới hạn số lượng link tạo được).
 *
 * CÁCH HOẠT ĐỘNG:
 *  - Mỗi người nhận xét / mỗi đề tài có một "Mã liên kết" (8 ký tự) gắn với ĐÚNG MỘT
 *    dòng trong sheet tra cứu "DS_đề_tài_thẩm_định". Link gửi cho người nhận xét có
 *    dạng: <URL webapp>?id=<mã liên kết> — ngắn, không cần TinyURL, không giới hạn
 *    số lượng vì mã do chính script tự sinh và lưu trong Sheet.
 *  - Khi có người mở link, doGet() tra cứu NGAY LÚC ĐÓ (không cache) dữ liệu của
 *    dòng tương ứng trong sheet tra cứu rồi điền sẵn vào form. Vì vậy, MỌI THAY ĐỔI
 *    bạn sửa trong sheet tra cứu ("DS_đề_tài_thẩm_định") sẽ tự động phản ánh vào
 *    form ngay lần mở link kế tiếp — không cần tạo lại link.
 *  - Khi nộp bài, server KHÔNG tin các trường "Họ và tên người nhận xét / Tên đề
 *    tài / Chủ nhiệm / File PDF" mà trình duyệt gửi lên — mà tự tra cứu lại lần
 *    nữa từ Mã liên kết, để tránh bị sửa trực tiếp trên trình duyệt (F12).
 *
 * Cấu trúc file:
 *  - Code.gs        : logic phía server (file này)
 *  - Index.html     : khung giao diện chính (đọc URL, tra Mã liên kết, render form)
 *  - CSS.html       : toàn bộ style (kế thừa đúng hệ thống class/màu của webapp
 *                      "Nộp nghiệm thu NCKH" cùng Viện đã làm trước đó, xem
 *                      reference/webapp-nghiem-thu-2026-q3/ trong repo)
 *  - JavaScript.html: toàn bộ logic phía client
 *
 * CÁCH TRIỂN KHAI: xem README.md đi kèm trong thư mục này.
 */

// Đổi chuỗi này mỗi khi sửa code, rồi so với dòng "Server code version" hiện ở cuối
// trang web đã deploy — nếu KHÔNG khớp nghĩa là bản deploy đang test vẫn là code CŨ.
var CODE_VERSION = 'v1-2026-09-21-personalized-link';

// ============================= CẤU HÌNH =============================

// Sheet TRA CỨU nguồn dữ liệu để điền sẵn (đề tài đã đăng ký thẩm định năm ngoái).
var LOOKUP_SPREADSHEET_ID = '1IuQdVd1944TKO8gMo98VuG-7-BPQ421q5tx1GDWOWRs';
var LOOKUP_SHEET_NAME = 'DS_đề_tài_thẩm_định';

// Sheet GHI KẾT QUẢ nhận xét (nơi lưu câu trả lời của người nhận xét).
var RESPONSE_SPREADSHEET_ID = '1H894S9x3JUWtZBCEdgsP5EiBbyBOjKkuGybgpSgXUK4';
// CHANGE ME nếu tên sheet thực tế trong file trên khác — mặc định script sẽ tự
// dùng SHEET ĐẦU TIÊN của file nếu không tìm thấy đúng tên này (xem
// getResponseSheet_ bên dưới), để không bao giờ crash chỉ vì lệch tên sheet.
var RESPONSE_SHEET_NAME = 'Trả lời nhận xét';

// Liên hệ hỗ trợ (hiện khi link không hợp lệ / hết hạn).
var CONTACT_EMAIL = 'ariha@bvtn.edu.vn';
var CONTACT_PHONE = '028 3869 0277 (Nội bộ: 750) (Giờ hành chính)';

// ---- Bật/tắt nhận nhận xét ----
// Sheet "Cấu hình" (tự tạo bằng setupConfigSheet(), nằm trong RESPONSE_SPREADSHEET_ID),
// ô B2 chứa "MỞ" hoặc "ĐÓNG". Đổi ô đó để đóng/mở form mà không cần sửa code.
var CONFIG_SHEET_NAME = 'Cấu hình';
var ACCEPTING_CELL = 'B2';
var CLOSED_MESSAGE = 'Đã hết hạn nhận phiếu nhận xét đề tài. Vui lòng liên hệ Viện ARiHA nếu cần hỗ trợ.';

// Bộ ký tự sinh Mã liên kết — cố tình bỏ các ký tự dễ nhầm (0/O, 1/I/L).
var LINK_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
var LINK_ID_LENGTH = 8;

// ============================= WEB APP ENTRY =============================

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.accepting = isAcceptingResponses_();
  template.closedMessage = CLOSED_MESSAGE;
  template.contactEmail = CONTACT_EMAIL;
  template.contactPhone = CONTACT_PHONE;

  var linkId = (e && e.parameter && e.parameter.id) ? String(e.parameter.id).trim() : '';
  template.linkId = linkId;
  // null nếu thiếu ?id=... trên URL, hoặc mã không khớp dòng nào trong sheet tra cứu.
  template.prefill = (template.accepting && linkId) ? lookupPrefillById_(linkId) : null;

  return template
    .evaluate()
    .setTitle('Phiếu nhận xét đề tài NCKH cấp cơ sở')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Nhận dữ liệu nộp bài gửi bằng fetch() (POST tới chính URL web app), không dùng
 * google.script.run để không bị giới hạn dung lượng tham số.
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

function getServerInfo() {
  return { version: CODE_VERSION, now: new Date().toString() };
}

function isAcceptingResponses_() {
  try {
    var ss = SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sheet) return true;
    var text = String(sheet.getRange(ACCEPTING_CELL).getValue()).trim().toUpperCase();
    return text !== 'ĐÓNG' && text !== 'DONG' && text !== 'CLOSED';
  } catch (err) {
    // Lỗi đọc cấu hình -> vẫn cho nhận bài, không khoá nhầm toàn bộ người dùng.
    return true;
  }
}

/** CHẠY THỦ CÔNG 1 LẦN để tạo sheet "Cấu hình" (nút bật/tắt nhận nhận xét). */
function setupConfigSheet() {
  var ss = SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  var justCreated = false;
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    justCreated = true;
  }
  if (justCreated || !sheet.getRange(ACCEPTING_CELL).getValue()) {
    sheet.getRange('A1').setValue('Cấu hình webapp Phiếu nhận xét đề tài (đừng xoá sheet này)');
    sheet.getRange('A2').setValue('Trạng thái nhận nhận xét:');
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

// ============================= TRA CỨU / SINH LINK CÁ NHÂN HOÁ =============================

// Mỗi field logic có thể ứng với nhiều tên cột khác nhau tuỳ Sheet đã đặt tên thế
// nào — liệt kê hết các tên có thể gặp để đổi tên cột trong Sheet không làm hỏng
// tra cứu. Cột "linkId" nếu chưa tồn tại sẽ được TỰ ĐỘNG TẠO bởi generateReviewLinks().
var LOOKUP_COLUMN_ALIASES = {
  linkId: ['Mã liên kết', 'Mã link', 'ID nhận xét'],
  reviewerName: ['Họ và tên người nhận xét', 'Người nhận xét', 'Họ tên người nhận xét'],
  reviewerEmail: ['Email người nhận xét', 'Email'],
  tenDeTai: ['Tên đề tài'],
  chuNhiem: ['Chủ nhiệm đề tài', 'Chủ nhiệm'],
  pdfLink: ['File PDF của đề tài nghiên cứu trên', 'File PDF của đề tài nghiên cứu trên:',
    'File PDF của đề tài', 'File PDF', 'Link PDF', 'PDF']
};

// Cột ghi ngược lại sau khi sinh link / sau khi nhận được bài nhận xét — tự tạo nếu
// sheet chưa có, không đè lên cột dữ liệu đang có.
var LOOKUP_HELPER_COLUMNS = {
  personalLink: 'Đường link cá nhân hoá',
  reviewedAt: 'Đã nhận xét lúc'
};

function getLookupSheet_() {
  var ss = SpreadsheetApp.openById(LOOKUP_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LOOKUP_SHEET_NAME);
  if (!sheet) {
    throw new Error('Không tìm thấy sheet tra cứu "' + LOOKUP_SHEET_NAME + '" trong file cấu hình LOOKUP_SPREADSHEET_ID.');
  }
  return sheet;
}

function buildHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = {};
  headers.forEach(function (h, i) {
    var key = String(h).trim();
    if (key && !(key in headerMap)) headerMap[key] = i; // giữ cột đầu tiên nếu trùng tên
  });
  return headerMap;
}

function findColumnIndex_(headerMap, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    if (aliases[i] in headerMap) return headerMap[aliases[i]];
  }
  return -1;
}

/**
 * Trả về index (0-based) của cột `headerName`, tự thêm cột mới vào cuối sheet nếu
 * chưa tồn tại (khớp theo alias). Cập nhật luôn headerMap truyền vào.
 */
function findOrCreateColumn_(sheet, headerMap, aliases, headerNameToCreate) {
  var idx = findColumnIndex_(headerMap, aliases);
  if (idx !== -1) return idx;
  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue(headerNameToCreate).setFontWeight('bold');
  var key = String(headerNameToCreate).trim();
  headerMap[key] = newCol - 1;
  return newCol - 1;
}

function lookupLookupIndexes_(sheet) {
  var headerMap = buildHeaderMap_(sheet);
  var idx = {};
  var missing = [];
  Object.keys(LOOKUP_COLUMN_ALIASES).forEach(function (field) {
    if (field === 'linkId') return; // xử lý riêng, tự tạo cột nếu thiếu
    var found = findColumnIndex_(headerMap, LOOKUP_COLUMN_ALIASES[field]);
    if (found === -1) missing.push(LOOKUP_COLUMN_ALIASES[field].join(' / '));
    idx[field] = found;
  });
  if (missing.length) {
    throw new Error(
      'Sheet "' + LOOKUP_SHEET_NAME + '" thiếu cột: ' + missing.join('; ') +
      '. Cột hiện có: ' + Object.keys(headerMap).join(', ')
    );
  }
  idx.linkId = findOrCreateColumn_(sheet, headerMap, LOOKUP_COLUMN_ALIASES.linkId, LOOKUP_COLUMN_ALIASES.linkId[0]);
  return idx;
}

/**
 * Tra cứu dữ liệu điền sẵn theo Mã liên kết. Luôn đọc TRỰC TIẾP từ Sheet (không
 * cache) — đây chính là lý do khi bạn sửa dữ liệu trong sheet tra cứu, link cũ vẫn
 * tự cập nhật mà không cần tạo lại.
 */
function lookupPrefillById_(linkId) {
  var sheet = getLookupSheet_();
  var idx = lookupLookupIndexes_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var wanted = String(linkId).trim().toUpperCase();

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var rowLinkId = String(row[idx.linkId] || '').trim().toUpperCase();
    if (rowLinkId && rowLinkId === wanted) {
      return {
        linkId: rowLinkId,
        reviewerName: String(row[idx.reviewerName] || '').trim(),
        reviewerEmail: String(row[idx.reviewerEmail] || '').trim(),
        tenDeTai: String(row[idx.tenDeTai] || '').trim(),
        chuNhiem: String(row[idx.chuNhiem] || '').trim(),
        pdfLink: String(row[idx.pdfLink] || '').trim(),
        rowNumber: r + 2
      };
    }
  }
  return null;
}

/**
 * CHẠY THỦ CÔNG mỗi khi có đề tài/người nhận xét MỚI cần cấp link (an toàn khi
 * chạy lại nhiều lần — dòng đã có Mã liên kết sẽ được GIỮ NGUYÊN, chỉ những dòng
 * còn trống mới được sinh mã mới). Sau khi chạy xong, cột "Đường link cá nhân hoá"
 * trong sheet tra cứu sẽ có sẵn link để copy gửi cho từng người.
 *
 * Muốn cấp LẠI một mã mới cho một dòng cụ thể (ví dụ gửi nhầm người): xoá tay ô
 * "Mã liên kết" của dòng đó rồi chạy lại hàm này.
 */
function generateReviewLinks() {
  var sheet = getLookupSheet_();
  var idx = lookupLookupIndexes_(sheet);
  var headerMap = buildHeaderMap_(sheet);
  var linkColIdx = findOrCreateColumn_(sheet, headerMap, [LOOKUP_HELPER_COLUMNS.personalLink], LOOKUP_HELPER_COLUMNS.personalLink);

  var scriptUrl = ScriptApp.getService().getUrl();
  if (!scriptUrl) {
    throw new Error('Chưa có URL web app đã deploy. Hãy Deploy > New deployment (Web app) ít nhất một lần rồi chạy lại hàm này.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Sheet tra cứu chưa có dữ liệu.');
    return;
  }
  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var existingCodes = {};
  data.forEach(function (row) {
    var code = String(row[idx.linkId] || '').trim().toUpperCase();
    if (code) existingCodes[code] = true;
  });

  var created = 0;
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var hasName = String(row[idx.reviewerName] || '').trim();
    var hasDeTai = String(row[idx.tenDeTai] || '').trim();
    if (!hasName && !hasDeTai) continue; // dòng trống, bỏ qua

    var rowNumber = r + 2;
    var code = String(row[idx.linkId] || '').trim().toUpperCase();
    if (!code) {
      code = generateUniqueCode_(existingCodes);
      existingCodes[code] = true;
      sheet.getRange(rowNumber, idx.linkId + 1).setNumberFormat('@').setValue(code);
      created++;
    }
    var link = scriptUrl + '?id=' + encodeURIComponent(code);
    sheet.getRange(rowNumber, linkColIdx + 1).setValue(link);
  }

  Logger.log('=> Đã xử lý %s dòng. Sinh mới %s Mã liên kết. Xem cột "%s" để lấy link.',
    data.length, created, LOOKUP_HELPER_COLUMNS.personalLink);
}

function generateUniqueCode_(existingCodes) {
  for (var attempt = 0; attempt < 50; attempt++) {
    var code = '';
    for (var i = 0; i < LINK_ID_LENGTH; i++) {
      code += LINK_ID_ALPHABET.charAt(Math.floor(Math.random() * LINK_ID_ALPHABET.length));
    }
    if (!existingCodes[code]) return code;
  }
  throw new Error('Không sinh được mã duy nhất, thử chạy lại generateReviewLinks().');
}

// ============================= XỬ LÝ NỘP NHẬN XÉT =============================

var SCORE_FIELDS = [
  { key: 'diemDatVanDe', label: 'Điểm - Đặt vấn đề' },
  { key: 'diemMucTieu', label: 'Điểm - Mục tiêu' },
  { key: 'diemPPNCThietKe', label: 'Điểm - PPNC (thiết kế và đối tượng nghiên cứu)' },
  { key: 'diemPPNCQuyTrinh', label: 'Điểm - PPNC (quy trình thu thập/phân tích)' },
  { key: 'diemKetQua', label: 'Điểm - Kết quả' },
  { key: 'diemKetLuanBanLuan', label: 'Điểm - Kết luận, bàn luận' },
  { key: 'diemCachTrinhBay', label: 'Điểm - Cách trình bày' }
];

var COMMENT_FIELDS = [
  { key: 'nxTinhCapThiet', label: 'Tính cấp thiết của chủ đề nghiên cứu' },
  { key: 'nxPhuHopThietKe', label: 'Sự phù hợp của thiết kế & phương pháp nghiên cứu' },
  { key: 'nxTinhMoi', label: 'Tính mới của kết quả nghiên cứu' },
  { key: 'nxYNghia', label: 'Ý nghĩa khoa học và ứng dụng thực tiễn' },
  { key: 'nxCanChinhSua', label: 'Các điểm cần chỉnh sửa' }
];

var RESPONSE_HEADERS = ['Dấu thời gian', 'Mã liên kết', 'Họ và tên người nhận xét', 'Email người nhận xét',
  'Tên đề tài', 'Chủ nhiệm đề tài', 'File PDF đề tài']
  .concat(SCORE_FIELDS.map(function (f) { return f.label; }))
  .concat(COMMENT_FIELDS.map(function (f) { return f.label; }))
  .concat(['KẾT LUẬN', 'Ý kiến về đề tài (nếu có)', 'Xếp loại']);

function handleSubmit(payload) {
  if (!isAcceptingResponses_()) {
    return { success: false, error: CLOSED_MESSAGE };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var linkId = String(payload.linkId || '').trim();
    if (!linkId) throw new Error('Thiếu Mã liên kết — vui lòng mở lại đúng link đã được gửi.');

    // KHÔNG tin dữ liệu người/đề tài mà trình duyệt gửi lên — tra cứu lại từ
    // Sheet nguồn theo linkId để đảm bảo đúng người, đúng đề tài.
    var prefill = lookupPrefillById_(linkId);
    if (!prefill) throw new Error('Mã liên kết không hợp lệ hoặc đã bị thay đổi. Vui lòng liên hệ Viện ARiHA để được cấp lại link.');

    validateAssessment_(payload);

    var ketLuan = String(payload.ketLuan || '').trim();
    var xepLoai = ketLuan === 'KHÔNG ĐẠT' ? 'KHÔNG ĐẠT' : String(payload.xepLoai || '').trim();

    var row = [new Date(), prefill.linkId, prefill.reviewerName, prefill.reviewerEmail,
      prefill.tenDeTai, prefill.chuNhiem, prefill.pdfLink];
    SCORE_FIELDS.forEach(function (f) { row.push(Number(payload[f.key])); });
    COMMENT_FIELDS.forEach(function (f) { row.push(String(payload[f.key] || '').trim()); });
    row.push(ketLuan, String(payload.ykien || '').trim(), xepLoai);

    upsertResponseRow_(prefill.linkId, row);
    markReviewedInLookup_(prefill.rowNumber);

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function validateAssessment_(p) {
  var missing = [];
  SCORE_FIELDS.forEach(function (f) {
    var v = Number(p[f.key]);
    if (!v || v < 1 || v > 5) missing.push(f.label);
  });
  COMMENT_FIELDS.forEach(function (f) {
    if (!String(p[f.key] || '').trim()) missing.push(f.label);
  });
  var ketLuan = String(p.ketLuan || '').trim();
  if (ketLuan !== 'ĐẠT' && ketLuan !== 'KHÔNG ĐẠT') missing.push('KẾT LUẬN');
  if (ketLuan === 'ĐẠT') {
    var xepLoai = String(p.xepLoai || '').trim();
    if (['Giỏi', 'Khá', 'Trung bình', 'KHÔNG ĐẠT'].indexOf(xepLoai) === -1) missing.push('Xếp loại');
  }
  if (missing.length) {
    throw new Error('Vui lòng điền đầy đủ: ' + missing.join(', '));
  }
}

function getResponseSheet_() {
  var ss = SpreadsheetApp.openById(RESPONSE_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0]; // fallback: không crash chỉ vì lệch tên sheet
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, RESPONSE_HEADERS.length).setValues([RESPONSE_HEADERS]).setFontWeight('bold');
  }
  return sheet;
}

/** Nộp lại (mở đúng link cũ, gửi lần 2) sẽ GHI ĐÈ lên dòng nhận xét trước đó của
 *  chính Mã liên kết đó, thay vì tạo dòng trùng lặp. */
function upsertResponseRow_(linkId, rowValues) {
  var sheet = getResponseSheet_();
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // cột B = Mã liên kết
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim().toUpperCase() === linkId.toUpperCase()) {
        targetRow = i + 2;
        break;
      }
    }
  }
  var writeRow = targetRow === -1 ? sheet.getLastRow() + 1 : targetRow;
  sheet.getRange(writeRow, 1, 1, rowValues.length).setValues([rowValues]);
  sheet.getRange(writeRow, 2).setNumberFormat('@').setValue(linkId); // giữ Mã liên kết là văn bản
}

function markReviewedInLookup_(rowNumber) {
  try {
    var sheet = getLookupSheet_();
    var headerMap = buildHeaderMap_(sheet);
    var col = findOrCreateColumn_(sheet, headerMap, [LOOKUP_HELPER_COLUMNS.reviewedAt], LOOKUP_HELPER_COLUMNS.reviewedAt);
    sheet.getRange(rowNumber, col + 1).setValue(new Date());
  } catch (err) {
    // Không để lỗi ghi chú "đã nhận xét lúc" làm hỏng việc nộp bài đã thành công.
    Logger.log('markReviewedInLookup_ lỗi (bỏ qua): %s', err);
  }
}

// ============================= CẤP QUYỀN 1 LẦN =============================

/**
 * BẮT BUỘC CHẠY 1 LẦN TRƯỚC KHI DÙNG THẬT (giống webapp Nộp nghiệm thu). Chạy bằng
 * ĐÚNG tài khoản sẽ Deploy (executeAs: USER_DEPLOYING trong appsscript.json).
 */
function authorizeSheets() {
  var lookupSheet = getLookupSheet_();
  var responseSheet = getResponseSheet_();
  Logger.log('Đọc/ghi OK. Sheet tra cứu: "%s" | Sheet kết quả: "%s"', lookupSheet.getName(), responseSheet.getName());
  Logger.log('=> ĐÃ CẤP QUYỀN ĐẦY ĐỦ. Có thể Deploy, sau đó chạy generateReviewLinks().');
}
