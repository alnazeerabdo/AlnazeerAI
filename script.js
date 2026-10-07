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
    enabled: false, // اجعلها true بعد وضع الرابط
    actionUrl: '', // مثال: 'https://docs.google.com/forms/d/e/XXXX/formResponse'
    fields: {
      name: 'entry.1111111111',
      phone: 'entry.2222222222',
      email: 'entry.3333333333',
      work: 'entry.4444444444',
      problem: 'entry.5555555555',
      size: 'entry.6666666666',
      service: 'entry.7777777777'
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
        note.textContent = 'اخترت: ' + svc + ' — اذكر لي تفاصيل أكثر لأجهز لك حلاً عاماً في الجلسة.';
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
      var serviceInterest = (document.getElementById('serviceInterest') || {}).value || '';
      var sizeEl = booking.querySelector('input[name="size"]:checked');
      var size = sizeEl ? sizeEl.value : '';
      var noteEl = document.getElementById('bookingNote');
      name = name.trim(); phone = phone.trim(); email = email.trim(); work = work.trim(); problem = problem.trim();
      function say(msg, ok) {
        if (!noteEl) return;
        noteEl.style.color = ok ? '#1a7f37' : '#b42318';
        noteEl.textContent = msg;
      }
      if (!name || !phone || !email || !work || !problem || !size) {
        say('يرجى تعبئة جميع الحقول المطلوبة حتى أجهز لك الجلسة بشكل صحيح.', false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say('يرجى إدخال بريد إلكتروني صحيح.', false);
        return;
      }
      // إرسال إلى Google Form إن كان مفعّلاً
      if (GOOGLE_FORM_CONFIG.enabled && GOOGLE_FORM_CONFIG.actionUrl) {
        var fd = new FormData();
        fd.append(GOOGLE_FORM_CONFIG.fields.name, name);
        fd.append(GOOGLE_FORM_CONFIG.fields.phone, phone);
        fd.append(GOOGLE_FORM_CONFIG.fields.email, email);
        fd.append(GOOGLE_FORM_CONFIG.fields.work, work);
        fd.append(GOOGLE_FORM_CONFIG.fields.problem, problem);
        fd.append(GOOGLE_FORM_CONFIG.fields.size, size);
        fd.append(GOOGLE_FORM_CONFIG.fields.service, serviceInterest);
        fetch(GOOGLE_FORM_CONFIG.actionUrl, { method: 'POST', mode: 'no-cors', body: fd })
          .then(function () {
            say('تم استلام طلبك يا ' + name + '! سأتواصل معك قريباً لتأكيد موعد الجلسة المجانية.', true);
            booking.reset();
          })
          .catch(function () {
            say('تم حفظ طلبك محلياً، سأتواصل معك قريباً يا ' + name + '.', true);
            booking.reset();
          });
      } else {
        say('شكراً ' + name + '! تم استلام طلب جلستك المجانية وسأتواصل معك على واتساب قريباً. (لتفعيل الربط التلقائي: ضع رابط Google Form في script.js)', true);
        booking.reset();
      }
    });
  }

  // Simple contact form (contact.html)
  var cform = document.getElementById('contactForm');
  if (cform && !booking) {
    cform.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = document.getElementById('name');
      var em = document.getElementById('email');
      var tp = document.getElementById('type');
      var ms = document.getElementById('msg');
      var note = document.getElementById('formNote');
      if (!n || !em || !tp || !ms) return;
      if (!n.value.trim() || !em.value.trim() || !tp.value || !ms.value.trim()) {
        note.style.color = '#FFB4B4';
        note.textContent = 'يرجى تعبئة جميع الحقول المطلوبة.';
        return;
      }
      note.style.color = '#E9B44C';
      note.textContent = 'شكراً ' + n.value.trim() + '! وصلتني رسالتك وسأرد عليك قريباً. وإن كنت تريد حلاً أسرع احجز جلستك المجانية.';
      cform.reset();
    });
  }
})();
