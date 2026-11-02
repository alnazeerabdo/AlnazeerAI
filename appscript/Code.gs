/**
 * النذير — Google Apps Script (Web App + Dashboard API)
 * ------------------------------------------------------
 *  - doPost: يستقبل الحجوزات والتواصل وسجل محادثات المساعد الذكي.
 *  - doGet : يعرض لوحة التحكم (Index.html) ولا يرسل أي بيانات قبل التحقق.
 *  - getDashboardDataSecure(pin): المصدر الوحيد للبيانات من الواجهة.
 *
 * ملاحظات:
 *  - كل محادثة تُجمَّع حسب معرّف الجلسة (عمود «المحادثة») وليس حسب ترتيب الصفوف،
 *    لذلك محادثات الزوار لا تختلط حتى لو وصلت متداخلة.
 *  - الصفوف القديمة التي تحمل «— بداية محادثة جديدة —» تُتجاهل.
 *  - يمكن تغيير رمز الدخول من Project Settings → Script Properties:
 *       DASHBOARD_PIN      = 9090
 *       DASHBOARD_PASSWORD = alnazeer2026
 */

var NOTIFY_EMAIL = 'alnzyrbdalmnm90@gmail.com';
var EMAIL_ON_CONTACT = true;

var CHAT_TAB = 'محادثات AI';
var CHAT_HEADERS = ['الوقت', 'المحادثة', 'السؤال', 'الرد', 'الصفحة'];
var ONE_TAB_PER_CHAT = false; // اجعلها true فقط إذا أردت تبويباً لكل جلسة (تستهلك حد التبويبات)

var SHEET_ID = '1oC-a3q5kNGl21R4iwk6y62RX6Cgrd-Ta7G7c81yBpaU';

var MASTER_PIN = '9090';
var MASTER_PASSWORD = 'alnazeer2026';

var MAX_CHAT_ROWS = 3000;
var MAX_APP_ROWS = 2000;
var MAX_CONTACT_ROWS = 1000;
var SESSION_GAP_MINUTES = 30;

/* ============================================================
   Helpers
   ============================================================ */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** JSON آمن للزرع داخل HTML (يمنع كسر وسم script). */
function jsonForHtml_(obj) {
  return JSON.stringify(obj)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function tz_() {
  return Session.getScriptTimeZone() || 'Africa/Khartoum';
}

function fmtDateTime_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm');
  }
  if (typeof v === 'number') {
    var dn = new Date(v);
    return isNaN(dn.getTime()) ? String(v) : Utilities.formatDate(dn, tz_(), 'yyyy-MM-dd HH:mm');
  }
  return String(v).trim();
}

function toDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'number') {
    var dn = new Date(v);
    return isNaN(dn.getTime()) ? null : dn;
  }
  var s = String(v).trim();
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    var yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    var d2 = new Date(yy, parseInt(m[2], 10) - 1, parseInt(m[1], 10), parseInt(m[4], 10), parseInt(m[5], 10));
    return isNaN(d2.getTime()) ? null : d2;
  }
  return null;
}

function getSpreadsheet_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss && SHEET_ID) {
    try { ss = SpreadsheetApp.openById(SHEET_ID); } catch (e) { Logger.log('openById: ' + e); }
  }
  return ss;
}

function getSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  if (headers && headers.length) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureChatSheet_(ss) {
  var sh = ss.getSheetByName(CHAT_TAB);
  if (!sh) return getSheet_(ss, CHAT_TAB, CHAT_HEADERS);

  var cols = Math.max(sh.getLastColumn(), CHAT_HEADERS.length);
  var current = sh.getRange(1, 1, 1, cols).getValues()[0].map(function (x) {
    return String(x || '').trim();
  });
  var same = CHAT_HEADERS.every(function (h, i) { return current[i] === h; });
  if (same) return sh;

  // ترحيل أي شكل قديم إلى تبويب أرشيف ثم إنشاء تبويب نظيف.
  try {
    var archiveName = CHAT_TAB + ' (قديم)';
    var archive = ss.getSheetByName(archiveName) || ss.insertSheet(archiveName);
    var last = sh.getLastRow();
    if (last > 0) {
      var values = sh.getRange(1, 1, last, Math.max(sh.getLastColumn(), 3)).getValues();
      archive.getRange(1, 1, values.length, values[0].length).setValues(values);
    }
    ss.deleteSheet(sh);
    return getSheet_(ss, CHAT_TAB, CHAT_HEADERS);
  } catch (e) {
    return sh;
  }
}

function findCol_(headers, keywords, fallback) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase();
    for (var k = 0; k < keywords.length; k++) {
      if (h.indexOf(String(keywords[k]).toLowerCase()) !== -1) return i;
    }
  }
  return fallback;
}

/* ============================================================
   Auth
   ============================================================ */

function credentials_() {
  var pin = MASTER_PIN;
  var pass = MASTER_PASSWORD;
  try {
    var props = PropertiesService.getScriptProperties();
    pin = props.getProperty('DASHBOARD_PIN') || pin;
    pass = props.getProperty('DASHBOARD_PASSWORD') || pass;
  } catch (e) {}
  return { pin: String(pin), pass: String(pass) };
}

function pinOk_(pin) {
  var c = credentials_();
  var p = String(pin || '').trim();
  return p !== '' && (p === c.pin || p.toLowerCase() === c.pass.toLowerCase());
}

function isOwner_() {
  try {
    var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
    return email !== '' && email === NOTIFY_EMAIL.toLowerCase();
  } catch (e) {
    return false;
  }
}

/* ============================================================
   Data builders
   ============================================================ */

function readAppointments_(ss) {
  var out = [];
  var sh = ss.getSheetByName('استشارات');
  if (!sh || sh.getLastRow() < 2) return out;

  var last = sh.getLastRow();
  var start = Math.max(2, last - MAX_APP_ROWS + 1);
  var cols = Math.max(sh.getLastColumn(), 7);
  var values = sh.getRange(start, 1, last - start + 1, cols).getValues();
  var headers = sh.getRange(1, 1, 1, cols).getValues()[0].map(function (h) { return String(h || '').trim(); });

  var iDate = findCol_(headers, ['تاريخ', 'وقت', 'date', 'time'], 0);
  var iName = findCol_(headers, ['اسم', 'name'], 1);
  var iPhone = findCol_(headers, ['هاتف', 'جوال', 'واتساب', 'phone'], 2);
  var iEmail = findCol_(headers, ['ايميل', 'إيميل', 'بريد', 'email'], 3);
  var iWork = findCol_(headers, ['عمل', 'نشاط', 'work'], 4);
  var iProblem = findCol_(headers, ['مشكل', 'تفاصيل', 'problem'], 5);
  var iSize = findCol_(headers, ['حجم', 'size'], 6);

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var name = String(row[iName] || '').trim();
    var problem = String(row[iProblem] || '').trim();
    if (!name && !problem) continue;

    var work = String(row[iWork] || '').trim();
    var dateVal = row[iDate];
    var d = toDate_(dateVal);
    out.push({
      id: start + r,
      date: fmtDateTime_(dateVal),
      ts: d ? d.getTime() : 0,
      name: name || 'بدون اسم',
      phone: String(row[iPhone] || '').trim(),
      email: String(row[iEmail] || '').trim(),
      work: work,
      problem: problem,
      size: String(row[iSize] || '').trim(),
      source: (work.indexOf('المساعد الذكي') !== -1 || work.indexOf('ذكاء') !== -1) ? 'ai' : 'web'
    });
  }

  out.sort(function (a, b) { return b.ts - a.ts; });
  out.forEach(function (a) { delete a.ts; });
  return out;
}

function readChatRows_(ss) {
  var out = [];
  var sh = ss.getSheetByName(CHAT_TAB);
  if (!sh || sh.getLastRow() < 2) return out;

  var last = sh.getLastRow();
  var start = Math.max(2, last - MAX_CHAT_ROWS + 1);
  var cols = Math.max(sh.getLastColumn(), CHAT_HEADERS.length);
  var values = sh.getRange(start, 1, last - start + 1, cols).getValues();
  var headers = sh.getRange(1, 1, 1, cols).getValues()[0].map(function (h) { return String(h || '').trim(); });

  var hasSession = headers.some(function (h) {
    return h.indexOf('محادث') !== -1 || h.toLowerCase().indexOf('session') !== -1;
  });

  var iTime = 0;
  var iSession = hasSession ? 1 : -1;
  var iQuestion = hasSession ? 2 : 1;
  var iAnswer = hasSession ? 3 : 2;
  var iPage = hasSession ? 4 : 3;

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var q = String(row[iQuestion] || '').trim();
    var a = String(row[iAnswer] || '').trim();
    if (!q && !a) continue;
    if (q.indexOf('بداية محادثة') !== -1) continue; // صفوف الفواصل القديمة

    var d = toDate_(row[iTime]);
    out.push({
      id: start + r,
      time: fmtDateTime_(row[iTime]),
      ts: d ? d.getTime() : 0,
      session: iSession >= 0 ? String(row[iSession] || '').trim() : '',
      question: q,
      answer: a,
      page: iPage >= 0 ? String(row[iPage] || '').trim() : ''
    });
  }
  return out;
}

/** يجمع رسائل المحادثة في جلسات منفصلة. */
function groupSessions_(rows) {
  var map = {};
  var list = [];
  var autoNo = 0;
  var autoLast = null;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var key = r.session;

    if (!key) {
      // لا يوجد معرّف جلسة (بيانات قديمة) → افصل بفاصل زمني.
      if (!autoLast || !r.ts || (r.ts - autoLast) > SESSION_GAP_MINUTES * 60000) autoNo++;
      if (r.ts) autoLast = r.ts;
      key = 'auto:' + autoNo;
    }

    if (!map[key]) {
      map[key] = {
        key: key,
        messages: [],
        firstQuestion: '',
        pages: {},
        startDate: '',
        lastDate: '',
        startTs: 0,
        lastTs: 0
      };
      list.push(map[key]);
    }

    var s = map[key];
    s.messages.push({
      id: r.id,
      time: r.time,
      question: r.question,
      answer: r.answer,
      page: r.page,
      ts: r.ts
    });
    if (!s.firstQuestion && r.question) s.firstQuestion = r.question;
    if (r.page) s.pages[r.page] = true;
    if (r.ts) {
      if (!s.startTs || r.ts < s.startTs) { s.startTs = r.ts; s.startDate = r.time; }
      if (!s.lastTs || r.ts > s.lastTs) { s.lastTs = r.ts; s.lastDate = r.time; }
    }
  }

  list.forEach(function (s) {
    s.messages.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    s.messages.forEach(function (m) { delete m.ts; });
    s.messageCount = s.messages.length;
    s.page = Object.keys(s.pages).join('، ');
    delete s.pages;
    delete s.key;
    delete s.startTs;
  });

  list.sort(function (a, b) { return (b.lastTs || 0) - (a.lastTs || 0); });
  list.forEach(function (s, idx) {
    s.index = idx + 1;
    delete s.lastTs;
  });

  return list;
}

function readContacts_(ss) {
  var out = [];
  var sh = ss.getSheetByName('تواصل');
  if (!sh || sh.getLastRow() < 2) return out;

  var last = sh.getLastRow();
  var start = Math.max(2, last - MAX_CONTACT_ROWS + 1);
  var cols = Math.max(sh.getLastColumn(), 5);
  var values = sh.getRange(start, 1, last - start + 1, cols).getValues();
  var headers = sh.getRange(1, 1, 1, cols).getValues()[0].map(function (h) { return String(h || '').trim(); });

  var iDate = findCol_(headers, ['تاريخ', 'وقت', 'date', 'time'], 0);
  var iName = findCol_(headers, ['اسم', 'name'], 1);
  var iPhone = findCol_(headers, ['هاتف', 'جوال', 'واتساب', 'phone'], 2);
  var iEmail = findCol_(headers, ['ايميل', 'إيميل', 'بريد', 'email'], 3);
  var iMsg = findCol_(headers, ['رسال', 'message'], 4);

  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var name = String(row[iName] || '').trim();
    var msg = String(row[iMsg] || '').trim();
    if (!name && !msg) continue;

    var d = toDate_(row[iDate]);
    out.push({
      id: start + r,
      date: fmtDateTime_(row[iDate]),
      ts: d ? d.getTime() : 0,
      name: name || 'بدون اسم',
      phone: String(row[iPhone] || '').trim(),
      email: String(row[iEmail] || '').trim(),
      message: msg
    });
  }

  out.sort(function (a, b) { return b.ts - a.ts; });
  out.forEach(function (c) { delete c.ts; });
  return out;
}

function dailyChats_(rows) {
  var tz = tz_();
  var days = [];
  var counts = {};
  var now = new Date();

  for (var i = 6; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    var key = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    counts[key] = 0;
    days.push({ key: key, label: Utilities.formatDate(d, tz, 'MM-dd'), count: 0 });
  }

  for (var r = 0; r < rows.length; r++) {
    if (!rows[r].ts) continue;
    var key2 = Utilities.formatDate(new Date(rows[r].ts), tz, 'yyyy-MM-dd');
    if (counts.hasOwnProperty(key2)) counts[key2]++;
  }

  days.forEach(function (d) { d.count = counts[d.key]; delete d.key; });
  return days;
}

function buildDashboardData_() {
  try {
    var ss = getSpreadsheet_();
    if (!ss) {
      return { ok: false, error: 'لم يتم العثور على جدول البيانات. تحقق من SHEET_ID أو صلاحيات السكربت.' };
    }

    var appointments = readAppointments_(ss);
    var chatRows = readChatRows_(ss);
    var sessions = groupSessions_(chatRows);
    var contacts = readContacts_(ss);

    var aiCount = 0;
    var sizeDist = {};
    appointments.forEach(function (a) {
      if (a.source === 'ai') aiCount++;
      var sz = a.size || 'غير محدد';
      sizeDist[sz] = (sizeDist[sz] || 0) + 1;
    });

    var totalChats = chatRows.length;

    return {
      ok: true,
      sheetId: ss.getId(),
      sheetUrl: ss.getUrl(),
      sheetName: ss.getName(),
      lastUpdated: Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'),
      stats: {
        totalAppointments: appointments.length,
        aiAppointments: aiCount,
        webAppointments: appointments.length - aiCount,
        totalSessions: sessions.length,
        totalChats: totalChats,
        totalContacts: contacts.length,
        sizeDistribution: sizeDist,
        dailyChats: dailyChats_(chatRows)
      },
      appointments: appointments,
      sessions: sessions,
      contacts: contacts
    };
  } catch (err) {
    Logger.log('buildDashboardData_: ' + err + '\n' + (err && err.stack));
    return { ok: false, error: String(err) };
  }
}

/* ============================================================
   Client-callable API (google.script.run)
   ============================================================ */

/**
 * الواجهة الوحيدة المسموح للعميل استدعاؤها.
 * تحقق من الـ PIN أو من بريد المالك قبل إرجاع أي بيانات.
 */
function getDashboardDataSecure(pin) {
  if (!isOwner_() && !pinOk_(pin)) {
    return { ok: false, error: 'رمز المرور غير صحيح.' };
  }
  return buildDashboardData_();
}

/* ============================================================
   doGet — Dashboard
   ============================================================ */

function doGet(e) {
  var p = (e && e.parameter) || {};

  // JSON API (اختياري): ?api=true&pin=9090
  if (p.api === 'true' || p.format === 'json') {
    if (!isOwner_() && !pinOk_(p.pin || p.key)) {
      return json_({ ok: false, error: 'غير مصرح. مرّر رمز المرور الصحيح (&pin=...).' });
    }
    return json_(buildDashboardData_());
  }

  var urlPin = String(p.pin || p.key || '').trim();
  var authorized = isOwner_() || pinOk_(urlPin);

  var template = HtmlService.createTemplateFromFile('Index');
  template.initialData = jsonForHtml_(authorized ? buildDashboardData_() : { ok: false, locked: true });
  template.urlPin = authorized && pinOk_(urlPin) ? urlPin : '';
  template.isOwner = isOwner_() ? 'true' : 'false';

  return template.evaluate()
    .setTitle('لوحة تحكم النذير | Alnazeer Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/* ============================================================
   doPost — Website + Cloudflare Worker
   ============================================================ */

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var ss = getSpreadsheet_();
    if (!ss) return json_({ ok: false, error: 'no active spreadsheet' });

    // ---------- 1) سجل محادثات المساعد الذكي ----------
    if (p.log === 'chat') {
      var chat;
      var label = String(p.session || '').trim().slice(0, 40);
      if (label && label.charAt(0) !== '#') label = '#' + label.replace(/^c-/, '');
      var page = String(p.page || '').slice(0, 120);
      var question = String(p.question || '').slice(0, 1500);
      var answer = String(p.answer || '').slice(0, 4000);

      var lock = LockService.getScriptLock();
      var locked = false;
      try { locked = lock.tryLock(5000); } catch (e1) {}

      try {
        if (ONE_TAB_PER_CHAT && label) {
          var tabName = ('محادثة ' + label).slice(0, 90);
          chat = ss.getSheetByName(tabName) || getSheet_(ss, tabName, CHAT_HEADERS);
        } else {
          chat = ensureChatSheet_(ss);
        }
        chat.appendRow([new Date(), label, question, answer, page]);
      } finally {
        if (locked) { try { lock.releaseLock(); } catch (e2) {} }
      }

      return json_({
        ok: true,
        sheet: ss.getUrl(),
        tab: chat.getName(),
        row: chat.getLastRow(),
        session: label,
        emailed: false
      });
    }

    // ---------- 2) حجز استشارة / رسالة تواصل ----------
    var isContact = (p.form === 'contact');
    var sheet, row, subject, body;

    if (isContact) {
      sheet = getSheet_(ss, 'تواصل', ['الوقت', 'الاسم', 'الجوال', 'الإيميل', 'الرسالة']);
      row = [new Date(), p.name || '', p.phone || '', p.email || '', p.message || ''];
      subject = 'رسالة تواصل جديدة: ' + (p.name || '');
      body = 'الاسم: ' + (p.name || '') + '\n' +
             'الواتساب: ' + (p.phone || '') + '\n' +
             'الإيميل: ' + (p.email || '') + '\n' +
             'الرسالة: ' + (p.message || '');
    } else {
      sheet = getSheet_(ss, 'استشارات', ['الوقت', 'الاسم', 'الجوال', 'الإيميل', 'العمل', 'المشكلة', 'الحجم']);
      row = [new Date(), p.name || '', p.phone || '', p.email || '', p.work || '', p.problem || '', p.size || ''];
      subject = 'طلب استشارة جديد: ' + (p.name || '');
      body = 'الاسم: ' + (p.name || '') + '\n' +
             'الجوال: ' + (p.phone || '') + '\n' +
             'الإيميل: ' + (p.email || '') + '\n' +
             'العمل: ' + (p.work || '') + '\n' +
             'المشكلة: ' + (p.problem || '') + '\n' +
             'الحجم: ' + (p.size || '');
    }

    sheet.appendRow(row);

    var emailed = false;
    if (isContact ? EMAIL_ON_CONTACT : true) {
      try {
        MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: subject, body: body });
        emailed = true;
      } catch (mailErr) {
        Logger.log('mail failed: ' + mailErr);
      }
    }

    return json_({
      ok: true,
      sheet: ss.getUrl(),
      tab: sheet.getName(),
      row: sheet.getLastRow(),
      emailed: emailed
    });
  } catch (err) {
    Logger.log('doPost: ' + err + '\n' + (err && err.stack));
    return json_({ ok: false, error: String(err) });
  }
}
