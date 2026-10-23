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
    var path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href === path || (path === '' && href === 'index.html')) a.classList.add('active');
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
      var work = (document.getElementById('workType') || {}).value || '';
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
      name = name.trim(); phone = phone.trim(); email = email.trim(); work = work.trim(); problem = problem.trim();
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
      if (!name || !phone || !work || !problem || !size) {
        say('يرجى تعبئة جميع الحقول المطلوبة حتى أجهز لك الاستشارة بشكل صحيح.', false);
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
        fd.append(GOOGLE_FORM_CONFIG.fields.work, work);
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
    dcta.innerHTML = '<a href="free-session.html" class="btn btn-primary">استشارة مجانية</a>';
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
    var MAX_HIST = 40, SEND_WINDOW = 16, DIGEST_CAP = 1200;
    var K_HIST = 'alnazeer_chat_hist', K_TR = 'alnazeer_chat_view';
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
      return s.length > DIGEST_CAP ? s.slice(-DIGEST_CAP) : s;
    }
    var hist = loadHist(), busy = false, lastSend = 0;
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
      // Markdown bold/italic markers -> plain text
      s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
      return s;
    }
    function linkify(s) {
      var e = esc(cleanModelText(s));
      // 1) استخرج الروابط أولاً (بـ placeholder) حتى لا تُمسّ أرقام الواتساب داخل الـ href
      var urls = [];
      e = e.replace(/https?:\/\/[^\s<&)]+/g, function (u) {
        u = u.replace(/[.,;:،؟!]+$/, '');
        urls.push(u);
        return '\u0000' + (urls.length - 1) + '\u0000';
      });
      // 2) رقم الواتساب يعرض كرابط يفتح واتساب مباشرة (بدل رقم)
      e = e.replace(/(?:\+\s*)?249[\s-]?117[\s-]?148[\s-]?664(?!\d)/g,
        '<a href="https://wa.me/249117148664" target="_blank" rel="noopener">واتساب</a>');
      // 3) رجّع الروابط (رابط واتساب يُكتب «واتساب» بدل «رابط»)
      e = e.replace(/\u0000(\d+)\u0000/g, function (_, i) {
        var u = urls[+i];
        var safe = u.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        var label = /wa\.me|whatsapp/i.test(u) ? 'واتساب' : 'رابط';
        return '<a href="' + safe + '" target="_blank" rel="noopener">' + label + '</a>';
      });
      // 4) أسماء الصفحات — محميّة من أن تُلتقط داخل رابط أو href
      e = e.replace(/(^|[\s>(])((?:free-session|services|contact|faq|projects|about|ai-agents|custom-ai|software|ai|build)\.html)\b/g, '$1<a href="$2">هنا</a>');
      // Paragraphs: blank line -> new paragraph; single newline -> <br>
      return e.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
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
        ps = el.querySelectorAll('p');
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
          ps = el.querySelectorAll('p');
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
      add('bot', 'أهلاً بك، أنا مساعد الذكاء الاصطناعي الخاص بالنذير، يمكنني مساعدتك في كل ما تحتاج معرفته عن الخدمات والأسعار وحجز المواعيد مع النذير.');
    }
    function offline() {
      add('bot', 'المساعد الذكي سيعمل هنا قريباً. الآن يمكنك <a href="free-session.html">حجز استشارتك المجانية</a> أو مراسلتي واتساب من الزر أعلى المحادثة.');
    }
    /* لا كابتشا: الحماية عبر حدود KV + فلتر حقن + قفل النطاق في الخادم. */
    function send(q) {
      add('user', esc(q));
      if (!AI_WORKER_URL) { offline(); return; }
      var now = Date.now();
      if (busy || now - lastSend < 5000) { add('bot', 'مهلاً قليلاً…'); return; }
      busy = true; lastSend = now;
      var tp = add('bot ai-typing', DOTS_HTML);
      hist.push({ role: 'user', content: q });
      hist = hist.slice(-MAX_HIST);
      pushView('u', q); saveHist();
      var recent = hist.slice(-SEND_WINDOW);
      var digest = buildDigest(hist);
      var payload = { messages: recent, session: sessionId(), page: location.pathname };
      if (digest) payload.digest = digest;
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
          typeMessage(tp, 'تعذر الاتصال. يمكنك الحجز من free-session.html أو مراسلتي واتساب.', function () { busy = false; });
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
        hist = [];
        try { sessionStorage.removeItem(K_HIST); sessionStorage.removeItem(K_TR); } catch (e) {}
        if (log) log.innerHTML = '';
        if (chips) chips.hidden = false;
        add('bot', 'تم مسح المحادثة — ابدأ من جديد، كيف يمكنني مساعدتك؟');
      });
    }
    if (chatFab) chatFab.addEventListener('click', function () { setTimeout(greet, 350); });
    greet();
  })();

  /* ===== AI assistant nudge =====
     بعد 10 ثوانٍ من دخول الزائر نعرض تلميحاً صغيراً عن المساعد الذكي.
     إغلاقه (بالزر أو بالضغط في أي مكان) يُسجَّل في localStorage، ولا يعود
     لدقيقتين حتى لو حدّث الزائر الصفحة. */
  (function () {
    if (!chatFab) return;
    var K_TIP = 'alnazeer_ai_tip_closed';
    var TIP_SHOW_AFTER = 10000, TIP_LINGER = 12000, TIP_RESHOW_AFTER = 120000;
    var tip = document.createElement('div');
    tip.className = 'ai-tip';
    tip.setAttribute('role', 'status');
    var tipText = document.createElement('span');
    tipText.className = 'ai-tip-text';
    tipText.textContent = 'تحتاج مساعدة؟ المساعد الذكي يرد عليك فوراً';
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
    chatFab.addEventListener('click', hideTip);
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
