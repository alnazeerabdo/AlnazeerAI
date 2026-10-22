/**
 * النذير — Google Apps Script (web app)
 * يستقبل: نموذج الحجز + نموذج التواصل + سجل محادثات المساعد الذكي
 *
 * routing:
 *   log=chat     -> tab "محادثات AI"  (بدون إيميل) — مفصول بمعرّف المحادثة
 *   form=booking -> tab "استشارات"   (مع إيميل)
 *   form=contact -> tab "تواصل"       (مع إيميل حسب EMAIL_ON_CONTACT)
 */

const NOTIFY_EMAIL = 'alnzyrbdalmnm90@gmail.com';
const EMAIL_ON_CONTACT = true;   // اجعلها false لإيقاف إيميل نموذج التواصل أيضاً
const CHAT_TAB = 'محادثات AI';
const ONE_TAB_PER_CHAT = false;  // true = تبويب مستقل لكل محادثة بدل الفواصل داخل تبويب واحد

// إذا كان السكربت مستقلاً (غير مرتبط بملف Google Sheet):
// ضع معرّف الملف هنا — انسخه من رابط الملف: /spreadsheets/d/XXXXXXXX/edit
const SHEET_ID = '';

const CHAT_HEADERS = ['الوقت', 'المحادثة', 'السؤال', 'الرد', 'الصفحة'];

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// يجلب التبويب أو ينشئه (مع عناوين الأعمدة فقط عند الإنشاء)
function getSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  if (headers && headers.length) sh.appendRow(headers);
  return sh;
}

/**
 * تبويب المحادثات: إذا كان التبويب موجوداً بترتيب أعمدة قديم (وقت/سؤال/رد)
 * يُؤرشف ويُنشأ تبويب جديد بنفس الاسم بالتسليم الجديد.
 */
function ensureChatSheet(ss, headers) {
  var sh = ss.getSheetByName(CHAT_TAB);
  if (sh) {
    var current = sh.getRange(1, 1, 1, headers.length).getValues()[0]
      .map(function (x) { return String(x).trim(); });
    var same = headers.every(function (v, i) { return current[i] === v; });
    if (same) return sh;
    var oldName = CHAT_TAB + ' (قديم)';
    var n = 2;
    while (ss.getSheetByName(oldName)) { oldName = CHAT_TAB + ' (قديم ' + n + ')'; n++; }
    ss.renameSheet(sh, oldName);
  }
  sh = ss.insertSheet(CHAT_TAB);
  sh.appendRow(headers);
  return sh;
}

// آخر محادثة مسجّلة (للكشف عن بداية محادثة جديدة)
function lastSession(sh) {
  var last = sh.getLastRow();
  if (last < 2) return '';
  return String(sh.getRange(last, 2).getValue() || '').trim();
}

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss && SHEET_ID) ss = SpreadsheetApp.openById(SHEET_ID);
    if (!ss) return json({ ok: false, error: 'no active spreadsheet' });

    // ===== 1) سجل محادثات المساعد الذكي — بدون إيميل =====
    if (p.log === 'chat') {
      var sid = String(p.session || '').slice(0, 40);
      var label = sid ? sid.replace(/^c-/, '#') : '#غير-معروف';
      var page = String(p.page || '').slice(0, 120);
      var chat;

      if (ONE_TAB_PER_CHAT) {
        // تبويب مستقل لكل محادثة
        var tabName = 'محادثة ' + label;
        chat = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
        if (chat.getLastRow() === 0) chat.appendRow(CHAT_HEADERS);
      } else {
        // تبويب واحد + سطر فاصل عند بداية كل محادثة
        chat = ensureChatSheet(ss, CHAT_HEADERS);
        if (lastSession(chat) !== label) {
          chat.appendRow([new Date(), label, '— بداية محادثة جديدة —', '', page]);
        }
      }

      chat.appendRow([new Date(), label, p.question || '', p.answer || '', page]);
      return json({ ok: true, sheet: ss.getUrl(), tab: chat.getName(), row: chat.getLastRow(), session: label, emailed: false });
    }

    // ===== 2) نموذج الحجز ونموذج التواصل — مع الإيميل =====
    var isContact = (p.form === 'contact');
    var subject, body, sheet, row;

    if (isContact) {
      sheet = getSheet(ss, 'تواصل', ['الوقت', 'الاسم', 'الجوال', 'الإيميل', 'الرسالة']);
      row = [new Date(), p.name || '', p.phone || '', p.email || '', p.message || ''];
      sheet.appendRow(row);
      subject = 'رسالة تواصل جديدة: ' + (p.name || '');
      body = 'الاسم: ' + (p.name || '') + '\nالواتساب: ' + (p.phone || '') + '\nالإيميل: ' + (p.email || '') + '\nالرسالة: ' + (p.message || '');
    } else {
      sheet = getSheet(ss, 'استشارات', ['الوقت', 'الاسم', 'الجوال', 'الإيميل', 'العمل', 'المشكلة', 'الحجم']);
      row = [new Date(), p.name || '', p.phone || '', p.email || '', p.work || '', p.problem || '', p.size || ''];
      sheet.appendRow(row);
      subject = 'طلب استشارة جديد: ' + (p.name || '');
      body = 'الاسم: ' + (p.name || '') + '\nالجوال: ' + (p.phone || '') + '\nالإيميل: ' + (p.email || '') + '\nالعمل: ' + (p.work || '') + '\nالمشكلة: ' + (p.problem || '') + '\nالحجم: ' + (p.size || '');
    }

    var emailed = false;
    if (isContact ? EMAIL_ON_CONTACT : true) {
      MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: subject, body: body });
      emailed = true;
    }

    return json({ ok: true, sheet: ss.getUrl(), tab: sheet.getName(), row: sheet.getLastRow(), emailed: emailed });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// فحص سريع: افتح رابط /exec في المتصفح
function doGet() {
  return json({ ok: true, service: 'النذير — استقبال النماذج والمحادثات' });
}
