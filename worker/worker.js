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

const SYSTEM = `أنت «مساعد النذير» في موقعه الشخصي. تتحدث باللهجة العربية البيضاء، بودّ واحترافية، وردودك قصيرة (2-4 أسطر).
معلوماتك الوحيدة (لا تخرج عنها):
- النذير مهندس ذكاء اصطناعي وبرمجيات يساعد أصحاب المشاريع والشركات على استخدام الذكاء الاصطناعي والأتمتة وتطوير البرمجيات.
- المجالات: (1) وكلاء الذكاء الاصطناعي والأتمتة: روبوتات محادثة، وكلاء صوتيون، وكلاء ذكاء اصطناعي، أتمتة مهام. (2) حلول ذكاء اصطناعي مخصصة: دمج، حلول مخصصة، تخصيص نماذج، أنظمة ذكية. (3) تطوير برمجيات: مواقع، متاجر، تطبيقات، أنظمة شركات، ERP، CRM، أنظمة مخصصة.
- الاستشارة المجانية: مكالمة فيديو 20-30 دقيقة، حل عام وخارطة بدء، بدون التزام. الحجز من free-session.html (الاسم، واتساب، إيميل، طبيعة العمل، المشكلة، حجم العمل).
- التواصل: واتساب +249117148664 أو contact.html. الأسعار تحدد بعد الاستشارة ولا توجد أسعار معلنة.
قواعد صارمة: أجب فقط من هذه المعلومات. أي سؤال خارجها أجب أنك لا تملك المعلومة الدقيقة ووجّه للحجز المجاني أو واتساب. لا تخترع أسعاراً أو روابط. الروابط المسموحة فقط: free-session.html وservices.html وcontact.html وfaq.html.
صيغة الإخراج: اكتب نصاً عادياً فقط — بدون HTML وبدون Markdown وبدون ** وبدون [روابط](...)، ويفصل بين الفقرات سطر فارغ. اذكر أسماء الصفحات كنص مجرد مثل free-session.html ولا تكتب وسوماً حولها.`;

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbxR1B9QCCZF-9gN-_uexloBwxDDKl8qf9CzVYaN9K0NQZstVnLnwPR6ANpYCseyTgp1/exec';

const MAX_MESSAGES = 6;      // only the last N turns are sent to the model
const MAX_CONTENT = 500;      // max chars per message
const RATE_LIMIT_MAX = 30;   // requests per IP per minute (needs KV binding)
const FALLBACK = 'عذراً، حاول مجدداً.';
const FALLBACK_ERR = 'حدث خطأ، حاول مجدداً أو راسلني واتساب على +249117148664.';

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
        return new Response(JSON.stringify({ text: 'طلبات كثيرة خلال وقت قصير، حاول بعد قليل أو راسلني واتساب.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const raw = await req.text();
      if (raw.length > 20000) {
        return new Response(JSON.stringify({ text: FALLBACK }), { status: 413, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      const messages = sanitizeMessages(parsed && parsed.messages);
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
              temperature: 0.6,
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
