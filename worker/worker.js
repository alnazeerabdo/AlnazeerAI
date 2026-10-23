/* ============================================================
   مساعد النذير — Cloudflare Worker
   ------------------------------------------------------------
  _backend for the AI assistant on the portfolio site._

   Deploy:
     cd worker
     npx wrangler deploy
     npx wrangler secret put GROQ_KEY        # Groq API key (secret)

   Notes:
   - The website (script.js) POSTs {messages:[{role,content}]} and expects {text:"..."}.
     Keep this contract intact or update script.js too.
   - ALLOWED_ORIGINS: comma-separated list of allowed origins (e.g. https://yourdomain.com).
     Leave empty = allow any origin (current behaviour).
   - RATE_LIMIT: optional KV namespace binding for per-IP throttling.
     Without it, no server-side rate limit is applied.
   ============================================================ */

// النص الأمامي قابل للتحرير: worker/system.txt (يُستورد أدناه)
import SYSTEM from './system.txt';


const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec';

const MAX_MESSAGES = 16;     // عدد الرسائل التي تُرسل نصاً كاملاً للنموذج (الذاكرة الحرفية)
const MAX_CONTENT = 500;      // max chars per message
const MAX_DIGEST = 1500;      // أقصى حجم لملخّص الرسائل الأقدم (يُضاف كـ system context)
const RATE_LIMIT_MAX = 30;   // طلب/دقيقة/IP
const IP_DAILY_MAX = 150;    // طلب/يوم/IP
const SESSION_DAILY_MAX = 50; // رسالة/يوم/جلسة (الزائر الحقيقي < 20)
const FALLBACK = 'عذراً، حاول مجدداً.';
const FALLBACK_ERR = 'حدث خطأ، حاول مجدداً أو راسلني على واتساب: https://wa.me/249117148664';
const WA_LINK = 'https://wa.me/249117148664';
const BUSY_MSG = 'المساعد مشغول الآن بسبب كثرة الأسئلة — انتظر قليلاً ثم أعد السؤال، أو راسلني مباشرة على واتساب: ' + WA_LINK;

// أنماط محاولة انتهاز/حقن تعليمات — تُرفض قبل استهلاك أي توكن.
const INJECTION = /\b(ignore|disregard|forget|override)\b[\s\S]{0,60}\b(previous|prior|above|system|instructions?)\b|you\s+are\s+now|act\s+as\s+if|pretend\s+(to\s+be|you)|jailbreak|DAN\s+mode|developer\s+mode|system\s*prompt|reveal\s+(your|the)\s+(instructions?|prompt|rules?)|print\s+(your|the)\s+(instructions?|prompt)/i;

// نماذج غير دردشة (حماية/صوت/تضمين) — لا تُستخدم.
const MODEL_BLOCKLIST = /guard|whisper|tts|embed|playground|moderation|vision|audio/i;
// نماذج الاستدلال: تُبقي على حد التوكنات فتقطع الرد — تُستخدم كخطة أخيرة فقط.
const REASONING = /r1|distill|thinking|reason|gpt-oss|qwen3/i;
// ترتيب التفضيل: gpt-oss أولاً (يدعم تخزين البادئة مؤقتاً => التوكنات المخزّنة لا تُحسب ضمن الحد)، ثم qwen3.
const PREFERRED = ['gpt-oss-120b', 'gpt-oss-20b', 'qwen3.6-27b', 'qwen3.8-27b', 'qwen3.6', 'qwen3.8', 'kimi-k2', 'mistral-large', 'ministral'];

function rankModel(id) {
  const low = String(id).toLowerCase();
  const i = PREFERRED.findIndex(function (p) { return low.indexOf(p) !== -1; });
  return i === -1 ? 99 : i;
}

function corsHeaders(env, origin) {
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  // Empty list = allow any origin (keeps current behaviour).
  let allow = '*';
  if (allowed.length) {
    const o = origin || '';
    // Missing / 'null' origin (same-origin or file://) can't be verified -> allow it.
    allow = (!o || o === 'null' || allowed.indexOf(o) !== -1) ? (o || '*') : allowed[0];
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

// عداد KV مع TTL — يزيد ويُرجع العدد بعد الزيادة.
async function bump(kv, key, ttl) {
  const n = parseInt((await kv.get(key)) || '0', 10) + 1;
  await kv.put(key, String(n), { expirationTtl: ttl });
  return n;
}

// حماية إساءة الاستخدام عبر KV: حد IP/دقيقة، حد IP/يوم، حد جلسة/يوم.
// يُرجع null إذا كان الطلب مسموحاً، أو نص الرد عند الرفض.
async function abuseGuard(env, ip, session) {
  const kv = env.RATE_LIMIT;
  if (!kv) return null; // لا KV = لا حماية عددية (لكن الكابتشا والفلترة تبقى)
  try {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const perMin = await bump(kv, 'm:' + ip, 120);
    if (perMin > RATE_LIMIT_MAX) return BUSY_MSG;
    const ipDay = await bump(kv, 'd:' + ip + ':' + day, 90000);
    if (ipDay > IP_DAILY_MAX) return BUSY_MSG;
    if (session) {
      const sesDay = await bump(kv, 's:' + session + ':' + day, 90000);
      if (sesDay > SESSION_DAILY_MAX) return BUSY_MSG;
    }
    return null;
  } catch (e) {
    return null; // لا تمنع الزائر بسبب خلل KV
  }
}

// التحقق من رمز Cloudflare Turnstile (يتفعّل فقط عند ضبط TURNSTILE_SECRET).
async function verifyTurnstile(env, token, ip) {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return true;  // غير مُفعّل
  if (!token) return false;  // مفعّل ولم يُرسل رمز => رفض
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secret, response: token, remoteip: ip || '' })
    });
    const j = await r.json();
    return !!(j && j.success);
  } catch (e) {
    return true; // تجاوز عند خلل شبكة — لا نمنع الزائر بسبب مشكلة Cloudflare
  }
}

// Keep only valid turns, trimmed to the allowed size.
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant'); })
    .slice(-MAX_MESSAGES)
    .map(function (m) {
      return { role: m.role, content: String(m.content == null ? '' : m.content).slice(0, MAX_CONTENT) };
    });
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ text: FALLBACK }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    try {
      const ip = req.headers.get('CF-Connecting-IP') || '';

      const raw = await req.text();
      if (raw.length > 20000) {
        return new Response(JSON.stringify({ text: FALLBACK }), { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      const messages = sanitizeMessages(parsed && parsed.messages);
      const session = String((parsed && parsed.session) || '').slice(0, 40);
      const page = String((parsed && parsed.page) || '').slice(0, 120);
      const tsToken = String((parsed && parsed.turnstile) || '').slice(0, 2000);
      // ملخّص الرسائل الأقدم (يبنيه الموقع تلقائياً) — يضاف كـ system context حتى لا تفقد المحادثة ذاكرتها.
      const digest = String((parsed && parsed.digest) || '').replace(/\s+/g, ' ').trim().slice(0, MAX_DIGEST);

      // --- 1) حدود الاستخدام (KV): دقيقة/يوم/IP + يوم/جلسة ---
      const blocked = await abuseGuard(env, ip, session);
      if (blocked) {
        return new Response(JSON.stringify({ text: blocked }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // --- 2) الكابتشا الخفي (Turnstile) — يتفعّل فقط عند ضبط TURNSTILE_SECRET ---
      if (!(await verifyTurnstile(env, tsToken, ip))) {
        return new Response(JSON.stringify({ text: 'تعذر التأكد من أنك إنسان — أعد المحاولة، أو راسلني مباشرة على واتساب: ' + WA_LINK }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!messages.length) {
        return new Response(JSON.stringify({ text: FALLBACK }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // --- 3) رفض محاولات حقن التعليمات / كسر القواعد (بلا استهلاك توكنات) ---
      const lastUser = messages.slice().reverse().find(function (m) { return m.role === 'user'; });
      if (lastUser && INJECTION.test(String(lastUser.content))) {
        return new Response(JSON.stringify({ text: 'لا أستطيع مساعدتك في ذلك. يمكنني الإجابة عن أسئلتك عن خدمات النذير ومشاريعه، أو حجز استشارة مجانية له.' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Discover available chat models once per isolate (self-heals when Groq retires a model).
      if (!globalThis.CHAT_MODELS) {
        try {
          const mr = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY } });
          const mj = await mr.json();
          const all = ((mj && mj.data) || []).map(function (x) { return x.id; })
            .filter(function (id) { return /llama|qwen|gpt-oss|kimi|deepseek|mistral/i.test(id) && !MODEL_BLOCKLIST.test(id); });
          // على الطبقة المجانية يوجد gpt-oss و qwen3 فقط (llama مدفوع). gpt-oss يدعم تخزين البادئة مؤقتاً (prompt caching)
          // فاسمحه أولاً: التوكنات المخزّنة لا تُحسب ضمن حد التوكنات/الدقيقة.
          const fast = all.filter(function (id) { return !REASONING.test(id); })
            .sort(function (a, b) { return rankModel(a) - rankModel(b); });
          const slow = all.filter(function (id) { return REASONING.test(id); })
            .sort(function (a, b) { return rankModel(a) - rankModel(b); });
          globalThis.CHAT_MODELS = fast.slice(0, 2).concat(slow.slice(0, 3));
          console.log('MODELS_DISCOVERED=' + JSON.stringify(globalThis.CHAT_MODELS));
        } catch (e) {}
      }
      // سلسلة بديلة قصيرة: كل محاولة تعيد إرسال الـ prompt فتلتهم حد التوكنات — لا تكثر من المحاولات.
      const MODELS = (globalThis.CHAT_MODELS && globalThis.CHAT_MODELS.length)
        ? globalThis.CHAT_MODELS.slice(0, 3)
        : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

      // ذاكرة إجابات داخل العامل: نفس السؤال يعاد ردّه بلا استدعاء النموذج (يوفّر حد التوكنات).
      // نضيف طول المحادثة للمفتاح: نفس السؤال في سياق أعمق قد يستحق جواباً مختلفاً،
      // بينما تكرار السبام لنفس الرسالة (طول 1) يظل يلتقط الذاكرة ويوفّر التوكنات.
      const qKey = lastUser ? String(lastUser.content).trim().slice(0, 300) + '#' + messages.length : '';
      if (!globalThis.ANSWER_CACHE) globalThis.ANSWER_CACHE = new Map();
      const cached = qKey ? globalThis.ANSWER_CACHE.get(qKey) : null;
      if (cached && (Date.now() - cached.t) < 600000) {
        console.log(JSON.stringify({ model: 'cache', len: cached.a.length }));
        return new Response(JSON.stringify({ text: cached.a }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // النص الأمامي + ملخّص الأقدم (إن وُجد) = سياق كامل بلا استدعاء نموذج إضافي.
      const systemText = digest
        ? SYSTEM + '\n\n## معلومات الزائر السابقة من هذه المحادثة (موثوقة، اعتمد عليها مباشرة عند السؤال عنها ولا تقل إنك لا تملكها)\n' + digest
        : SYSTEM;

      let text = '', partial = '', usedModel = '', cut = 0, lastErr = '', usage = null;
      for (const m of MODELS) {
        const isOss = /gpt-oss/i.test(m);
        const body = {
          model: m,
          messages: [{ role: 'system', content: systemText }, ...messages],
          temperature: 0.3,
          max_tokens: isOss ? 700 : 1500
        };
        // gpt-oss: قلّل توكنات التفكير الداخلي حتى لا يُقطع الرد.
        if (isOss) body.reasoning_effort = 'low';
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!r.ok) {
            lastErr = m + ':' + r.status + ':' + (await r.text()).slice(0, 160);
            continue;
          }
          const j = await r.json();
          usage = j.usage || null;
          const choice = j && j.choices && j.choices[0];
          const content = choice && choice.message && choice.message.content;
          if (!content) { lastErr = m + ':empty'; continue; }
          if (choice.finish_reason === 'length') { cut++; if (content.length > partial.length) partial = content; continue; }
          text = content; usedModel = m;
          break;
        } catch (e) { lastErr = m + ':' + String(e).slice(0, 120); }
      }
      if (!text) {
        // كل النماذج مشغولة (تجاوز حد الطلبات غالباً) — رسالة واضحة بدل «حاول مجدداً».
        text = /429/.test(lastErr)
          ? 'المساعد مشغول الآن بسبب كثرة الأسئلة — انتظر قليلاً ثم أعد السؤال، أو راسلني مباشرة على واتساب: ' + WA_LINK
          : (partial || FALLBACK);
      }

      // ===== حجز استشارة داخل المحادثة =====
      // إن أنتج النموذج قالب [[حجز]]{...}[[/حجز]] مع اكتمال الحقول:
      // يُرسل الطلب إلى تبويب «استشارات» في نفس الـ Sheet مع إيميل فوري للنذير،
      // ويُستبدل رؤية المستخدم برسالة تأكيد ثابتة. القالب المكتمل لا يظهر للمستخدم.
      let booked = false;
      const bk = text.match(/\[\[\s*حجز\s*\]\]([\s\S]*?)\[\[\s*\/\s*حجز\s*\]\]/);
      if (bk) {
        text = text.replace(bk[0], '').replace(/```[\s\S]*?```/g, '').trim();
        let f = null;
        try {
          const j = JSON.parse(bk[1].trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim());
          if (j && String(j['الاسم'] || '').trim() && String(j['التواصل'] || '').trim() && String(j['المشكلة'] || '').trim()) {
            f = {
              name: String(j['الاسم']).trim().slice(0, 80),
              contact: String(j['التواصل']).trim().slice(0, 120),
              problem: String(j['المشكلة']).trim().slice(0, 1000)
            };
          }
        } catch (e) {}
        if (f) {
          const isMail = /@/.test(f.contact);
          const ctl = new AbortController();
          const timer = setTimeout(function () { ctl.abort(); }, 8000);
          try {
            const br = await fetch(SHEET_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                form: 'booking', page: page,
                name: f.name, phone: isMail ? '' : f.contact, email: isMail ? f.contact : '',
                work: 'حجز عبر المساعد الذكي', problem: f.problem, size: ''
              }),
              signal: ctl.signal
            });
            const bj = await br.json();
            booked = !!(bj && bj.ok);
            console.log(JSON.stringify({ booking: booked, tab: bj && bj.tab, row: bj && bj.row, err: bj && bj.error }));
          } catch (e) {
            console.log(JSON.stringify({ booking: false, err: String(e).slice(0, 120) }));
          } finally {
            clearTimeout(timer);
          }
          text = booked
            ? 'تم استلام طلبك بنجاح، وسيتواصل معك النذير لتحديد موعد الاستشارة المجانية.\n\nإن لم يصلك اتصال خلال يومين راسله مباشرة على واتساب: ' + WA_LINK
            : 'حصل خلل تقني ولم يصل طلبك — أعد المحاولة بعد قليل، أو راسل النذير مباشرة على واتساب: ' + WA_LINK;
        }
      }

      if (text && text !== FALLBACK && !booked && qKey) {
        globalThis.ANSWER_CACHE.set(qKey, { a: text, t: Date.now() });
        if (globalThis.ANSWER_CACHE.size > 60) {
          globalThis.ANSWER_CACHE.delete(globalThis.ANSWER_CACHE.keys().next().value);
        }
      }
      console.log(JSON.stringify({
        model: usedModel || 'none', len: text.length, cutAttempts: cut, err: lastErr,
        cachedTokens: usage && usage.prompt_tokens_details ? usage.prompt_tokens_details.cached_tokens : 0,
        promptTokens: usage ? usage.prompt_tokens : 0
      }));

      // Archive the conversation in the same Google Sheet as the booking form.
      ctx.waitUntil(fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          log: 'chat',
          session: session,
          page: page,
          question: ((lastUser && lastUser.content) || '').slice(0, 1000),
          answer: text.slice(0, 2000)
        })
      }));

      return new Response(JSON.stringify({ text }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ text: FALLBACK_ERR }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  }
};
