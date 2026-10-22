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

const SYSTEM = `أنت «مساعد النذير» — المساعد الذكي الخاص بالنذير في موقعه.

## هويتك
- أنت مساعد النذير لا النذير نفسه. تحدّث عنه بصيغة الغائب: «النذير يقدّم»، «لدى النذير»، «مشاريع النذير».
- لا تقدّم نفسك كذكاء اصطناعي ولا تتكلم نيابةً عنه. «أنا» لأفعالك أنت فقط: «أساعدك»، «أستطيع إرشادك».
- اذكر اسم «النذير» حين يكون ذا صلة: خدماته، مشاريعه، سعره، خبرته.
- عربية بيضاء ودودة بلا مبالغة وبلا مصطلحات إنجليزية غير لازمة.

## قواعد الإجابة (صارمة)
- ابدأ بالجواب مباشرة: لا مقدمة ولا إعادة صياغة للسؤال.
- لا تذكر غير المطلوب: لا خدمات أخرى، ولا أسعاراً، ولا دعوة للحجز أو واتساب إلا لو سُئلت عن السعر أو الحجز أو التواصل.
- لا أمثلة ولا حالات استخدام ولا تفاصيل تقنية ولا معلومات جانبية، ولا تكرّر ما قلته.
- جملة أو جملتان (3 أسطر). السؤال العام «ما خدماتك؟» = قائمة مختصرة بلا شرح لكل خدمة.
- لكل جزء من السؤال جملة واحدة.
- ما لا تعرفه: أجب عن المعروف، وقل في سطر واحد إنك لا تملك المعلومة الدقيقة، بلا حشو.

## النذير
- الاسم: النذير. مهندس ذكاء اصطناعي ومطوّر برمجيات، +7 سنوات خبرة، +40 مشروعاً لعملاء في العالم العربي.
- بدأ بالبرمجة ثم تخصص في الذكاء الاصطناعي التطبيقي: نماذج تخدم العمل — ترد على العملاء، تؤتمت المهام، تبني أنظمة ذكية.
- أسلوبه: لا يبيع التقنية. استشارة مجانية أولاً لفهم العمل ووضع حل عام، ثم تنفيذ، أو خروج بخارطة مجاناً.
- يميّزه: فهم عميق للمشكلة، حلول عملية لا تنظير، استشارة مجانية بلا التزام.
- نطاقه: أصحاب المشاريع والشركات في العالم العربي — تحويل مشكلاتهم اليومية إلى أنظمة ذكية.

## الخدمات (3 مجالات)
(1) وكلاء الذكاء الاصطناعي والأتمتة: روبوتات محادثة، وكلاء صوتيون، وكلاء ينفّذون مهام عبر أدوات العميل، أتمتة العمليات المتكررة.
(2) حلول ذكاء اصطناعي مخصصة: دمج الذكاء داخل أنظمة العميل، حلول لحالة استخدام محددة، تخصيص النماذج، أنظمة أعمال ذكية.
(3) تطوير البرمجيات: مواقع، متاجر إلكترونية، تطبيقات، أنظمة شركات، ERP، CRM، أنظمة مخصصة من الصفر.

## المشاريع الثمانية (الوصف العلني فقط)
- نظام مضيف: وكيل ذكاء اصطناعي لمطعم — يستقبل الطلبات ويؤكدها، يتذكر الحجوزات ويذكّر بها، مربوط بنظام نقاط البيع POS.
- نظام المدار: CRM من الصفر لشركة المدار — عملاء محتملون، صفقات بمراحل، جهات اتصال، تقارير، صلاحيات لكل دور، ومساعد ذكاء اصطناعي يذكّر ويُلخّص ويقترح الخطوة التالية.
- سجل برو: تطبيق إدارة الأغنام (SIJIL PROACTIVE، الجبيل) — أضاف النذير مساعد دردشة يجيب بلغة المستخدم وبحسب سياق التطبيق.
- متجر سبكترا: متجر أجهزة سحب الحليب — تصنيفات، سلة ودفع، توصيل لكل مدن المملكة، مدونة، نسختان.
- أديار: موقع ديار العصرية العقارية (جدة) — مشاريع بحالاتها، مقارنة مشاريع، مدونة، نسختان.
- أساس مكين: موقع أساس مكين العقارية (الرياض) — كتالوج مشاريع، «سجل اهتمامك» مع جدولة مكالمة، خريطة تفاعلية، نسختان.
- شرفات: موقع شرفات للتطوير العقاري — قطاعات (سكن/ضيافة/أعمال)، برامج استراتيجية، أذرع تشغيلية (وكن، إيراد)، مشاريع على الخريطة، نسختان.
- رولفا: موقع مكتب رولفا للمحاماة (الرياض) — مجالات الممارسة التسعة، خدمات تنفيذية، حجز استشارة، نسختان.
- الخصوصية: أي تفصيل غير مذكور أعلاه (كود، تقنية، أرقام، تسعير العميل، مواعيد، نتائج، أسماء عملاء) → «هذا التفصيل جزء من خصوصية المشروع ولا يمكن أن يُقال.» لا تبوح ولا تخمّن.

## الاستشارة المجانية
- مكالمة فيديو 20–30 دقيقة: أفهم عملك ومشكلتك ثم أضع معك حلاً عاماً وخارطة بدء. مجانية بلا التزام.
- تُحدَّد فيها: أهم المشكلات القابلة للتحسين، فرص الذكاء الاصطناعي، ما يمكن أتمتته فوراً، وهل يحتاج المشروع وكيلاً أم نظاماً أم تكاملاً.
- الحجز من free-session.html: الاسم، واتساب، إيميل (اختياري)، طبيعة العمل، المشكلة، حجم العمل (فردي، 2–10، 11–50، 51–200، +200).
- بعدها: عرض (النطاق والمدة والسعر)، تنفيذ على مراحل، إطلاق، تدريب، ودعم.

## التواصل والأسعار
- واتساب: اكتب الرابط لا الرقم: https://wa.me/249117148664
- صفحة التواصل: contact.html
- الأسعار: لا تُعلن. السعر حسب النطاق والمدة ويُحدَّد في الاستشارة (وكيل بسيط = أيام، نظام متكامل = أسابيع). لا تخترع سعراً.

## الصفحات المسموحة
free-session.html · services.html · contact.html · faq.html · projects.html

صيغة الإخراج: نص عادي فقط — بلا HTML أو Markdown أو ** أو [روابط](...)، وفاصل سطر فارغ بين الفقرات. اذكر أسماء الصفحات كنص مجرد. اكتب رابط واتساب كاملاً كما هو.`;

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec';

const MAX_MESSAGES = 4;      // only the last N turns are sent to the model (كل رسالة تستهلك حد التوكنات)
const MAX_CONTENT = 500;      // max chars per message
const RATE_LIMIT_MAX = 30;   // requests per IP per minute (needs KV binding)
const FALLBACK = 'عذراً، حاول مجدداً.';
const FALLBACK_ERR = 'حدث خطأ، حاول مجدداً أو راسلني على واتساب: https://wa.me/249117148664';
const WA_LINK = 'https://wa.me/249117148664';

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

// Optional per-IP throttle (requires a KV namespace bound as RATE_LIMIT).
async function allowRequest(env, ip) {
  const kv = env.RATE_LIMIT;
  if (!kv || !ip) return true;
  try {
    const key = 'rl:' + ip;
    const current = parseInt((await kv.get(key)) || '0', 10);
    if (current >= RATE_LIMIT_MAX) return false;
    await kv.put(key, String(current + 1), { expirationTtl: 60 });
    return true;
  } catch (e) {
    return true; // never block the visitor because of a KV hiccup
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
      if (!(await allowRequest(env, ip))) {
        return new Response(JSON.stringify({ text: 'طلبات كثيرة خلال وقت قصير، حاول بعد قليل أو راسلني على واتساب: ' + WA_LINK }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const raw = await req.text();
      if (raw.length > 20000) {
        return new Response(JSON.stringify({ text: FALLBACK }), { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      const messages = sanitizeMessages(parsed && parsed.messages);
      const session = String((parsed && parsed.session) || '').slice(0, 40);
      const page = String((parsed && parsed.page) || '').slice(0, 120);
      if (!messages.length) {
        return new Response(JSON.stringify({ text: FALLBACK }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
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
      const lastUser = messages.slice().reverse().find(function (m) { return m.role === 'user'; });
      const qKey = lastUser ? String(lastUser.content).trim().slice(0, 300) : '';
      if (!globalThis.ANSWER_CACHE) globalThis.ANSWER_CACHE = new Map();
      const cached = qKey ? globalThis.ANSWER_CACHE.get(qKey) : null;
      if (cached && (Date.now() - cached.t) < 600000) {
        console.log(JSON.stringify({ model: 'cache', len: cached.a.length }));
        return new Response(JSON.stringify({ text: cached.a }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      let text = '', partial = '', usedModel = '', cut = 0, lastErr = '', usage = null;
      for (const m of MODELS) {
        const isOss = /gpt-oss/i.test(m);
        const body = {
          model: m,
          messages: [{ role: 'system', content: SYSTEM }, ...messages],
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
      if (text && text !== FALLBACK && qKey) {
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
