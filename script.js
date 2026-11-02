/* Shared interactions: nav, reveal, counters, FAQ, booking form -> Google Form */
(function () {
  'use strict';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ====== CONFIG: ضع رابط نموذج Google هنا ======
     1. أنشئ Google Form بنفس الحقول
     2. الصق رابط الـ formResponse هنا، ومعرّفات entries
     مثال: https://docs.google.com/forms/d/e/XXXX/formResponse
  */
  var GOOGLE_FORM_CONFIG = {
    enabled: true, // الإرسال عبر Apps Script إلى Google Sheet مباشرة
    actionUrl: 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec',
    fields: {
      name: 'name',
      phone: 'phone',
      email: 'email',
      work: 'work',
      problem: 'problem',
      size: 'size'
    }
  };

  // Mobile menu
  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        navLinks.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Active nav
  try {
    var path = (location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '') || 'index';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split(/[?#]/)[0].replace(/^\.\//, '').replace(/\.html$/i, '');
      if (href === '' || href === '/') href = 'index';
      if (href === path) a.classList.add('active');
    });
  } catch (e) {}

  // Reveal on scroll
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var revealIO = new IntersectionObserver(function (entries) {
      var vis = entries.filter(function (en) { return en.isIntersecting; });
      vis.forEach(function (en, i) {
        revealIO.unobserve(en.target);
        setTimeout(function () { en.target.classList.add('visible'); }, Math.min(i * 90, 360));
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  }

  // Counters
  var counters = document.querySelectorAll('[data-count]');
  function animateCount(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    if (reduceMotion) { el.textContent = target; return; }
    var dur = 1100, start = null;
    function tick(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    var cIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); cIO.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { cIO.observe(c); });
  } else {
    counters.forEach(animateCount);
  }

  // To-top
  var toTop = document.getElementById('toTop');
  var ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        if (toTop) toTop.classList.toggle('show', window.scrollY > 600);
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        o.classList.remove('open');
        var oa = o.querySelector('.faq-a');
        if (oa) oa.style.maxHeight = null;
        var ob = o.querySelector('.faq-q');
        if (ob) ob.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Booking form -> Google Form (or fallback)
  var booking = document.getElementById('bookingForm');
  if (booking) {
    booking.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (document.getElementById('fullName') || {}).value || '';
      var phone = (document.getElementById('phone') || {}).value || '';
      var email = (document.getElementById('email') || {}).value || '';
      var problem = (document.getElementById('problem') || {}).value || '';
      var sizeEl = document.getElementById('workSize');
      var size = sizeEl ? sizeEl.value.trim() : '';
      var noteEl = document.getElementById('bookingNote');
      var successEl = document.getElementById('bookingSuccess');
      var submitBtn = booking.querySelector('button[type="submit"]');
      var submitHtml = submitBtn ? submitBtn.innerHTML : '';
      function setLoading(on) {
        if (!submitBtn) return;
        if (on) {
          submitBtn.disabled = true;
          submitBtn.classList.add('loading');
          submitBtn.innerHTML = 'جارٍ الإرسال<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
        } else {
          submitBtn.disabled = false;
          submitBtn.classList.remove('loading');
          submitBtn.innerHTML = submitHtml;
        }
      }
      name = name.trim(); phone = phone.trim(); email = email.trim(); problem = problem.trim();
      function say(msg, ok) {
        if (!noteEl) return;
        noteEl.style.color = ok ? '#1a7f37' : '#b42318';
        noteEl.textContent = msg;
      }
      function showSuccess() {
        setLoading(false);
        var nm = document.getElementById('successName');
        if (nm) nm.textContent = name;
        booking.style.display = 'none';
        if (successEl) {
          successEl.hidden = false;
          if (successEl.scrollIntoView) successEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
        booking.reset();
      }
      var againBtn = document.getElementById('bookAgain');
      if (againBtn && !againBtn.dataset.bound) {
        againBtn.dataset.bound = '1';
        againBtn.addEventListener('click', function () {
          if (successEl) successEl.hidden = true;
          booking.style.display = '';
          if (noteEl) noteEl.textContent = '';
        });
      }
      if (!name || !phone || !problem || !size) {
        say('يرجى تعبئة جميع الحقول المطلوبة حتى أتمكن من التواصل معك.', false);
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say('البريد الإلكتروني غير صحيح — اتركه فارغاً إن لم ترغب في تعبئته.', false);
        return;
      }
      // إرسال إلى Google Form إن كان مفعّلاً
      setLoading(true);
      if (GOOGLE_FORM_CONFIG.enabled && GOOGLE_FORM_CONFIG.actionUrl) {
        var fd = new FormData();
        fd.append('form', 'booking');
        fd.append(GOOGLE_FORM_CONFIG.fields.name, name);
        fd.append(GOOGLE_FORM_CONFIG.fields.phone, phone);
        fd.append(GOOGLE_FORM_CONFIG.fields.email, email);
        fd.append(GOOGLE_FORM_CONFIG.fields.work, '');
        fd.append(GOOGLE_FORM_CONFIG.fields.problem, problem);
        fd.append(GOOGLE_FORM_CONFIG.fields.size, size);
        fetch(GOOGLE_FORM_CONFIG.actionUrl, { method: 'POST', mode: 'no-cors', body: fd })
          .then(function () {
            showSuccess();
          })
          .catch(function () {
            showSuccess();
          });
      } else {
        showSuccess();
      }
    });
  }

  // WhatsApp icon guard — guarantees the official glyph in every socials row,
  // even if the browser served a cached copy of the HTML.
  (function () {
    var WA_D = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';
    document.querySelectorAll('.socials a[aria-label="واتساب"]').forEach(function (a) {
      var svg = a.querySelector('svg');
      if (!svg) return;
      var p = svg.querySelector('path');
      if (!p) {
        p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svg.appendChild(p);
      }
      if (p.getAttribute('d') !== WA_D) p.setAttribute('d', WA_D);
      if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 24 24');
      if (!svg.getAttribute('fill')) svg.setAttribute('fill', 'currentColor');
    });
  })();

  // Mobile drawer helpers: overlay, close button, Escape
  (function () {
    if (!navLinks) return;
    var ov = document.createElement('div');
    ov.className = 'nav-overlay';
    document.body.appendChild(ov);
    var dh = document.createElement('div');
    dh.className = 'drawer-head';
    dh.innerHTML = '<img src="images/alnazeerlogo.png" alt="النذير">';
    var dc = document.createElement('button');
    dc.className = 'drawer-close';
    dc.setAttribute('aria-label', 'إغلاق القائمة');
    dc.textContent = '×';
    dh.appendChild(dc);
    navLinks.prepend(dh);
    var dcta = document.createElement('div');
    dcta.className = 'drawer-cta';
    dcta.innerHTML = '<a href="contact" class="btn btn-primary">اتصل بي</a>';
    navLinks.appendChild(dcta);
    function sync() {
      var open = navLinks.classList.contains('open');
      ov.classList.toggle('show', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }
    if (menuBtn) menuBtn.addEventListener('click', function () { setTimeout(sync, 0); });
    function hide() { navLinks.classList.remove('open'); sync(); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); }
    ov.addEventListener('click', hide);
    dc.addEventListener('click', hide);
    navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) setTimeout(sync, 0); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hide();
        var cp = document.getElementById('chatPop');
        if (cp) cp.classList.remove('open');
        var cf = document.getElementById('chatFab');
        if (cf) { cf.classList.remove('open'); cf.setAttribute('aria-expanded', 'false'); }
      }
    });
  })();

  // Chat popup toggle
  var chatFab = document.getElementById('chatFab'), chatPop = document.getElementById('chatPop');
  if (chatFab && chatPop) {
    chatFab.addEventListener('click', function (e) {
      e.stopPropagation();
      var o = chatPop.classList.toggle('open');
      chatFab.classList.toggle('open', o);
      chatFab.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!chatPop.contains(e.target)) {
        chatPop.classList.remove('open');
        chatFab.classList.remove('open');
        chatFab.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ===== Visual viewport fit (mobile keyboard) =====
     على الجوال/اللوح يصغر مساحة العرض عند فتح لوحة المفاتيح، فتُضبط
     ارتفاع النافذة وموقعها على المساحة المرئية الحقيقية حتى يبقى حقل
     الكتابة ظاهراً فوق لوحة المفاتيح دائماً. */
  if (chatPop && window.visualViewport) {
    var vv = window.visualViewport;
    var fitChatVv = function () {
      if (!chatPop.classList.contains('open')) {
        chatPop.style.removeProperty('--vvp-top');
        chatPop.style.removeProperty('--vvp-h');
        return;
      }
      chatPop.style.setProperty('--vvp-top', vv.offsetTop + 'px');
      chatPop.style.setProperty('--vvp-h', vv.height + 'px');
    };
    vv.addEventListener('resize', fitChatVv);
    vv.addEventListener('scroll', fitChatVv);
    if ('MutationObserver' in window) {
      new MutationObserver(fitChatVv).observe(chatPop, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ===== AI chat (Groq via Cloudflare Worker) =====
     بعد نشر الـ Worker الصق رابطه هنا، مثال:
     var AI_WORKER_URL = 'https://alnathir-ai.username.workers.dev';
     اتركه فارغاً وستظهر رسالة توجيه للواتساب والحجز. */
  var AI_WORKER_URL = 'https://alnazeerai.alnzyrbdalmnm90.workers.dev/';
  /* نقاط انتظار متحرّكة تُعرض أثناء انتظار ردّ المساعد. */
  var DOTS_HTML = '<span class="ai-dots" aria-label="يكتب…"><i></i><i></i><i></i></span>';
  (function () {
    var log = document.getElementById('aiLog');
    if (!log) return;
    var form = document.getElementById('aiForm'), inp = document.getElementById('aiText');
    var chips = document.getElementById('aiChips');
    /* ---- ذاكرة المحادثة (تبقى عبر الصفحات لأن الموقع صفحات متعددة) ----
       نحتفظ بآخر MAX_HIST رسالة في sessionStorage، ونرسل SEND_WINDOW نصاً كاملاً،
       وما قبلها ملخّصاً مضغوطاً (digest) حتى يظل المساعد يتذكر محادثته بلا توكنات زائدة. */
    var MAX_HIST = 60, SEND_WINDOW = 16, DIGEST_CAP = 2200;
    var K_HIST = 'alnazeer_chat_hist', K_TR = 'alnazeer_chat_view';
    var K_FACTS = 'alnazeer_chat_facts', K_PIN = 'alnazeer_chat_pin';
    function store(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function read(k) { try { var v = JSON.parse(sessionStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function loadHist() {
      return read(K_HIST).filter(function (m) {
        return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
      }).slice(-MAX_HIST);
    }
    function saveHist() { store(K_HIST, hist.slice(-MAX_HIST)); }
    function pushView(c, t) {
      var tr = read(K_TR); tr.push({ c: c, t: String(t).slice(0, 2000) });
      store(K_TR, tr.slice(-MAX_HIST));
    }
    function buildDigest(h) {
      if (h.length <= SEND_WINDOW) return '';
      var old = h.slice(0, h.length - SEND_WINDOW), s = '';
      for (var i = 0; i < old.length; i++) {
        s += (old[i].role === 'user' ? 'س: ' : 'ن: ') + String(old[i].content).replace(/\s+/g, ' ').slice(0, 140) + '\n';
      }
      s = s.trim();
      /* لا تقصّ بداية المحادثة فقط: الاسم غالباً في أول رسالة، لذا نحتفظ ببداية الملخّص ونهايته. */
      if (s.length > DIGEST_CAP) {
        var tail = Math.floor(DIGEST_CAP * 0.6);
        var head = DIGEST_CAP - tail - 3;
        s = s.slice(0, head).trim() + '\n…\n' + s.slice(-tail).trim();
      }
      return s;
    }
    function readObj(k) {
      try {
        var v = JSON.parse(sessionStorage.getItem(k) || '{}');
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
      } catch (e) { return {}; }
    }
    function saveObj(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function cleanFact(v, max) {
      return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/[«»"]/g, '')
        .replace(/\s+/g, ' ').trim().slice(0, max);
    }
    var NAME_STOP = /^(?:و|أو|او|من|في|عندي|أعمل|اعمل|أشتغل|اشتغل|أدرس|ادرس|طالب|مدير|صاحب|مهندس|مطور|ساكن|أسكن|اسكن|عمري|سنة|خبرة|مشروع|شركة|مطعم|متجر|موقع|تطبيق|أريد|أبغى|ابغى|أبي|ابي|أنا|انا|أنت|انت|لا|ما|أعرف|اعرف|أدري|ادري|أذكر|اذكر|ماعرف|رقمي|جوالي|جوالـي|هاتفي|بريدي|إيميلي|ايميلي|واتساب|واتس|and|from|i|a|an|the|my|email|phone|number|mobile|whatsapp)$/i;
    function extractFacts(text, f) {
      f = f && typeof f === 'object' ? f : {};
      var t = String(text || '');
      if (!f.name) {
        var m = t.match(/(?:اسمي|اسمى|إسمي|إسمى|أنا\s+اسمي|انا\s+اسمي|أنا\s+اسمى|انا\s+اسمى)\s*[:：\-]?\s*([\u0600-\u06FFA-Za-z][\u0600-\u06FFA-Za-z'’\- ]{0,40})/i);
        if (m) {
          var words = m[1].replace(/[،,.!؟?؛:()]/g, ' ').trim().split(/\s+/);
          if (words.length && /^(?:هو|هي)$/.test(words[0])) words.shift();
          var name = [];
          for (var i = 0; i < words.length && name.length < 4; i++) {
            var w = words[i];
            var bare = w.replace(/^و/, '');
            if (NAME_STOP.test(w) || NAME_STOP.test(bare)) break;
            name.push(w);
          }
          var nm = cleanFact(name.join(' '), 40);
          if (nm.length >= 2) f.name = nm;
        }
      }
      if (!f.name) {
        var en = t.match(/my\s+name\s+is\s+([A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,2})/i);
        if (en) {
          var enName = cleanFact(en[1].replace(/\s+(?:and|from|i|a|an|the|my)\b.*$/i, ''), 40);
          if (enName.length >= 2) f.name = enName;
        }
      }
      if (!f.contact) {
        var mail = t.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
        if (mail) f.contact = cleanFact(mail[0], 80);
      }
      if (!f.contact) {
        var phone = t.match(/(?:\+|00)?\d[\d\s\-()]{7,}\d/);
        if (phone && phone[0].replace(/\D/g, '').length >= 7) f.contact = cleanFact(phone[0], 40);
      }
      if (!f.work) {
        var wm = t.match(/(?:أعمل|اعمل|أشتغل|اشتغل)\s+(?:في\s+|ب\s*)?([\u0600-\u06FFA-Za-z0-9][^،,.!؟?\n]{1,50})/);
        if (wm) {
          var wk = cleanFact(wm[1].split(/\s+(?:و|ثم|لكن)\s+|\s+و(?=[\u0600-\u06FF])/)[0], 60);
          if (wk.length >= 3) f.work = wk;
        }
      }
      return f;
    }
    /* إذا سأل المساعد «ما اسمك؟» وجاء الرد اسماً قصيراً وحده (بلا «اسمي»)، نلتقطه أيضاً. */
    function captureNameReply(q, h, f) {
      if (f.name || !h.length) return f;
      var last = h[h.length - 1];
      if (!last || last.role !== 'assistant') return f;
      if (!/(?:ما|ايش|إيش|وش|شنو)\s+(?:اسمك|إسمك)|(?:اسمك|إسمك)|your\s+name/i.test(String(last.content))) return f;
      var cand = cleanFact(q, 40).replace(/[.!؟?،,؛:()]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cand) return f;
      cand = cand.replace(/^(?:أهلاً|اهلا|أهلا|مرحباً|مرحبا|هلا|السلام\s+عليكم|أنا|انا|معك|معايا|معاي)\s+/i, '');
      var parts = cand.split(/\s+/), name = [];
      for (var i = 0; i < parts.length && name.length < 4; i++) {
        var w = parts[i], bare = w.replace(/^و/, '');
        if (NAME_STOP.test(w) || NAME_STOP.test(bare) || /\d|@|https?:/i.test(w)) break;
        name.push(w);
      }
      var nm = cleanFact(name.join(' '), 40);
      if (nm.length >= 2) f.name = nm;
      return f;
    }
    var hist = loadHist(), facts = readObj(K_FACTS), pinned = '';
    try { pinned = sessionStorage.getItem(K_PIN) || ''; } catch (e) {}
    var busy = false, lastSend = 0;
    /* معرّف المحادثة: ثابت لكل جلسة/تبويب، يُرسل مع كل رسالة ليُفرَّق بين المحادثات في السجل. */
    function sessionId() {
      var k = 'alnazeer_chat_session';
      try {
        var s = sessionStorage.getItem(k);
        if (!s) {
          s = 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
          sessionStorage.setItem(k, s);
        }
        return s;
      } catch (e) {
        return 'c-' + Date.now().toString(36);
      }
    }
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function cleanModelText(s) {
      // Markdown links [text](url) -> keep the bare target (re-linkified later)
      s = s.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, t, u) { return u; });
      // Raw HTML anchors the model may emit -> keep the bare target (re-linkified later)
      s = s.replace(/<a\s+[^>]*href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a\s*>/gi, function (m, u, t) { return u; });
      // Any other stray tags -> remove
      s = s.replace(/<[^>\n]{0,80}>/g, '');
      // Markdown code fences -> drop the markers, keep the code text
      s = s.replace(/```[a-zA-Z0-9]*\n?/g, '');
      // Markdown headings -> plain text (the # marks are not content)
      s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');
      // Markdown blockquote markers -> plain text
      s = s.replace(/^[ \t]*>[ \t]?/gm, '');
      // Markdown horizontal rules -> removed entirely
      s = s.replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, '');
      // Markdown bold/italic markers -> plain text
      s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
      return s;
    }
    /* Splits one block into paragraph / list segments.
       The model sometimes emits "- item" or "1. item" despite the output rule,
       so we render them as real lists instead of showing literal dashes.
       Returns an array of block-level HTML strings (never a list inside a <p>). */
    function mdBlocks(block) {
      var lines = block.split('\n'), out = [], buf = [], list = null, i, line, b, n;
      function flushText() {
        if (buf.length) { out.push('<p>' + buf.join('\n').replace(/\n/g, '<br>') + '</p>'); buf = []; }
      }
      function flushList() {
        if (list) {
          out.push('<' + list.tag + '>' + list.items.map(function (it) { return '<li>' + it + '</li>'; }).join('') + '</' + list.tag + '>');
          list = null;
        }
      }
      for (i = 0; i < lines.length; i++) {
        line = lines[i];
        b = line.match(/^[ \t]*[-*\u2022\u2013\u2014][ \t]+(.+)$/);   // - item  /  * item  /  • item
        n = line.match(/^[ \t]*(\d{1,2})[.)][ \t]+(.+)$/);            // 1. item  /  1) item
        if (b) {
          flushText();
          if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; }
          list.items.push(b[1]);
          continue;
        }
        if (n) {
          flushText();
          if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; }
          list.items.push(n[2]);
          continue;
        }
        flushList();
        buf.push(line);
      }
      flushText();
      flushList();
      return out;
    }
    function escapeRe(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    function aliasPart(part) {
      /* إن ذكر النموذج اسم الصفحة بالعربي ثم كرره باسم الملف في نفس الجملة،
         نحذف الذكر العربي حتى لا يظهر اسم الصفحة مرتين. */
      if (/[a-z0-9-]+\.html/i.test(part)) {
        var lower = part.toLowerCase();
        for (var name in PAGE_TITLES) {
          if (lower.indexOf(name) === -1) continue;
          if (name === 'index.html') {
            part = part.replace(/الصفحة\s+الرئيسية/g, '');
            continue;
          }
          part = part.replace(new RegExp('صفحة\\s+' + escapeRe(PAGE_TITLES[name]) + '(?![\\u0600-\\u06FF])', 'g'), '');
        }
        return part.replace(/\s{2,}/g, ' ').replace(/^[\s،,]+/, '');
      }
      return part
        .replace(/الصفحة\s+الرئيسية/g, 'صفحة index.html')
        .replace(/صفحة\s+(?:الاستشارات|الاستشارة)(?:\s+المجانية)?/g, 'صفحة contact.html')
        .replace(/صفحة\s+الخدمات/g, 'صفحة services.html')
        .replace(/صفحة\s+المشاريع/g, 'صفحة projects.html')
        .replace(/صفحة\s+(?:التواصل|الاتصال)/g, 'صفحة contact.html')
        .replace(/صفحة\s+الأسئلة(?:\s+الشائعة)?/g, 'صفحة faq.html')
        .replace(/صفحة\s+(?:عن\s+النذير|عني|من\s+أنا)/g, 'صفحة about.html')
        .replace(/صفحة\s+وكلاء\s+الذكاء\s+الاصطناعي/g, 'صفحة ai-agents.html')
        .replace(/صفحة\s+(?:الذكاء\s+الاصطناعي\s+المخصص|الحلول\s+المخصصة)/g, 'صفحة custom-ai.html')
        .replace(/صفحة\s+الذكاء\s+الاصطناعي/g, 'صفحة ai.html')
        .replace(/صفحة\s+تطوير\s+البرمجيات/g, 'صفحة build.html');
    }
    function pageAlias(s) {
      /* إن كتب النموذج اسم الصفحة بالعربي بدل اسم الملف، نحوّله لاسم الملف
         لتلتقطه قاعدة الروابط ويظهر «هنا» قابلاً للضغط. */
      var out = '', buf = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        buf += ch;
        var atEnd = (ch === '\n') || (/[.!؟?]/.test(ch) && (i + 1 >= s.length || /\s/.test(s.charAt(i + 1))));
        if (atEnd) { out += aliasPart(buf); buf = ''; }
      }
      if (buf) out += aliasPart(buf);
      return out;
    }
    var PAGE_TITLES = {
      'index.html': 'الصفحة الرئيسية',
      'about.html': 'عن النذير',
      'services.html': 'الخدمات',
      'ai.html': 'خدمات الذكاء الاصطناعي',
      'build.html': 'تطوير البرمجيات',
      'ai-agents.html': 'وكلاء الذكاء الاصطناعي',
      'custom-ai.html': 'حلول الذكاء الاصطناعي المخصصة',
      'software.html': 'تطوير البرمجيات والأنظمة',
      'projects.html': 'المشاريع',
      'faq.html': 'الأسئلة الشائعة',
      'contact.html': 'اتصل بي',
      'service-chatbots.html': 'روبوتات المحادثة',
      'service-voice-agents.html': 'الوكلاء الصوتيون',
      'service-automation.html': 'أتمتة العمليات',
      'service-ai-agents.html': 'وكلاء الذكاء الاصطناعي',
      'service-ai-integration.html': 'دمج الذكاء الاصطناعي',
      'service-ai-business-systems.html': 'أنظمة الأعمال الذكية',
      'service-custom-ai-solutions.html': 'حلول الذكاء الاصطناعي المخصصة',
      'service-model-customization.html': 'تخصيص النماذج',
      'service-websites.html': 'تطوير المواقع',
      'service-stores.html': 'المتاجر الإلكترونية',
      'service-apps.html': 'تطبيقات الجوال',
      'service-company-systems.html': 'أنظمة الشركات',
      'service-erp.html': 'ERP',
      'service-crm.html': 'CRM',
      'service-custom-systems.html': 'الأنظمة المخصصة',
      'project-mudif.html': 'نظام إدارة المطعم',
      'project-almadar.html': 'المدار CRM',
      'project-sijilpro.html': 'سجل برو',
      'project-spectrababy.html': 'متجر سبكترا',
      'project-adyar.html': 'أديار',
      'project-asasmakeen.html': 'أساس مكين',
      'project-shurfat.html': 'شرفات',
      'project-rulva.html': 'رولفا'
    };
    function pageTitle(name) {
      return PAGE_TITLES[name] || name.replace(/\.html$/i, '');
    }
    function pageLabel(name) {
      return (name === 'index.html' ? '' : 'صفحة ') + pageTitle(name) + ' هنا';
    }
    function pageHref(name) {
      /* روابط نظيفة بلا .html — الصفحة الرئيسية بلا اسمها */
      var slug = name.replace(/\.html$/i, '');
      return slug === 'index' ? 'https://alnazeer.me/' : 'https://alnazeer.me/' + slug;
    }
    function pageLink(name) {
      /* رابط مطلق على النطاق المخصص حتى يعمل حتى لو فُتح الموقع من رابط github.io أو خارج الموقع. */
      return '<a class="page-link" href="' + pageHref(name) + '" title="اضغط لفتح ' + pageTitle(name) + '">' + pageLabel(name) + '</a>';
    }
    function linkify(s) {
      var e = esc(cleanModelText(s));
      // 1) روابط الموقع القديمة (github.io) -> النطاق المخصص
      e = e.replace(/https?:\/\/(?:www\.)?alnazeerabdo\.github\.io\/(?:alnazeerdev|alnazeerai)\/?/gi, 'https://alnazeer.me/');
      // 1.5) صفحات ملغاة -> صفحة الاتصال
      e = e.replace(/free-session\.html/gi, 'contact.html');
      // 2) أسماء الصفحات العربية -> اسم الملف
      e = pageAlias(e);
      // 3) استخرج الروابط أولاً (بـ placeholder) حتى لا تُمسّ أرقام الواتساب داخل الـ href
      var urls = [];
      e = e.replace(/https?:\/\/[^\s<&)]+/g, function (u) {
        u = u.replace(/[.,;:،؟!]+$/, '');
        urls.push(u);
        return '\u0000' + (urls.length - 1) + '\u0000';
      });
      // 3.5) «في ملف X.html» -> «عبر صفحة X.html»
      e = e.replace(/(?:في|من|داخل)\s+ملف\s+([a-z0-9-]+\.html)/gi, 'عبر صفحة $1');
      // 4) رقم الواتساب يعرض كرابط يفتح واتساب مباشرة (بدل رقم)
      e = e.replace(/(?:\+\s*)?249[\s-]?117[\s-]?148[\s-]?664(?!\d)/g,
        '<a class="wa-link" href="https://wa.me/249117148664" target="_blank" rel="noopener">واتساب</a>');
      // 5) رجّع الروابط (رابط واتساب «واتساب»، ورابط صفحة الموقع باسم الصفحة + «هنا»)
      e = e.replace(/\u0000(\d+)\u0000/g, function (_, i) {
        var u = urls[+i];
        var safe = u.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        var isWa = /wa\.me|whatsapp/i.test(u);
        var pm = u.match(/^https?:\/\/(?:www\.)?alnazeer\.me(?:\/([a-z0-9-]+)(?:\.html)?)?\/?(?:[?#].*)?$/i);
        var isPage = !!pm;
        var pageName = (pm && pm[1] ? pm[1].toLowerCase() : 'index') + '.html';
        var label = isWa ? 'واتساب' : (isPage ? pageLabel(pageName) : 'رابط');
        var cls = isWa ? 'wa-link' : (isPage ? 'page-link' : 'ext-link');
        return '<a class="' + cls + '" href="' + (isPage ? pageHref(pageName) : safe) + '" target="_blank" rel="noopener">' + label + '</a>';
      });
      // 6) أسماء الصفحات — نبتلع «صفحة» التي قبل اسم الملف حتى لا تتكرر داخل الرابط
      e = e.replace(/(^|[\s>(])(?:صفحة\s+)?((?:free-session|services|contact|faq|projects|about|ai-agents|custom-ai|software|ai|build|index|service-[a-z0-9-]+|project-[a-z0-9-]+)\.html)\b/gi,
        function (_, pre, name) { return pre + pageLink(name.toLowerCase()); });
      // 7) إزالة «هنا» أو «من هنا» المكررة بعد أن صار اسم الصفحة داخل الرابط ينتهي بـ «هنا»
      e = e.replace(/(<a class="page-link"[^>]*>[^<]*هنا<\/a>)\s+(?:من\s+)?هنا/g, '$1');
      // Paragraphs: blank line -> new paragraph; markdown lists -> real <ul>/<ol>; single newline -> <br>
      return e.split(/\n{2,}/).map(function (p) { return mdBlocks(p).join(''); }).join('');
    }
    /* Split HTML into tokens (text / open tag / close tag / void tag). */
    function htmlTokens(html) {
      var out = [], re = /<[^>]+>/g, last = 0, m;
      while ((m = re.exec(html))) {
        if (m.index > last) out.push({ t: 'text', s: html.slice(last, m.index) });
        var tag = m[0];
        if (/^<\//.test(tag)) out.push({ t: 'close', s: tag });
        else if (/^<br\b/i.test(tag)) out.push({ t: 'void', s: tag });
        else out.push({ t: 'open', s: tag });
        last = re.lastIndex;
      }
      if (last < html.length) out.push({ t: 'text', s: html.slice(last) });
      return out;
    }
    /* Parse one tag into a real element (browser handles the attributes/entities). */
    function parseTag(tagStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = tagStr;
      return tpl.content.firstElementChild;
    }
    /* Type the reply out like it is being written (instant when reduced motion is on). */
    function typeMessage(el, text, done) {
      var html = linkify(text);
      el.classList.remove('ai-typing');
      if (reduceMotion) {
        el.innerHTML = html;
        log.scrollTop = log.scrollHeight;
        if (done) done();
        return;
      }
      var tokens = htmlTokens(html), ti = 0, ci = 0, t0 = Date.now();
      var cur = el, textNode = null, ps, i;
      el.innerHTML = '';
      el.classList.add('ai-writing');

      function caret() {
        ps = el.querySelectorAll('p, li');
        for (i = 0; i < ps.length - 1; i++) ps[i].classList.remove('typing');
        if (ps.length) ps[ps.length - 1].classList.add('typing');
      }
      function tick() {
        if (!el.isConnected) { el.classList.remove('ai-writing'); if (done) done(); return; }
        var spent = Date.now() - t0;
        var budget = spent > 8000 ? 6 : (spent > 4000 ? 3 : 1); // speed up on long replies
        while (ti < tokens.length && budget > 0) {
          var tk = tokens[ti];
          if (tk.t === 'open') {
            var node = parseTag(tk.s);
            if (node) { cur.appendChild(node); cur = node; }
            ti++;
            continue;
          }
          if (tk.t === 'close') {
            if (cur.parentNode) cur = cur.parentNode;
            ti++;
            continue;
          }
          if (tk.t === 'void') {
            var vnode = parseTag(tk.s);
            if (vnode) cur.appendChild(vnode);
            ti++;
            continue;
          }
          if (!textNode) { textNode = document.createTextNode(''); cur.appendChild(textNode); }
          var take = tk.s.substr(ci, budget);
          if (!take) { ti++; ci = 0; textNode = null; continue; }
          textNode.appendData(take);
          ci += take.length;
          budget -= take.length;
          if (ci >= tk.s.length) { ti++; ci = 0; textNode = null; }
        }
        caret();
        log.scrollTop = log.scrollHeight;
        if (ti < tokens.length) {
          setTimeout(tick, 18);
        } else {
          ps = el.querySelectorAll('p, li');
          for (i = 0; i < ps.length; i++) ps[i].classList.remove('typing');
          el.classList.remove('ai-writing');
          if (done) done();
        }
      }
      tick();
    }
    function add(cls, html) {
      var d = document.createElement('div');
      d.className = 'ai-msg ' + cls;
      d.innerHTML = html;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }
    function greet() {
      if (log.children.length) return;
      /* إن كانت هناك محادثة سابقة (نفس التبويب عبر الصفحات) نعرضها بدل الترحيب. */
      var tr = read(K_TR).filter(function (it) { return it && typeof it.t === 'string'; });
      if (tr.length) {
        for (var i = 0; i < tr.length; i++) {
          var u = tr[i].c === 'u';
          add(u ? 'user' : 'bot', u ? esc(tr[i].t) : linkify(tr[i].t));
        }
        if (chips) chips.hidden = true;
        log.scrollTop = log.scrollHeight;
        return;
      }
      add('bot', 'أهلاً بك، أنا مساعد الذكاء الاصطناعي الخاص بالنذير، يمكنني مساعدتك في كل ما تحتاج معرفته عن الخدمات والأسعار والتواصل مع النذير.');
    }
    function offline() {
      add('bot', 'المساعد الذكي سيعمل هنا قريباً. الآن يمكنك <a href="contact">إرسال طلبك</a> أو مراسلتي واتساب من الزر أعلى المحادثة.');
    }
    /* لا كابتشا: الحماية عبر حدود KV + فلتر حقن + قفل النطاق في الخادم. */
    function send(q) {
      add('user', esc(q));
      if (!AI_WORKER_URL) { offline(); return; }
      var now = Date.now();
      if (busy || now - lastSend < 5000) { add('bot', 'مهلاً قليلاً…'); return; }
      busy = true; lastSend = now;
      var tp = add('bot ai-typing', DOTS_HTML);
      /* أول رسالة تُحفظ منفصلة حتى لا يضيع اسم الزائر إذا طالت المحادثة. */
      if (!pinned) {
        pinned = q.slice(0, 300);
        try { sessionStorage.setItem(K_PIN, pinned); } catch (e) {}
      }
      facts = extractFacts(q, facts);
      facts = captureNameReply(q, hist, facts);
      saveObj(K_FACTS, facts);
      hist.push({ role: 'user', content: q });
      hist = hist.slice(-MAX_HIST);
      pushView('u', q); saveHist();
      var recent = hist.slice(-SEND_WINDOW);
      var digest = buildDigest(hist);
      var payload = { messages: recent, session: sessionId(), page: location.pathname };
      if (digest) payload.digest = digest;
      if (pinned) payload.pinned = pinned;
      if (facts.name || facts.contact || facts.work) payload.facts = facts;
      fetch(AI_WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var t = (j && j.text) || 'عذراً، حاول مجدداً.';
          hist.push({ role: 'assistant', content: t });
          hist = hist.slice(-MAX_HIST);
          pushView('a', t); saveHist();
          typeMessage(tp, t, function () { busy = false; });
        })
        .catch(function () {
          typeMessage(tp, 'تعذر الاتصال. يمكنك الحجز من صفحة الاستشارة المجانية أو مراسلتي واتساب.', function () { busy = false; });
        });
    }
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = inp.value.trim().slice(0, 500);
      if (!q) return;
      inp.value = '';
      send(q);
    });
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      chips.hidden = true;
      send(b.textContent);
    });
    /* ---- أزرار رأس المحادثة: مسح المحادثة + إغلاق النافذة ---- */
    var aiHead = chatPop ? chatPop.querySelector('.ai-head') : null;
    if (aiHead) {
      var clearBtn = document.createElement('button');
      clearBtn.className = 'ai-clear';
      clearBtn.type = 'button';
      clearBtn.textContent = 'مسح المحادثة';
      aiHead.appendChild(clearBtn);
      var popX = document.createElement('button');
      popX.className = 'ai-pop-x';
      popX.type = 'button';
      popX.setAttribute('aria-label', 'إغلاق المحادثة');
      popX.textContent = '×';
      aiHead.appendChild(popX);
      popX.addEventListener('click', function () {
        chatPop.classList.remove('open');
        if (chatFab) { chatFab.classList.remove('open'); chatFab.setAttribute('aria-expanded', 'false'); }
      });
      clearBtn.addEventListener('click', function () {
        hist = []; facts = {}; pinned = '';
        try {
          sessionStorage.removeItem(K_HIST);
          sessionStorage.removeItem(K_TR);
          sessionStorage.removeItem(K_FACTS);
          sessionStorage.removeItem(K_PIN);
        } catch (e) {}
        if (log) log.innerHTML = '';
        if (chips) chips.hidden = false;
        add('bot', 'تم مسح المحادثة — ابدأ من جديد، كيف يمكنني مساعدتك؟');
      });
    }
    if (chatFab) chatFab.addEventListener('click', function () { setTimeout(greet, 350); });
    greet();
  })();

  /* ===== Contact button nudge =====
     بعد 10 ثوانٍ من دخول الزائر نعرض تلميحاً صغيراً بجانب زر التواصل.
     إغلاقه (بالزر أو بالضغط في أي مكان) يُسجَّل في localStorage، ولا يعود
     لدقيقتين حتى لو حدّث الزائر الصفحة.
     زر المساعد الذكي مخفي حالياً من CSS، لذا يظهر التلميح بجانب زر الواتساب؛
     عند إعادة إظهار زر المساعد يعود التلميح إليه تلقائياً بنفس القواعد. */
  (function () {
    var aiHidden = !chatFab || getComputedStyle(chatFab).display === 'none';
    var target = aiHidden ? document.querySelector('.wa-fab') : chatFab;
    if (!target) return;
    var K_TIP = aiHidden ? 'alnazeer_wa_tip_closed' : 'alnazeer_ai_tip_closed';
    var TIP_SHOW_AFTER = 10000, TIP_LINGER = 12000, TIP_RESHOW_AFTER = 120000;
    var tip = document.createElement('div');
    tip.className = aiHidden ? 'ai-tip wa-tip' : 'ai-tip';
    tip.setAttribute('role', 'status');
    var tipText = document.createElement('span');
    tipText.className = 'ai-tip-text';
    tipText.textContent = aiHidden
      ? 'عندك استفسار؟ راسلني على واتساب وأرد عليك بنفسي'
      : 'تحتاج مساعدة؟ المساعد الذكي يرد عليك فوراً';
    var tipX = document.createElement('button');
    tipX.className = 'ai-tip-x';
    tipX.type = 'button';
    tipX.setAttribute('aria-label', 'إغلاق التنبيه');
    tipX.textContent = '×';
    tip.appendChild(tipText);
    tip.appendChild(tipX);
    document.body.appendChild(tip);
    var lingerTimer = null;
    function lastClosedAt() { try { return +localStorage.getItem(K_TIP) || 0; } catch (e) { return 0; } }
    function suppressed() { return Date.now() - lastClosedAt() < TIP_RESHOW_AFTER; }
    function hideTip() {
      tip.classList.remove('show');
      if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
      try { localStorage.setItem(K_TIP, String(Date.now())); } catch (e) {}
    }
    tipX.addEventListener('click', function (e) { e.stopPropagation(); hideTip(); });
    target.addEventListener('click', hideTip);
    document.addEventListener('click', function (e) {
      if (tip.classList.contains('show') && !tip.contains(e.target)) hideTip();
    });
    setTimeout(function () {
      if (chatPop && chatPop.classList.contains('open')) return;
      if (suppressed()) return;
      tip.classList.add('show');
      lingerTimer = setTimeout(hideTip, TIP_LINGER);
    }, TIP_SHOW_AFTER);
  })();
})();
