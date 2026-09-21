/**
 * WEBAPP PHIẾU NHẬN XÉT ĐỀ TÀI NCKH CẤP CƠ SỞ — LINK CÁ NHÂN HOÁ
 * Viện ARiHA - Bệnh viện Thống Nhất
 *
 * THAY THẾ cho cách cũ: prefill Google Form (link rất dài) + rút gọn qua một webapp
 * shortener riêng ghi vào sheet "Shortener" (bị giới hạn/cồng kềnh khi số đề tài
 * tăng lên).
 *
 * CÁCH BỐ TRÍ DỮ LIỆU (đúng theo sheet "DS_đề_tài_thẩm_định" thật của Viện):
 * mỗi ĐỀ TÀI là MỘT DÒNG, có tới 2 người thẩm định (Thẩm định 1 / Thẩm định 2),
 * mỗi người có một link nhận xét RIÊNG:
 *   ... | Google form link | Shorten Link | NOTE | Thẩm định 1 | Email TĐ1 |
 *   Thẩm định 2 | Email TĐ2 | GG form link 2 | Shorten Link 2
 * Script này ghi ĐÈ link cá nhân hoá mới (dạng "<URL webapp>?id=<mã>") vào đúng
 * 2 cột "Shorten Link" / "Shorten Link 2" đã có sẵn đó — không cần thêm cột mới
 * cho phần link gửi đi. Mỗi người thẩm định có mã riêng, không đụng tới người kia.
 *
 * CÁCH HOẠT ĐỘNG:
 *  - doGet() nhận ?id=<mã>, dò trong CẢ 2 cột mã liên kết (TĐ1 và TĐ2, script tự
 *    tạo 2 cột phụ "Mã liên kết TĐ1"/"Mã liên kết TĐ2" để lưu mã — không phải cột
 *    hiển thị link) của mọi dòng trong "DS_đề_tài_thẩm_định" để tìm đúng đề tài +
 *    đúng người thẩm định, rồi điền sẵn form NGAY LÚC MỞ TRANG (không cache) — sửa
 *    dữ liệu trong sheet là form tự cập nhật, không cần tạo lại link.
 *  - Khi nộp bài, server KHÔNG tin các trường Họ tên/Tên đề tài/Chủ nhiệm/PDF mà
 *    trình duyệt gửi lên — tự tra cứu lại theo mã liên kết để tránh sửa tay (F12).
 *
 * Cấu trúc file:
 *  - Code.gs        : logic phía server (file này)
 *  - Index.html     : khung giao diện chính (đọc URL, tra Mã liên kết, render form)
 *  - CSS.html       : toàn bộ style (kế thừa đúng CSS thật của webapp "Nộp nghiệm
 *                      thu NCKH" cùng Viện — xem reference/webapp-nghiem-thu-2026-q3/)
 *  - JavaScript.html: toàn bộ logic phía client
 *
 * CÁCH TRIỂN KHAI: xem README.md đi kèm trong thư mục này.
 */

// Đổi chuỗi này mỗi khi sửa code, rồi so với dòng "Server code version" hiện ở cuối
// trang web đã deploy — nếu KHÔNG khớp nghĩa là bản deploy đang test vẫn là code CŨ.
var CODE_VERSION = 'v2-2026-09-21-two-reviewer-slots';

// ============================= CẤU HÌNH =============================

// Sheet TRA CỨU nguồn dữ liệu để điền sẵn (đề tài đã đăng ký thẩm định).
var LOOKUP_SPREADSHEET_ID = '1IuQdVd1944TKO8gMo98VuG-7-BPQ421q5tx1GDWOWRs';
var LOOKUP_SHEET_NAME = 'DS_đề_tài_thẩm_định';

// Sheet GHI KẾT QUẢ nhận xét (nơi lưu câu trả lời của người nhận xét) — chính là
// sheet trả lời của Google Form "PHIẾU NHẬN XÉT ĐỀ TÀI..." các quý trước, để dữ
// liệu nối tiếp đúng vào các cột đã có (script tự dò theo TÊN CỘT, không theo vị
// trí, nên không quan trọng thứ tự cột hiện có).
var RESPONSE_SPREADSHEET_ID = '1H894S9x3JUWtZBCEdgsP5EiBbyBOjKkuGybgpSgXUK4';
// CHANGE ME nếu tên sheet thực tế trong file trên khác — không tìm thấy thì script
// tự dùng sheet đầu tiên của file (xem getResponseSheet_), không bao giờ crash chỉ
// vì lệch tên sheet.
var RESPONSE_SHEET_NAME = 'Trang tính1';

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
  // null nếu thiếu ?id=... trên URL, hoặc mã không khớp dòng/người thẩm định nào.
  var match = (template.accepting && linkId) ? lookupPrefillById_(linkId) : null;
  template.prefill = match ? match.prefill : null;

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

// Cột dữ liệu DÙNG CHUNG cho cả 2 người thẩm định (đề tài, chủ nhiệm, PDF) — liệt
// kê hết các tên cột có thể gặp để đổi tên cột trong Sheet không làm hỏng tra cứu.
var LOOKUP_COLUMN_ALIASES = {
  tenDeTai: ['Tên đề tài'],
  chuNhiem: ['Chủ nhiệm đề tài', 'Chủ nhiệm'],
  pdfLink: ['Bản PDF nghiệm thu đề tài', 'File PDF của đề tài nghiên cứu trên',
    'File PDF của đề tài nghiên cứu trên:', 'File PDF của đề tài', 'File PDF', 'Link PDF', 'PDF']
};

// 2 "chỗ" thẩm định trên mỗi dòng đề tài — đúng theo bố cục cột thật:
// ... | Shorten Link | NOTE | Thẩm định 1 | Email TĐ1 | Thẩm định 2 | Email TĐ2 | GG form link 2 | Shorten Link 2
// personalLinkAliases trỏ vào ĐÚNG cột "Shorten Link" / "Shorten Link 2" đã có sẵn
// (script ghi đè link cá nhân hoá mới vào đó); linkIdHeader/reviewedAtHeader là 2
// cột phụ (lưu mã thô + mốc thời gian đã nhận xét) mà script tự tạo nếu chưa có.
var REVIEWER_SLOTS = [
  {
    slot: 1,
    nameAliases: ['Thẩm định 1'],
    emailAliases: ['Email TĐ1', 'Email TD1'],
    personalLinkAliases: ['Shorten Link'],
    linkIdHeader: 'Mã liên kết TĐ1',
    reviewedAtHeader: 'Đã nhận xét lúc TĐ1'
  },
  {
    slot: 2,
    nameAliases: ['Thẩm định 2'],
    emailAliases: ['Email TĐ2', 'Email TD2'],
    personalLinkAliases: ['Shorten Link 2'],
    linkIdHeader: 'Mã liên kết TĐ2',
    reviewedAtHeader: 'Đã nhận xét lúc TĐ2'
  }
];

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
 * Trả về index (0-based) của cột, tự thêm cột mới vào cuối sheet nếu chưa tồn tại
 * (khớp theo alias). Cập nhật luôn headerMap truyền vào.
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

function getLookupCommonIndexes_(headerMap) {
  var idx = {};
  var missing = [];
  Object.keys(LOOKUP_COLUMN_ALIASES).forEach(function (field) {
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
  return idx;
}

/** name/email của mỗi slot BẮT BUỘC phải có sẵn (đây là dữ liệu gốc do người dùng
 *  nhập, script không tự tạo); linkId là cột phụ, tự tạo nếu thiếu. */
function getSlotIndexes_(sheet, headerMap, slotConfig) {
  var nameIdx = findColumnIndex_(headerMap, slotConfig.nameAliases);
  var emailIdx = findColumnIndex_(headerMap, slotConfig.emailAliases);
  if (nameIdx === -1 || emailIdx === -1) {
    throw new Error('Sheet "' + LOOKUP_SHEET_NAME + '" thiếu cột "' + slotConfig.nameAliases[0] +
      '" hoặc "' + slotConfig.emailAliases[0] + '".');
  }
  return {
    name: nameIdx,
    email: emailIdx,
    linkId: findOrCreateColumn_(sheet, headerMap, [slotConfig.linkIdHeader], slotConfig.linkIdHeader)
  };
}

/**
 * Tra cứu dữ liệu điền sẵn theo Mã liên kết — dò trong CẢ 2 cột mã (TĐ1, TĐ2) của
 * mọi dòng. Luôn đọc TRỰC TIẾP từ Sheet (không cache) — đây chính là lý do khi bạn
 * sửa dữ liệu trong sheet tra cứu, link cũ vẫn tự cập nhật mà không cần tạo lại.
 * Trả về { prefill: {...}, rowNumber, slotConfig } hoặc null nếu không khớp.
 */
function lookupPrefillById_(linkId) {
  var sheet = getLookupSheet_();
  var headerMap = buildHeaderMap_(sheet);
  var common = getLookupCommonIndexes_(headerMap);
  var slotIdx = REVIEWER_SLOTS.map(function (cfg) { return getSlotIndexes_(sheet, headerMap, cfg); });

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var lastCol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var wanted = String(linkId).trim().toUpperCase();

  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    for (var s = 0; s < REVIEWER_SLOTS.length; s++) {
      var idx = slotIdx[s];
      var rowLinkId = String(row[idx.linkId] || '').trim().toUpperCase();
      if (rowLinkId && rowLinkId === wanted) {
        return {
          rowNumber: r + 2,
          slotConfig: REVIEWER_SLOTS[s],
          prefill: {
            linkId: rowLinkId,
            reviewerName: String(row[idx.name] || '').trim(),
            reviewerEmail: String(row[idx.email] || '').trim(),
            tenDeTai: String(row[common.tenDeTai] || '').trim(),
            chuNhiem: String(row[common.chuNhiem] || '').trim(),
            pdfLink: String(row[common.pdfLink] || '').trim()
          }
        };
      }
    }
  }
  return null;
}

/**
 * CHẠY THỦ CÔNG mỗi khi có đề tài/người thẩm định MỚI cần cấp link (an toàn khi
 * chạy lại nhiều lần — dòng/slot đã có Mã liên kết sẽ GIỮ NGUYÊN mã cũ, chỉ những
 * chỗ còn trống mới được sinh mã mới). Link cá nhân hoá luôn được ghi (đè) vào
 * đúng cột "Shorten Link" (Thẩm định 1) / "Shorten Link 2" (Thẩm định 2) đã có sẵn
 * trong sheet — không tạo cột hiển thị link mới.
 *
 * Muốn cấp LẠI một mã mới cho một người cụ thể (ví dụ gửi nhầm người): xoá tay ô
 * "Mã liên kết TĐ1"/"Mã liên kết TĐ2" (cột phụ do script tạo) của dòng đó rồi chạy
 * lại hàm này.
 */
function generateReviewLinks() {
  var sheet = getLookupSheet_();
  var headerMap = buildHeaderMap_(sheet);
  var common = getLookupCommonIndexes_(headerMap);
  var slotIdx = REVIEWER_SLOTS.map(function (cfg) { return getSlotIndexes_(sheet, headerMap, cfg); });
  var linkColIdx = REVIEWER_SLOTS.map(function (cfg) {
    return findOrCreateColumn_(sheet, headerMap, cfg.personalLinkAliases, cfg.personalLinkAliases[0]);
  });

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
    slotIdx.forEach(function (idx) {
      var code = String(row[idx.linkId] || '').trim().toUpperCase();
      if (code) existingCodes[code] = true;
    });
  });

  var created = 0;
  var refreshed = 0;
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    var rowNumber = r + 2;
    var hasDeTai = String(row[common.tenDeTai] || '').trim();
    if (!hasDeTai) continue; // dòng trống, bỏ qua

    for (var s = 0; s < REVIEWER_SLOTS.length; s++) {
      var idx = slotIdx[s];
      var hasName = String(row[idx.name] || '').trim();
      if (!hasName) continue; // slot này chưa phân công người thẩm định

      var code = String(row[idx.linkId] || '').trim().toUpperCase();
      if (!code) {
        code = generateUniqueCode_(existingCodes);
        existingCodes[code] = true;
        sheet.getRange(rowNumber, idx.linkId + 1).setNumberFormat('@').setValue(code);
        created++;
      }
      var link = scriptUrl + '?id=' + encodeURIComponent(code);
      sheet.getRange(rowNumber, linkColIdx[s] + 1).setValue(link);
      refreshed++;
    }
  }

  Logger.log('=> Đã xử lý %s dòng đề tài. Sinh mới %s mã, ghi/làm mới %s link (tổng cả 2 slot). ' +
    'Xem cột "Shorten Link" / "Shorten Link 2" trong sheet tra cứu để lấy link gửi đi.',
    data.length, created, refreshed);
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

// Tên cột GHI ĐÚNG theo sheet trả lời thật của Google Form "PHIẾU NHẬN XÉT ĐỀ TÀI
// NGHIÊN CỨU KHOA HỌC CẤP CƠ SỞ" các quý trước — nhờ vậy dữ liệu mới nối tiếp đúng
// vào các cột sẵn có thay vì tạo một bố cục khác. "Mã liên kết" là cột phụ mới,
// script tự tạo nếu sheet chưa có (dùng để chống nộp trùng khi mở lại cùng link).
var RESPONSE_FIELD_HEADERS = {
  timestamp: 'Dấu thời gian',
  linkId: 'Mã liên kết',
  reviewerName: 'Họ và tên người nhận xét',
  reviewerEmail: 'Email người nhận xét',
  tenDeTai: 'Tên đề tài',
  chuNhiem: 'Chủ nhiệm đề tài',
  pdfLink: 'File PDF của đề tài nghiên cứu trên:',
  diemDatVanDe: '1. Đặt vấn đề [Giới thiệu được vấn đề hoặc khoảng cách giữa mong muốn và thực tế]',
  diemMucTieu: '2. Mục tiêu [Đưa ra mục tiêu rõ ràng liên quan đến chủ đề nghiên cứu]',
  diemPPNCThietKe: '3. Phương pháp nghiên cứu [Thiết kế và đối tượng nghiên cứu được mô tả rõ ràng, phù hợp với nội dung và đáp ứng được mục tiêu một cách hiệu quả]',
  diemPPNCQuyTrinh: '3. Phương pháp nghiên cứu [Quy trình triển khai thu thập thông tin và phân tích dữ liệu được mô tả rõ ràng]',
  diemKetQua: '4. Kết quả [Kết quả nghiên cứu được trình bày khoa học, đáp ứng được mục tiêu nghiên cứu]',
  diemKetLuanBanLuan: '5. Kết luận - Bàn luận [Kết luận - bàn luận được đưa ra phù hợp với kết quả và đúng theo các mục tiêu]',
  diemCachTrinhBay: '6. Cách trình bày [Nội dung được trình bày hấp dẫn và giúp cho người đọc muốn tìm hiểu thêm về vấn đề]',
  nxTinhCapThiet: 'Tính cấp thiết của chủ đề nghiên cứu?',
  nxPhuHopThietKe: 'Sự phù hợp của thiết kế nghiên cứu và phương pháp nghiên cứu?',
  nxTinhMoi: 'Tính mới của những kết quả nghiên cứu?',
  nxYNghia: 'Ý nghĩa khoa học và ứng dụng thực tiễn?',
  nxCanChinhSua: 'Các điểm cần chỉnh sửa:',
  ketLuan: 'KẾT LUẬN',
  ykien: 'Ý kiến về đề tài (Nếu có)',
  xepLoai: 'Xếp loại'
};

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
    var match = lookupPrefillById_(linkId);
    if (!match) throw new Error('Mã liên kết không hợp lệ hoặc đã bị thay đổi. Vui lòng liên hệ Viện ARiHA để được cấp lại link.');

    validateAssessment_(payload);

    var ketLuan = String(payload.ketLuan || '').trim();
    var xepLoai = ketLuan === 'KHÔNG ĐẠT' ? 'KHÔNG ĐẠT' : String(payload.xepLoai || '').trim();

    var fields = {
      reviewerName: match.prefill.reviewerName,
      reviewerEmail: match.prefill.reviewerEmail,
      tenDeTai: match.prefill.tenDeTai,
      chuNhiem: match.prefill.chuNhiem,
      pdfLink: match.prefill.pdfLink,
      ketLuan: ketLuan,
      ykien: String(payload.ykien || '').trim(),
      xepLoai: xepLoai
    };
    SCORE_FIELDS.forEach(function (f) { fields[f.key] = Number(payload[f.key]); });
    COMMENT_FIELDS.forEach(function (f) { fields[f.key] = String(payload[f.key] || '').trim(); });

    upsertResponseRow_(match.prefill.linkId, fields);
    markReviewedInLookup_(match.rowNumber, match.slotConfig);

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
  return sheet;
}

function ensureResponseColumns_(sheet) {
  var headerMap = buildHeaderMap_(sheet);
  var idx = {};
  Object.keys(RESPONSE_FIELD_HEADERS).forEach(function (key) {
    idx[key] = findOrCreateColumn_(sheet, headerMap, [RESPONSE_FIELD_HEADERS[key]], RESPONSE_FIELD_HEADERS[key]);
  });
  return idx;
}

/** Nộp lại (mở đúng link cũ, gửi lần 2) sẽ GHI ĐÈ lên dòng nhận xét trước đó của
 *  chính Mã liên kết đó, thay vì tạo dòng trùng lặp. Ghi theo TÊN CỘT (không theo
 *  vị trí cố định) nên khớp đúng vào sheet trả lời Google Form đã có sẵn. */
function upsertResponseRow_(linkId, fields) {
  var sheet = getResponseSheet_();
  var idx = ensureResponseColumns_(sheet);

  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, idx.linkId + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0] || '').trim().toUpperCase() === linkId.toUpperCase()) {
        targetRow = i + 2;
        break;
      }
    }
  }
  var writeRow = targetRow === -1 ? sheet.getLastRow() + 1 : targetRow;

  Object.keys(fields).forEach(function (key) {
    if (!(key in idx)) return;
    sheet.getRange(writeRow, idx[key] + 1).setValue(fields[key]);
  });
  sheet.getRange(writeRow, idx.linkId + 1).setNumberFormat('@').setValue(linkId); // giữ mã là văn bản
  sheet.getRange(writeRow, idx.timestamp + 1).setValue(new Date());
}

function markReviewedInLookup_(rowNumber, slotConfig) {
  try {
    var sheet = getLookupSheet_();
    var headerMap = buildHeaderMap_(sheet);
    var col = findOrCreateColumn_(sheet, headerMap, [slotConfig.reviewedAtHeader], slotConfig.reviewedAtHeader);
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
