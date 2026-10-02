/**
 * Gom danh sách đề tài theo từng người thẩm định (dùng cho file "Theo dõi mã số
 * đề tài NCCCS" — 19BLa5sH0xyLrvUa-F7cbuuiVRb7KPyuzaKoWMKeLQCE).
 *
 * Đọc sheet "Nghiệm thu 2026 - Q3", với mỗi đề tài xét cả 2 người thẩm định
 * (Thẩm định 1 + Email TĐ1 -> dùng link ở cột "Form 1"; Thẩm định 2 + Email TĐ2
 * -> dùng link ở cột "Form 2"), gom theo người (khớp theo Email, không phân biệt
 * hoa/thường — nếu thiếu email thì khớp theo tên), rồi ghi sang sheet
 * "Danh_sách_đề_tài_1" với 3 cột: Họ và tên | Email | Danh_sách_đề_tài.
 *
 * Mỗi đề tài trong ô "Danh_sách_đề_tài" được đánh số thứ tự, CẢ DÒNG "Tên đề tài:
 * ..." (nhãn + tên đề tài) được in đậm, ví dụ:
 *
 *   1. Tên đề tài: Khảo sát ...
 *   Khoa/phòng: Khoa Cấp cứu
 *   Link phiếu thẩm định: https://script.google.com/.../exec?id=XXXXXXXX
 *
 *   2. Tên đề tài: ...
 *   ...
 *
 * CÁCH DÙNG: dán hàm này vào Apps Script của chính spreadsheet trên (Tiện ích mở
 * rộng > Apps Script từ Google Sheet, hoặc dán thêm vào project Apps Script của
 * webapp Phiếu nhận xét — cùng trỏ vào 1 file Sheet này), chọn hàm
 * generateReviewerWorklist ở thanh Run ▶ rồi bấm chạy. An toàn khi chạy lại nhiều
 * lần — mỗi lần chạy sẽ XOÁ TRẮNG và ghi lại toàn bộ sheet "Danh_sách_đề_tài_1".
 */
function generateReviewerWorklist() {
  var SPREADSHEET_ID = '19BLa5sH0xyLrvUa-F7cbuuiVRb7KPyuzaKoWMKeLQCE';
  var SOURCE_SHEET_NAME = 'Nghiệm thu 2026 - Q3';
  var DEST_SHEET_NAME = 'Danh_sách_đề_tài_1';
  // Chỉ đọc tới hàng này của sheet nguồn (kể cả hàng tiêu đề) — đổi lại nếu phạm
  // vi dữ liệu thay đổi. Hiện đang giới hạn ở hàng 96 theo yêu cầu.
  var SOURCE_LAST_ROW = 96;

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var srcSheet = ss.getSheetByName(SOURCE_SHEET_NAME);
  if (!srcSheet) throw new Error('Không tìm thấy sheet "' + SOURCE_SHEET_NAME + '".');

  var headerMap = rw_buildHeaderMap_(srcSheet);
  var col = {
    tenDeTai: rw_requireColumn_(headerMap, 'Tên đề tài', SOURCE_SHEET_NAME),
    khoaPhong: rw_requireColumn_(headerMap, 'Khoa/phòng', SOURCE_SHEET_NAME),
    form1: rw_requireColumn_(headerMap, 'Form 1', SOURCE_SHEET_NAME),
    form2: rw_requireColumn_(headerMap, 'Form 2', SOURCE_SHEET_NAME),
    td1: rw_requireColumn_(headerMap, 'Thẩm định 1', SOURCE_SHEET_NAME),
    emailTd1: rw_requireColumn_(headerMap, 'Email TĐ1', SOURCE_SHEET_NAME),
    td2: rw_requireColumn_(headerMap, 'Thẩm định 2', SOURCE_SHEET_NAME),
    emailTd2: rw_requireColumn_(headerMap, 'Email TĐ2', SOURCE_SHEET_NAME)
  };

  var lastRow = Math.min(srcSheet.getLastRow(), SOURCE_LAST_ROW);
  var lastCol = srcSheet.getLastColumn();
  var reviewers = {}; // key -> { name, email, topics: [{tenDeTai, khoaPhong, link}] }
  var order = []; // thứ tự xuất hiện lần đầu, để ghi ra sheet theo đúng thứ tự đó

  function addTopicForReviewer(name, email, tenDeTai, khoaPhong, link) {
    name = String(name || '').trim();
    email = String(email || '').trim();
    if (!name && !email) return; // vị trí thẩm định này chưa phân công ai, bỏ qua

    var key = (email || name).toLowerCase();
    if (!reviewers[key]) {
      reviewers[key] = { name: name, email: email, topics: [] };
      order.push(key);
    }
    reviewers[key].topics.push({
      tenDeTai: String(tenDeTai || '').trim(),
      khoaPhong: String(khoaPhong || '').trim(),
      link: String(link || '').trim()
    });
  }

  if (lastRow >= 2) {
    var data = srcSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    data.forEach(function (row) {
      var tenDeTai = row[col.tenDeTai];
      if (!String(tenDeTai || '').trim()) return; // dòng trống, bỏ qua
      var khoaPhong = row[col.khoaPhong];

      addTopicForReviewer(row[col.td1], row[col.emailTd1], tenDeTai, khoaPhong, row[col.form1]);
      addTopicForReviewer(row[col.td2], row[col.emailTd2], tenDeTai, khoaPhong, row[col.form2]);
    });
  }

  var destSheet = ss.getSheetByName(DEST_SHEET_NAME);
  if (!destSheet) {
    destSheet = ss.insertSheet(DEST_SHEET_NAME);
  } else {
    destSheet.clear();
  }

  destSheet.getRange(1, 1, 1, 3)
    .setValues([['Họ và tên', 'Email', 'Danh_sách_đề_tài']])
    .setFontWeight('bold');

  order.forEach(function (key, i) {
    var r = reviewers[key];
    var rowIndex = i + 2;
    destSheet.getRange(rowIndex, 1).setValue(r.name);
    destSheet.getRange(rowIndex, 2).setValue(r.email);
    destSheet.getRange(rowIndex, 3).setRichTextValue(rw_buildTopicListRichText_(r.topics));
  });

  if (order.length) {
    destSheet.getRange(2, 3, order.length, 1).setWrap(true).setVerticalAlignment('top');
  }
  destSheet.setColumnWidth(1, 180);
  destSheet.setColumnWidth(2, 220);
  destSheet.setColumnWidth(3, 520);
  destSheet.setFrozenRows(1);

  Logger.log('=> Đã gom %s người thẩm định (tổng %s lượt phân công đề tài) vào sheet "%s".',
    order.length, order.reduce(function (sum, k) { return sum + reviewers[k].topics.length; }, 0), DEST_SHEET_NAME);
}

/** Dựng nội dung 1 ô "Danh_sách_đề_tài": đánh số từng đề tài, in đậm CẢ DÒNG
 *  "Tên đề tài: ..." (nhãn + tên đề tài), các dòng khác giữ chữ thường. */
function rw_buildTopicListRichText_(topics) {
  var text = '';
  var boldRanges = [];

  topics.forEach(function (t, i) {
    text += (i + 1) + '. ';

    var lineStart = text.length;
    text += 'Tên đề tài: ' + (t.tenDeTai || '(không có tên)');
    boldRanges.push([lineStart, text.length]);
    text += '\n';

    text += 'Khoa/phòng: ' + (t.khoaPhong || '(không có dữ liệu)') + '\n';
    text += 'Link phiếu thẩm định: ' + (t.link || '(chưa có link)') + '\n';

    if (i < topics.length - 1) text += '\n';
  });

  var builder = SpreadsheetApp.newRichTextValue().setText(text || '(không có đề tài nào)');
  var boldStyle = SpreadsheetApp.newTextStyle().setBold(true).build();
  boldRanges.forEach(function (r) {
    builder.setTextStyle(r[0], r[1], boldStyle);
  });
  return builder.build();
}

function rw_buildHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  headers.forEach(function (h, i) {
    var key = String(h).trim();
    if (key && !(key in map)) map[key] = i; // giữ cột đầu tiên nếu trùng tên
  });
  return map;
}

function rw_requireColumn_(headerMap, headerName, sheetName) {
  if (!(headerName in headerMap)) {
    throw new Error('Sheet "' + sheetName + '" thiếu cột "' + headerName + '". Cột hiện có: ' + Object.keys(headerMap).join(', '));
  }
  return headerMap[headerName];
}
