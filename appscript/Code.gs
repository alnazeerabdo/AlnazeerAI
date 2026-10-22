/**
 * النذير — Google Apps Script (web app)
 * يستقبل: نموذج الحجز + نموذج التواصل + سجل محادثات المساعد الذكي
 *
 * routing:
 *   log=chat              -> tab "محادثات AI"      (بدون إيميل)
 *   form=booking          -> tab "استشارات"       (مع إيميل)
 *   form=contact          -> tab "تواصل"           (مع إيميل حسب EMAIL_ON_CONTACT)
 */

const NOTIFY_EMAIL = 'alnzyrbdalmnm90@gmail.com';
const EMAIL_ON_CONTACT = true;   // اجعلها false لإيقاف إيميل نموذج التواصل أيضاً
const CHAT_TAB = 'محادثات AI';

// ضع معرّف الـ Spreadsheet هنا إذا كان السكربت مستقلاً (غير مرتبط بملف):
// الملف > المعرّف: انسخه من الرابط /spreadsheets/d/XXXXXXXX/edit
const SHEET_ID = '';

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  if (headers && headers.length) sh.appendRow(headers);
  return sh;
}

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss && SHEET_ID) ss = SpreadsheetApp.openById(SHEET_ID);
    if (!ss) return json({ ok: false, error: 'no active spreadsheet' });

    // 1) سجل محادثات المساعد الذكي — بدون إيميل
    if (p.log === 'chat') {
      var chat = getSheet(ss, CHAT_TAB, ['الوقت', 'السؤال', 'الرد']);
      chat.appendRow([new Date(), p.question || '', p.answer || '']);
      return json({ ok: true, sheet: ss.getUrl(), tab: chat.getName(), row: chat.getLastRow(), emailed: false });
    }

    // 2) نموذج الحجز / نموذج التواصل
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

// فحص سريع للتأكد أن النشر يعمل: افتح رابط /exec في المتصفح
function doGet() {
  return json({ ok: true, service: 'النذير — استقبال النماذج والمحادثات' });
}
