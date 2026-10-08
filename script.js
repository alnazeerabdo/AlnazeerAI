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
  window.GOOGLE_FORM_CONFIG = GOOGLE_FORM_CONFIG;

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

  // Prefill service from ?service= or ?topic=
  try {
    var params = new URLSearchParams(location.search);
    var svc = params.get('service') || params.get('topic');
    if (svc) {
      var problemField = document.getElementById('problem');
      var serviceField = document.getElementById('serviceInterest');
      var note = document.getElementById('servicePrefill');
      if (serviceField) serviceField.value = svc;
      if (note) {
        note.textContent = 'اخترت: ' + svc + ' — اذكر لي تفاصيل أكثر لأجهز لك حلاً عاماً في الاستشارة.';
        note.style.display = 'block';
      } else if (problemField && !problemField.value) {
        problemField.value = 'مهتم بخدمة: ' + svc + ' — ';
      }
    }
  } catch (e) {}

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
      if (!name || !phone || !email || !work || !problem || !size) {
        say('يرجى تعبئة جميع الحقول المطلوبة حتى أجهز لك الاستشارة بشكل صحيح.', false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say('يرجى إدخال بريد إلكتروني صحيح.', false);
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

  // Contact receiver: same Apps Script web app, routed to the "تواصل" tab
  var CONTACT_FORM_CONFIG = {
    enabled: true,
    actionUrl: 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec',
    fields: { name: 'name', phone: 'phone', email: 'email', message: 'message' }
  };
  window.CONTACT_FORM_CONFIG = CONTACT_FORM_CONFIG;

  // Contact form (contact.html) -> Apps Script
  var cform = document.getElementById('contactForm');
  if (cform && !booking) {
    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = document.getElementById('name');
      var ph = document.getElementById('cphone');
      var em = document.getElementById('email');
      var ms = document.getElementById('msg');
      var note = document.getElementById('formNote');
      var csuccess = document.getElementById('contactSuccess');
      if (!n || !ph || !em || !ms) return;
      var nv = n.value.trim(), pv = ph.value.trim(), ev = em.value.trim(), mv = ms.value.trim();
      var cbtn = cform.querySelector('button[type="submit"]');
      var cbtnHtml = cbtn ? cbtn.innerHTML : '';
      function setCLoading(on) {
        if (!cbtn) return;
        if (on) {
          cbtn.disabled = true;
          cbtn.classList.add('loading');
          cbtn.innerHTML = 'جارٍ الإرسال<span class="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>';
        } else {
          cbtn.disabled = false;
          cbtn.classList.remove('loading');
          cbtn.innerHTML = cbtnHtml;
        }
      }
      function showCSuccess() {
        setCLoading(false);
        var nm = document.getElementById('contactName');
        if (nm) nm.textContent = nv;
        cform.style.display = 'none';
        if (csuccess) {
          csuccess.hidden = false;
          if (csuccess.scrollIntoView) csuccess.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
        cform.reset();
      }
      var cagain = document.getElementById('contactAgain');
      if (cagain && !cagain.dataset.bound) {
        cagain.dataset.bound = '1';
        cagain.addEventListener('click', function () {
          if (csuccess) csuccess.hidden = true;
          cform.style.display = '';
          if (note) note.textContent = '';
        });
      }
      if (!nv || !pv || !ev || !mv) {
        note.style.color = '#FFB4B4';
        note.textContent = 'يرجى تعبئة جميع الحقول المطلوبة.';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev)) {
        note.style.color = '#FFB4B4';
        note.textContent = 'يرجى إدخال بريد إلكتروني صحيح.';
        return;
      }
      setCLoading(true);
      if (CONTACT_FORM_CONFIG.enabled && CONTACT_FORM_CONFIG.actionUrl) {
        var cfd = new FormData();
        cfd.append('form', 'contact');
        cfd.append(CONTACT_FORM_CONFIG.fields.name, nv);
        cfd.append(CONTACT_FORM_CONFIG.fields.phone, pv);
        cfd.append(CONTACT_FORM_CONFIG.fields.email, ev);
        cfd.append(CONTACT_FORM_CONFIG.fields.message, mv);
        fetch(CONTACT_FORM_CONFIG.actionUrl, { method: 'POST', mode: 'no-cors', body: cfd })
          .then(function () { showCSuccess(); })
          .catch(function () { showCSuccess(); });
      } else {
        showCSuccess();
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

  /* ===== AI chat (Groq via Cloudflare Worker) =====
     بعد نشر الـ Worker الصق رابطه هنا، مثال:
     var AI_WORKER_URL = 'https://alnathir-ai.username.workers.dev';
     اتركه فارغاً وستظهر رسالة توجيه للواتساب والحجز. */
  var AI_WORKER_URL = '';
  (function () {
    var log = document.getElementById('aiLog');
    if (!log) return;
    var form = document.getElementById('aiForm'), inp = document.getElementById('aiText');
    var chips = document.getElementById('aiChips');
    var hist = [], busy = false, lastSend = 0;
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function linkify(s) {
      var e = esc(s);
      e = e.replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">رابط</a>'; });
      e = e.replace(/((?:free-session|services|contact|faq|projects|about|ai-agents|custom-ai|software)\.html[^\s<]*)/g, '<a href="$1">هنا</a>');
      return e;
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
      add('bot', 'أهلاً بك! أنا المساعد الذكي. اسألني عن <strong>الخدمات</strong>، <strong>الأسعار</strong>، أو <strong>حجز الاستشارة المجانية</strong>. <small style="color:#8E94A0">(قد تُحفظ المحادثة لتحسين الخدمة)</small>');
    }
    function offline() {
      add('bot', 'المساعد الذكي سيعمل هنا قريباً. الآن يمكنك <a href="free-session.html">حجز استشارتك المجانية</a> أو مراسلتي واتساب من الزر أعلى المحادثة.');
    }
    function send(q) {
      add('user', esc(q));
      if (!AI_WORKER_URL) { offline(); return; }
      var now = Date.now();
      if (busy || now - lastSend < 3000) { if (!busy) add('bot', 'مهلاً قليلاً…'); return; }
      busy = true; lastSend = now;
      var tp = add('bot ai-typing', '…');
      hist.push({ role: 'user', content: q });
      hist = hist.slice(-6);
      fetch(AI_WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          busy = false;
          tp.classList.remove('ai-typing');
          var t = (j && j.text) || 'عذراً، حاول مجدداً.';
          tp.innerHTML = linkify(t);
          log.scrollTop = log.scrollHeight;
          hist.push({ role: 'assistant', content: t });
          hist = hist.slice(-6);
        })
        .catch(function () {
          busy = false;
          tp.classList.remove('ai-typing');
          tp.innerHTML = 'تعذر الاتصال. <a href="free-session.html">احجز استشارتك</a> أو راسلني واتساب.';
          log.scrollTop = log.scrollHeight;
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
      if (b) send(b.textContent);
    });
    if (chatFab) chatFab.addEventListener('click', function () { setTimeout(greet, 350); });
    greet();
  })();
})();
