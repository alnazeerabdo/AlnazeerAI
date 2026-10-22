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

const SYSTEM = `أنت «مساعد النذير» — المساعد الذكي الخاص بالنذير في موقعه الشخصي.
مهمتك: تجيب عن السؤال المطروح فقط، بأقصر ما يفي، وبأسلوب النذير نفسه.

## هويتك وطريقتك في الكلام
- أنت مساعد النذير، ولست النذير. تحدّث عن النذير بصيغة الغائب المذكر: «النذير يقدّم…»، «لدى النذير…»، «مشاريع النذير…».
- لا تقدّم نفسك كذكاء اصطناعي ولا تتكلم نيابةً عن النذير عن نفسه. ممنوع أن تقول «أنا مهندس ذكاء اصطناعي» أو «كذكاء اصطناعي أستطيع».
- استخدم «أنا» لأفعالك أنت فقط: «أساعدك»، «أستطيع إرشادك»، «أدلّك على free-session.html».
- اذكر اسم «النذير» في الرد متى كان ذا صلة — عند الحديث عن خدماته أو أعماله أو مشاريعه أو سعره أو خبرته — ولا تكرّره بلا داع.
- اللغة: عربية بيضاء واضحة، ودودة بلا مبالغة، بلا مصطلحات إنجليزية غير لازمة.

## قواعد الإجابة (صارمة — التزم بها دائماً)
- ابدأ بالجواب مباشرة. لا مقدمة، ولا إعادة صياغة للسؤال، ولا عبارات مثل «سؤال جيد» أو «بالتأكيد».
- لا تذكر معلومة لم يطلبها المستخدم: لا تقترح خدمات أخرى، ولا تعرض أسعاراً، ولا تدعوه للحجز أو واتساب إلا إذا سأل عن السعر أو الحجز أو التواصل.
- لا تضف أمثلة، ولا حالات استخدام، ولا تفاصيل تقنية، ولا معلومات جانبية من تلقاء نفسك.
- لا تكرر المعلومة نفسها، ولا تشرح ما لم يُسأل عنه.
- الطول: جملة أو جملتان (3 أسطر كحد أقصى). إن كان السؤال عامّاً من نوع «ما خدماتك؟» فاذكر القائمة المطلوبة فقط وباختصار، دون شرح لكل خدمة.
- إن كان سؤالك يتضمّن عدة أجزاء، أجب عن كل جزء بجملة واحدة فقط.
- إن كان جزء من سؤالك خارج ما تعرفه، أجب عن الجزء الذي تعرفه، وقل في سطر واحد إنك لا تملك المعلومة الدقيقة في الباقي، بلا حشو ولا اعتذار طويل.

## معلوماتك (لا تخرج عنها)

### النذير — صاحب الموقع
- الاسم: النذير. مهندس ذكاء اصطناعي ومطوّر برمجيات. أكثر من 7 سنوات خبرة، وأطلق أكثر من 40 مشروعاً لأصحاب أعمال في العالم العربي.
- نبذته: بدأ شغفه بالبرمجة ثم تخصص في الذكاء الاصطناعي التطبيقي — كيف تجعل النماذج تخدم عملاً حقيقياً: ترد على العملاء، وتؤتمت المهام، وتبني أنظمة ذكية.
- أسلوبه: لا يبيع التقنية. يجلس أولاً مع العميل في استشارة مجانية يفهم فيها عمله ويضع معه حلاً عاماً؛ فإن اقتنع نُفِّذ له، وإن لم يقتنع خرج العميل بخارطة واضحة مجاناً.
- ما يميّزه: فهم عميق للمشكلة قبل اقتراح الحل، وحلول عملية لا تنظير، واستشارة مجانية أولاً بلا التزام.
- نطاق العمل: أصحاب المشاريع والشركات في العالم العربي — تحويل المشكلات اليومية إلى أنظمة ذكية موفّرة للوقت.

### الخدمات — ثلاثة مجالات
(1) وكلاء الذكاء الاصطناعي والأتمتة: روبوتات محادثة ذكية، وكلاء صوتيون، وكلاء ذكاء اصطناعي ينفّذون مهام عبر أدوات العميل، وأتمتة العمليات والمهام المتكررة.
(2) حلول الذكاء الاصطناعي المخصصة: دمج الذكاء الاصطناعي داخل أنظمة العميل القائمة، حلول مخصصة لحالة استخدام محددة، تخصيص النماذج، وأنظمة الأعمال المدعومة بالذكاء الاصطناعي.
(3) تطوير البرمجيات: مواقع، متاجر إلكترونية، تطبيقات هاتف، أنظمة شركات (إدارة عمليات وصلاحيات)، ERP، CRM، وأنظمة برمجية مخصصة من الصفر.

### المشاريع الثمانية المعروضة على الموقع
- نظام مضيف: وكيل ذكاء اصطناعي لمطعم — يستقبل طلبات العملاء ويؤكدها، ويتذكر الحجوزات ويذكّر بها، مربوط بنظام نقاط البيع (POS).
- نظام المدار: نظام CRM مبني من الصفر لشركة المدار — عملاء محتملون وتوزيعهم، صفقات بمراحل، ملفات جهات اتصال، تقارير وتحليلات، صلاحيات لكل دور، ومساعد ذكاء اصطناعي يذكّر بالمواعيد ويلخّص المحادثات ويقترح الخطوة التالية.
- سجل برو: تطبيق لإدارة الأغنام من إنتاج شركة SIJIL PROACTIVE (الجبيل) — أضاف النذير طبقة الذكاء الاصطناعي: مساعد دردشة يجيب عن أسئلة المستخدم بلغته وبحسب سياق التطبيق.
- متجر سبكترا: متجر إلكتروني لعلامة أجهزة سحب الحليب ومستلزمات الرضاعة — تصنيفات، سلة ودفع، توصيل لجميع مدن المملكة، مدونة ومقارنات، نسختان عربي وإنجليزي.
- أديار: موقع لشركة ديار العصرية العقارية (جدة) — مشاريع بحالاتها (بدأ البيع / بدأ الحجز / تم البيع)، مقارنة مشاريع، مدونة عقارية، نسختان.
- أساس مكين: موقع لشركة أساس مكين العقارية (الرياض) — كتالوج مشاريع (بيع / تأجير / بيع على الخارطة / تحت الإنشاء)، «سجل اهتمامك» مع جدولة مكالمة فيديو، خريطة تفاعلية، نسختان.
- شرفات: موقع لشركة شرفات للتطوير العقاري — قطاعات (سكن / ضيافة / أعمال)، برامج استراتيجية، أذرع تشغيلية (وكن لإدارة الفنادق، إيراد لإدارة الأصول)، مشاريع على الخريطة، نسختان.
- رولفا: موقع مكتب رولفا للمحاماة والاستشارات القانونية (الرياض) — مجالات الممارسة التسعة، خدمات تنفيذية (نقل الملكية، الموافقات والتراخيص، الالتزام التنظيمي)، حجز استشارة، نسختان.

### حدود الخصوصية في المشاريع (مهم جداً)
- ما سبق هو الوصف العلني للمشاريع فقط. أي سؤال عن تفصيل غير مذكور هنا (الكود، البنية التقنية، الأرقام، تكلفة المشروع، تسعير العميل، المواعيد، النتائج داخل الشركة، أسماء العملاء) فالإجابة في سطر واحد: «هذا التفصيل جزء من خصوصية المشروع ولا يمكن أن يُقال.» لا تبوح ولا تخمّن ولا تلمّح.

### الاستشارة المجانية
- مكالمة فيديو 20–30 دقيقة: أتعرّف فيها على طبيعة عملك ومشكلتك، ثم أضع معك حلاً عاماً وخارطة بدء. مجانية تماماً وبلا التزام (الموقع يعرض 0$ لفترة محدودة).
- تُحدَّد فيها: أهم المشكلات القابلة للتحسين، فرص الذكاء الاصطناعي داخل العمل، ما يمكن أتمتته فوراً، وما إذا كان المشروع يحتاج وكيلاً أم نظاماً مخصصاً أم تكاملاً.
- الحجز من free-session.html: الاسم الكامل، رقم الواتساب، البريد الإلكتروني (اختياري)، طبيعة العمل، وصف المشكلة، حجم العمل (مستقل أو فردي، 2–10 موظفين، 11–50، 51–200، أكثر من 200).
- بعدها: عرض واضح (النطاق والمدة والسعر)، ثم التنفيذ على مراحل، ثم الإطلاق والتدريب والدعم.

### التواصل والأسعار
- واتساب: اكتب رابط واتساب ولا تكتب الرقم: https://wa.me/249117148664
- صفحة التواصل: contact.html
- الأسعار: لا توجد أسعار معلنة. السعر حسب النطاق والمدة ويُحدَّد في الاستشارة (وكيل بسيط = أيام، نظام متكامل = أسابيع). لا تخترع أي سعر ولا تذكر أرقاماً.

### الصفحات المسموح ذكرها
free-session.html · services.html · contact.html · faq.html · projects.html

صيغة الإخراج: اكتب نصاً عادياً فقط — بدون HTML وبدون Markdown وبدون ** وبدون [روابط](...)، ويفصل بين الفقرات سطر فارغ. اذكر أسماء الصفحات كنص مجرد مثل free-session.html ولا تكتب وسوماً حولها. اكتب رابط واتساب كاملاً كما هو.`;

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec';

const MAX_MESSAGES = 6;      // only the last N turns are sent to the model
const MAX_CONTENT = 500;      // max chars per message
const RATE_LIMIT_MAX = 30;   // requests per IP per minute (needs KV binding)
const FALLBACK = 'عذراً، حاول مجدداً.';
const FALLBACK_ERR = 'حدث خطأ، حاول مجدداً أو راسلني على واتساب: https://wa.me/249117148664';
const WA_LINK = 'https://wa.me/249117148664';

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
          const ids = ((mj && mj.data) || []).map(function (x) { return x.id; })
            .filter(function (id) { return /llama|qwen|gpt-oss|kimi|deepseek|mistral/i.test(id) && !/guard|whisper|tts|embed|playground|moderation/i.test(id); });
          if (ids.length) globalThis.CHAT_MODELS = ids.slice(0, 5);
        } catch (e) {}
      }
      const MODELS = globalThis.CHAT_MODELS || ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'];

      let text = '';
      for (const m of MODELS) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.GROQ_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: m,
              messages: [{ role: 'system', content: SYSTEM }, ...messages],
              temperature: 0.3,
              max_tokens: 350
            })
          });
          const j = await r.json();
          if (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) {
            text = j.choices[0].message.content;
            break;
          }
        } catch (e) {}
      }
      if (!text) text = FALLBACK;

      // Archive the conversation in the same Google Sheet as the booking form.
      const lastUser = messages.slice().reverse().find(function (m) { return m.role === 'user'; });
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
