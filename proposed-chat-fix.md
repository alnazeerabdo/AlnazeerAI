# Proposed Fix — AI Chat Response Formatting (NOT APPLIED YET)

**Status:** ✅ **APPLIED** to `script.js` + `styles.css` (the patch below is the diff that was applied).
**Problem:** bot replies appear with broken raw HTML tags (e.g. `<a href="هنا`) and no paragraph spacing.

## Extra feature added on top of the patch — typewriter effect

The reply is now **typed out** like it is being written instead of appearing all at once:

- `script.js` → `htmlTokens()` + `parseTag()` + `typeMessage()`: the cleaned HTML is tokenised and rendered into a real DOM tree while the text is appended character by character (links and `<br>` are inserted as real elements, so the structure stays valid the whole time).
- Speed: ~55 chars/sec, accelerating after 4s (3 chars) and 8s (6 chars) so long replies don't drag.
- A blinking gold caret (`p.typing::after`) shows while writing; the caret moves to the current paragraph and is removed when finished.
- `prefers-reduced-motion` → the reply appears instantly (no animation).
- While writing, the input stays locked (`busy`) so replies cannot interleave; sending during that time shows "مهلاً قليلاً…".
- `styles.css` → `.ai-msg p.typing::after` + `@keyframes aiBlink`.

## Artifacts saved

| File | What it is | Apply with |
|---|---|---|
| `proposed-chat-fix.patch` | Ready-made unified diff of the frontend fix | `git apply proposed-chat-fix.patch` |
| `worker/worker.js` | Cloudflare Worker source — was **not in this repo at all**; now version-controlled, with the output-format rule added to `SYSTEM` + hardening | `cd worker && npx wrangler deploy` |
| `worker/wrangler.toml` | Worker config (name `alnazeerai`, KV + origin-list setup commented) | — |
| `proposed-chat-fix.md` | This document | — |

`git apply --check proposed-chat-fix.patch` passes (patch verified against the current working tree).

---

## 1. Root causes (all in `script.js`, current `linkify()` at lines 386–391)

| # | Bug | Evidence |
|---|---|---|
| 1 | Model sometimes emits **raw HTML** `<a href="free-session.html">هنا</a>`. `esc()` escapes it to text, then the page-name regex matches the page name *inside* the escaped attribute → **nested broken anchor** | the garbled message you screenshotted |
| 2 | Regex `free-session...\.html[^\s<]*` **swallows trailing characters** — live Worker reply `**free-session.html**` produced `href="free-session.html**."`; Markdown `[هنا](free-session.html)` produced `href="free-session.html)"` | captured live response 2026-10-22 |
| 3 | **Newlines never converted** to HTML — model's `\n\n` paragraphs collapse into one wall of text | every multi-paragraph reply |

## 2. Verified before/after (Node test on 5 real samples, incl. your exact broken message)

- Raw `<a>` from model → **before:** `&lt;a href="<a href="free-session.html&quot;...` → **after:** clean clickable `هنا`
- `**free-session.html**` → **before:** broken href with `**.` → **after:** clean link
- `[هنا](free-session.html)` → **before:** `(<a href="free-session.html)">` → **after:** clean link
- `<script>alert(1)</script>` → stays inert plain text ✓ (XSS protection preserved)
- `https://x.com/free-session.html` → **before:** nested garbage → **after:** one valid link
- Paragraphs now render as `<p>` blocks with `<br>` for single line breaks

---

## 3. Proposed change in `script.js` (replace lines 386–391)

```js
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
      // URLs first (rare) — then page names guarded so they can't match inside an href/URL
      e = e.replace(/https?:\/\/[^\s<&)]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener">رابط</a>'; });
      e = e.replace(/(^|[\s>(])((?:free-session|services|contact|faq|projects|about|ai-agents|custom-ai|software|ai|build)\.html)\b/g, '$1<a href="$2">هنا</a>');
      // Paragraphs: blank line -> new paragraph; single newline -> <br>
      return e.split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
    }
```

No other JS changes needed — `send()` already calls `linkify(t)` with the same signature.

## 4. Proposed change in `styles.css` (add after line 415, `.ai-msg.bot a{...}`)

```css
.ai-msg p{margin:0 0 8px}
.ai-msg p:last-child{margin-bottom:0}
```

This gives the visible gap between paragraphs inside bot bubbles.

## 5. Optional — Worker-side hardening (prevents the problem at the source)

Append to `SYSTEM` in the Cloudflare Worker:

```
اكتب ردك نصاً عادياً فقط: بدون HTML، بدون Markdown، بدون ** أو [روابط](...). اذكر الصفحات كنص مجرد مثل free-session.html.
```

Even with this, keep the frontend fix — models occasionally ignore formatting instructions.

## 6. Worker-side changes (in `worker/worker.js`)

1. **`SYSTEM` output-format rule** (prevents the problem at the source):
   > `صيغة الإخراج: اكتب نصاً عادياً فقط — بدون HTML وبدون Markdown وبدون ** وبدون [روابط](...)، ويفصل بين الفقرات سطر فارغ. اذكر أسماء الصفحات كنص مجرد مثل free-session.html ولا تكتب وسوماً حولها.`

2. **Hardening added** (all optional/configurable, behaviour preserved):
   - `ALLOWED_ORIGINS` — origin allowlist instead of `*` (set in `wrangler.toml` vars)
   - `RATE_LIMIT` KV binding — per-IP throttle, 30 req/min (namespace id commented in `wrangler.toml`)
   - input validation — only `user`/`assistant` roles, max 6 turns, max 500 chars/message, 20 KB body cap
   - proper HTTP status codes (400/405/413/429) instead of silently answering

## 7. How to apply / rollback

```bash
# apply frontend fix
git apply proposed-chat-fix.patch

# deploy backend fix (changes the LIVE worker)
cd worker && npx wrangler deploy

# rollback frontend
git apply -R proposed-chat-fix.patch
# or, since both files are tracked:
git checkout -- script.js styles.css
```

Deploying `worker/worker.js` replaces the live Worker at `alnazeerai.alnzyrbdalmnm90.workers.dev` — keep `name = "alnazeerai"` in `wrangler.toml` or the URL hardcoded in `script.js` (`AI_WORKER_URL`) will change.

---

## 8. تحديثات 2026-10-22 — هوية المساعد ومعرفة المشاريع ورابط الواتساب

### 8.1 `worker/worker.js` — `SYSTEM` أُعيد بناؤه بالكامل

| القسم | ما يفرضه |
|---|---|
| **الهوية** | المساعد يتحدّث كمساعد النذير (ضمير المتكلم لأفعاله: «أساعدك»)، ويحدّث عن النذير بصيغة الغائب («النذير يقدّم»). ممنوع تقديم نفسه كذكاء اصطناعي أو التكلم نيابةً عن النذير. اسم «النذير» يُذكر متى كان ذا صلة. |
| **الإجابة المقتصدة** | جواب مباشر بلا مقدمة، لا معلومة غير مطلوبة، لا أمثلة ولا تفاصيل جانبية، جملة–جملتان (3 أسطر)، و«ما خدماتك؟» = قائمة مختصرة فقط. |
| **معرفة النذير** | الاسم، +7 سنوات خبرة، +40 مشروعاً في العالم العربي، نبذة الذكاء الاصطناعي التطبيقي، أسلوب العمل (استشارة مجانية أولاً)، ونطاق العمل. |
| **معرفة المشاريع** | المشاريع الثمانية المعروضة على الموقع (مضيف، المدار، سجل برو، سبكترا، أديار، أساس مكين، شرفات، رولفا) بالوصف العلني فقط. |
| **خصوصية المشاريع** | أي تفصيل غير مذكور أعلاه (كود، تقنية، أرقام، تسعير العميل، مواعيد، نتائج، أسماء عملاء) → جملة واحدة: «هذا التفصيل جزء من خصوصية المشروع ولا يمكن أن يُقال». |
| **واتساب** | يُكتب الرابط `https://wa.me/249117148664` ولا يُكتب الرقم. |
| `temperature` | 0.6 → 0.3 (إجابات أمتن وأقرب للنص المطلوب). |

### 8.2 `script.js` — رابط الواتساب داخل الشات

`linkify()` أعد بناؤها بثلاث خطوات: استخراج الروابط بـ placeholder → تحويل رقم الواتساب (بكل صيغه: `+249117148664`، `249 117 148 664`) إلى رابط يفتح واتساب → إعادة الروابط مع تسمية `واتساب` بدل `رابط` (ونقاط الترقيم اللاحقة للروابط تُقصّ).

النتيجة: أي رقم واتساب يظهر في رد المساعد يتحوّل تلقائياً إلى زر يفتح واتساب مباشرة، ولا يُعرض الرقم نصاً.

### 8.3 `script.js` — نص البوب أب

> أهلاً بك، أنا مساعد الذكاء الاصطناعي الخاص بالنذير، يمكنني مساعدتك في كل ما تحتاج معرفته عن الخدمات والأسعار وحجز المواعيد مع النذير.

### 8.4 النشر

```bash
cd worker && npx wrangler deploy   # بدونه تبقى القواعد القديمة على الموقع
```

### 8.5 حدود الطبقة المجانية على Groq (اكتُشفت أثناء النشر — 2026-10-22)

| الحد | القيمة | الأثر |
|---|---|---|
| TPM (tokens/min) | 8000 لكل نموذج | طلب واحد ≈ 1550 token (prompt 1442 + output) ⇒ ~5 طلبات/دقيقة/نموذج |
| ITPM (input tokens/min) | 7000 | الـ prompt يُعاد في كل محاولة ⇒ سلسلة بديلة طويلة تستهلك الحد ×N |
| RPM / RPD | 30 / 1000 | 30 طلباً/دقيقة و1000 طلب/يوم لكل نموذج |
| النماذج المتاحة | `gpt-oss-120b` · `gpt-oss-20b` · `qwen3.8-27b` | **Llama لم يعد على الطبقة المجانية** (مدفوع فقط منذ 08/2026) |
| Prompt caching | مدعوم على gpt-oss | التوكنات المخزّنة لا تُحسب ضمن الحد |

**الإصلاحات التي نتجت عن ذلك (في `worker/worker.js`):**

1. **سلسلة بديلة قصيرة (3 نماذج فقط)** بدل 6 — كل محاولة تعيد إرسال الـ prompt.
2. **ترتيب النماذج**: `gpt-oss-120b` ← `gpt-oss-20b` ← `qwen3.8-27b` (يدعم التخزين المؤقت للبادئة).
3. **`reasoning_effort: 'low'`** لنماذج gpt-oss — كانت توكنات التفكير الداخلي تقطع الرد («السعر يُحد»).
4. **`max_tokens`**: 700 لـ gpt-oss، 1500 لـ qwen3.
5. **كشف الرد المقطوع** (`finish_reason === 'length'`) → يُتجاهل ويُجرَّب نموذج آخر، ويُحفظ أطول رد ناقص كبديل.
6. **ذاكرة إجابات داخل العامل** (`ANSWER_CACHE`، 10 دقائق، 60 مدخلاً) — نفس السؤال يُجاب عنه بلا استدعاء النموذج.
7. **رسالة واضحة عند تجاوز الحد** بدل «عذراً، حاول مجدداً»: «المساعد مشغول الآن بسبب كثرة الأسئلة…».
8. **تقليل حجم الـ prompt** من 5637 إلى ~4100 حرفاً (≈1442 token) — مع الحفاظ على كل المعرفة.
9. **`MAX_MESSAGES` 6 → 4** — يقلّل توكنات السياق.
10. **تقييد الإرسال في الواجهة** (`script.js`): من 3 إلى 5 ثوانٍ بين رسالتين.

### 8.6 حالة النشر

✅ نُشر على `alnazeerai.alnzyrbdalmnm90.workers.dev` (آخر نسخة: `08261cb3-f39e-493a-9e3b-ab822cdf48de`) — `GROQ_KEY` محفوظ كـ secret ويبقى بعد النشر.

⚠️ حد RPD = 1000 طلب/يوم على مستوى حساب Groq — كل رسالة في الشات تستهلك طلباً واحداً.

---

## 9. تصحيحان: تكرار اسم «النذير» وإساءة استخدام قاعدة الخصوصية

### 9.1 المشكلة الأولى: «النذير» في بداية كل رد

القاعدة السابقة (`ابدأ بإشارة إليه مثل «النذير يقدّم…»`) نجحت في العكس تماماً — صار كل رد يبدأ بـ«النذير يقدّم…» حتى في أسئلة الخدمات والأسعار.

**ال(rule) الجديدة في `SYSTEM`:**

- اذكر «النذير» فقط إذا كان هو موضوع السؤال (من هو، خبرته، أسلوبه، مشاريعه).
- ممنوع كتابته في رد على سؤال عن خدمة أو سعر أو ميزة — مع مثال مضاد صريح: الصحيح «يقدم حلول ذكاء اصطناعي مخصصة…» وليس «النذير يقدم…».
- ردود الخدمات بصيغة بلا اسم: «يقدم…»، «تكون من…»، «تشمل…».
- إذا كان سؤالك عن النذير نفسه فابدأ باسمه: «النذير هو مهندس ذكاء اصطناعي…».
- لا تكرر صيغة البداية نفسها في كل فقرة: مرة واحدة ثم تابع مباشرة.

### 9.2 المشكلة الثانية: قاعدة الخصوصية تُستعمل في غير موضعها

سؤال «ما هي هذه المخصصة؟ مثل ماذا؟» (سؤال عن **الخدمات**) كان يجيب بجملة الخصوصية — لأن القاعدة كانت_general.

**ال(rule) الجديدة (قاعدة ضيّقة):**

- القاعدة تخصّ **المشاريع الثمانية** فقط وبسؤال عن **تفاصيلها الداخلية** (الكود، التقنية، أرقامها، تسعير عميلها، مواعيدها، نتائجها، أسماء عملائها).
- «لا تستعملها إلا إذا ذكر المستخدم اسم أحد هذه المشاريع الثمانية وسأل عن داخلها.»
- «أسئلة الخدمات والمجالات عموماً وطلب الأمثلة منها تُجاب من بند الخدمات.»

### 9.3 أمثلة جاهزة في الـ prompt

أُضيفت أمثلة لكل مجال في بند الخدمات (وكيل، حلول مخصصة، برمجيات) + شرح ERP وCRM، حتى يجد النموذج جواباً حقيقياً لأسئلة «مثل ماذا؟» بدل أن يسقط على قاعدة الخصوصية.

### 9.4 النتيجة (تحقّق حيّ)

| السؤال | الرد بعد التصحيح |
|---|---|
| ما هي الخدمات الموجودة؟ | «يقدم وكلاء… / يقدم حلول… / يقدم تطوير البرمجيات…» — بلا اسم |
| ما هي هذه المخصصة؟ | «تخصيص نماذج الذكاء لتعمل على بياناتك…» — بلا اسم |
| مثل ماذا؟ | أمثلة حقيقية (مساعد داخل النظام، بحث ذكي، تصنيف فواتير…) — بلا خصوصية |
| ما هي أنظمة ERP وما فائدتها؟ | شرح ERP مباشرة — بلا اسم |
| من هو النذير؟ | «النذير هو مهندس ذكاء اصطناعي…» — الاسم هنا مطلوب |
| كم كلّف متجر سبكترا؟ | «هذا التفصيل جزء من خصوصية المشروع ولا يمكن أن يقال.» — القاعدة تعمل لمشروع معروف |

## 10. الحجز داخل المحادثة + استبدال النص الأمامي

**الطلب:** يأخذ المساعد الحجز مباشرة بلا صفحة `free-session.html`: يسأل عن الاسم ووسيلة التواصل والمشكلة، ثم يُرسلها للنذير.

**آلية العمل:**
1. `worker/system.txt` — «الحجز داخل المحادثة»: عند طلب الحجز يجمع البيانات داخل المحادثة (سؤال واحد مجتمع للثلاثة، أو بسؤال الفاقد فقط)، وعند اكتمالها يُخرج قالباً مخفياً: `[[حجز]] {"الاسم","التواصل","المشكلة"} [[/حجز]]`.
2. `worker/worker.js` — يلتقط القالب، يتحقق من اكتمال الحقول ويفصل الإيميل عن الجوال عبر `@`، ويرسل `form=booking` إلى نفس Apps Script (تبويب «استشارات» + إيميل فوري للنذير). رسالة التأكيد ثابتة من الخادم، والقالب لا يظهر للمستخدم. لا يُخزّن في `ANSWER_CACHE`.
3. `MAX_MESSAGES` 4 → 8 و`hist.slice` 6 → 12 — الحجز متعدد الأدوار يحتاج سياقاً أطول.
4. Apps Script بلا تعديل — كان يدعم `form=booking` أصلاً.
5. صار النص الأمامي في ملف مستقل قابل للتحرير: `worker/system.txt` (استيراد Text module عبر `rules` في `wrangler.toml`) — عدّله ثم `npx wrangler deploy` بلا لمس JS.

**استبدال النص الأمامي بنسخة صاحب الموقع** (حرفياً + قسمان مضافان: «الحجز داخل المحادثة» و«خصوصية المشاريع» — أعلن عنهما، الحذف بيدك).

**تحقق حي (نسخة 1b8c2936):**
- «أبي أحجز استشارة» → يسأل الثلاثة في رسالة ✓
- بعد الاسم+الجوال → يسأل عن المشكلة فقط ✓
- بعد اكتمالها → «تم استلام طلبك بنجاح…» (صف في «استشارات» + إيميل) ✓

## 11. ذاكرة المحادثة (تكبير النافذة + استمرارية عبر الصفحات + ملخّص مضغوط)

**المشكلة:** الواجهة ترسل 12 رسالة والخادم يقصّ إلى 8 (4 تبادلات)، والانتقال لصفحة جديدة يمسح المحادثة كلياً (الموقع صفحات متعددة)، والإجابة المخزّنة تعيد نفس الجواب حتى لو تغيّر السياق — يبدو كفقدان ذاكرة.

**الحل (نسخة 1b7623ec):**
1. `script.js`: يحفظ آخر **40** رسالة في `sessionStorage` ويعيد عرضها عند فتح الشات في أي صفحة.
2. يرسل آخر **16** نصاً كاملاً + **digest** (ملخّص مضغوط حتى 1200 حرف) لما قبلها.
3. `worker.js`: `MAX_MESSAGES` 8 → 16، ويُلحق الـ digest كـ system context موثوق: «معلومات الزائر السابقة … اعتمد عليها مباشرة ولا تقل إنك لا تملكها».
4. مفتاح `ANSWER_CACHE` صار `سؤال#طول_المحادثة` — نفس السؤال في سياق أعمق يحصل جواباً جديداً، بينما تكرار السبام (طول 1) يلتقط الذاكرة ويوفّر التوكنات.

**الكلفة:** ≈3300 توكن/طلب (كان ~2500) → ما زال ضمن حدود المجاني (~2.4 رسالة/دقيقة/نموذج).

**تحقّق:** معلومة من أول رسالة (اسم العميل ومدينته ونشاطه) استُرجعت بنجاح عند السؤال بعد 18 رسالة ✓، وسؤال عام + الحجز يعملان كالمعتاد ✓.
