# IT Guru Academy – WhatsApp AI Sales Assistant (ফ্রি সেটআপ গাইড)

কাস্টমার WhatsApp-এ তোমার সার্ভিস/বান্ডেল নিয়ে প্রশ্ন করলে AI একজন মানুষের মতো উত্তর দেবে।

**স্ট্যাক:** GitHub (কোড) → Cloudflare Workers (সার্ভার, ফ্রি) → Groq (AI, ফ্রি টিয়ার) → WhatsApp Cloud API (Meta)

```
কাস্টমার ──WhatsApp──▶ Meta ──webhook──▶ Cloudflare Worker ──▶ Groq AI
    ▲                                         │  (knowledge.txt + চ্যাট হিস্টোরি)
    └────────────── WhatsApp API ◀────────────┘
```

## রিপোজিটরির ফাইল

| ফাইল | কাজ |
|---|---|
| `worker.js` | বটের মূল কোড |
| `knowledge.txt` | **তোমার সার্ভিস, প্রাইস, FAQ এখানে লিখবে** (AI এখান থেকে উত্তর দেয়) |
| `wrangler.toml` | Cloudflare কনফিগ (KV ID বসাতে হবে) |
| `.dev.vars.example` | কোন কোন সিক্রেট লাগবে তার তালিকা |
| `.gitignore` | সিক্রেট ফাইল যাতে GitHub-এ না যায় |

---

## আগে যা যা লাগবে

- একটি Facebook অ্যাকাউন্ট (Meta Developer ও Business-এর জন্য)
- একটি ফোন নাম্বার যেটা WhatsApp-এর জন্য ব্যবহার করবে। **টেস্টের জন্য Meta একটা ফ্রি টেস্ট নাম্বার দেয়**, তাই শুরুতে নিজের নাম্বার ছাড়াই টেস্ট করা যাবে। আসল ব্যবহারের নাম্বারটি সাধারণ WhatsApp বা WhatsApp Business অ্যাপে রেজিস্টার্ড থাকলে Cloud API-তে আনার আগে সেটা সরাতে (ডিলিট করতে) হয়।
- একটি GitHub অ্যাকাউন্ট ও একটি Cloudflare অ্যাকাউন্ট (দুটোই ফ্রি)

---

## ধাপ ১: Groq API Key নাও

1. https://console.groq.com এ যাও, সাইন আপ করো।
2. বাম মেনু থেকে **API Keys** → **Create API Key**।
3. Key-টা (`gsk_...` দিয়ে শুরু) কপি করে একটা নিরাপদ জায়গায় রাখো। এটা আবার দেখানো হবে না।

## ধাপ ২: GitHub-এ কোড রাখো

1. https://github.com এ **New repository** → নাম দাও `itguru-whatsapp-bot` → **Private** সিলেক্ট করো → Create।
2. **Add file → Upload files** দিয়ে এই ৫টা ফাইল আপলোড করো (`worker.js`, `wrangler.toml`, `knowledge.txt`, `.gitignore`, `.dev.vars.example`) এবং **Commit changes** করো।

> আসল API key বা টোকেন কখনো GitHub-এ কোডের ভেতরে লিখবে না। সেগুলো পরে Cloudflare-এ আলাদাভাবে দেবে।

## ধাপ ৩: নিজের তথ্য `knowledge.txt`-এ লেখো

GitHub-এ `knowledge.txt` খুলে পেন্সিল আইকনে ক্লিক করে এডিট করো। উদাহরণগুলো মুছে তোমার আসল সার্ভিস, বান্ডেল, প্রাইস, পেমেন্ট পদ্ধতি, রিফান্ড পলিসি ও FAQ লিখো। যত স্পষ্ট লিখবে, AI তত নির্ভুল উত্তর দেবে। এরপর Commit করো।

## ধাপ ৪: Cloudflare-এ KV (মেমরি) বানাও

KV হলো ছোট ফ্রি ডেটাবেস, যেখানে কাস্টমারের আগের কথা মনে রাখা হয়।

1. https://dash.cloudflare.com এ অ্যাকাউন্ট খোলো/লগইন করো।
2. বাম মেনুতে **Storage & Databases → KV** → **Create instance (Create namespace)**।
3. নাম দাও `itguru-chat-kv` → Create।
4. তৈরি হওয়া namespace-এর **ID** কপি করো।
5. GitHub-এ `wrangler.toml` খুলে `YOUR_KV_NAMESPACE_ID` মুছে সেখানে ওই ID বসাও → Commit।

## ধাপ ৫: GitHub থেকে Cloudflare-এ ডিপ্লয় করো

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository** (Connect to Git)।
2. GitHub অ্যাকাউন্ট কানেক্ট করে `itguru-whatsapp-bot` রিপো সিলেক্ট করো।
3. Worker-এর নাম **`itguru-whatsapp-bot`** রাখো (এটা `wrangler.toml`-এর `name`-এর সাথে হুবহু মিলতে হবে)।
4. Build command ফাঁকা রাখো, Deploy command-এ ডিফল্ট `npx wrangler deploy` থাকবে। **Deploy** চাপো।
5. ডিপ্লয় শেষে একটা URL পাবে, যেমন `https://itguru-whatsapp-bot.তোমার-নাম.workers.dev`। এটা কপি করে রাখো (ধাপ ৮-এ লাগবে)।

এখন থেকে GitHub-এ কোড বা `knowledge.txt` বদলে Commit করলেই অটোমেটিক নতুন ভার্সন ডিপ্লয় হবে।

## ধাপ ৬: Meta অ্যাপ বানাও (WhatsApp Cloud API)

1. https://developers.facebook.com এ যাও → **My Apps → Create App**।
2. Use case-এ **Other** → App type **Business** সিলেক্ট করো → অ্যাপের নাম দাও → Create।
3. অ্যাপ ড্যাশবোর্ডে **WhatsApp** প্রোডাক্ট খুঁজে **Set up** চাপো। (Business Portfolio বানাতে বা সিলেক্ট করতে বললে করে নাও।)
4. **WhatsApp → API Setup** পেজে পাবে:
   - একটা **Test phone number** (Meta-র দেওয়া ফ্রি নাম্বার)
   - **Phone number ID** → কপি করো
   - **Temporary access token** (২৪ ঘণ্টা চলে) → কপি করো, টেস্টের জন্য
5. একই পেজে **To** ফিল্ডে **Manage phone number list** থেকে তোমার নিজের WhatsApp নাম্বার যোগ করে ভেরিফাই করো (টেস্ট মেসেজ পাঠানোর জন্য)।
6. **App Settings → Basic** থেকে **App Secret** কপি করো (Show চাপলে দেখা যাবে)। এটা দিয়ে নিশ্চিত হবে যে মেসেজ আসলেই Meta থেকে এসেছে।

## ধাপ ৭: Cloudflare-এ সিক্রেটগুলো বসাও

Cloudflare → **Workers & Pages → itguru-whatsapp-bot → Settings → Variables and Secrets → Add**। প্রতিটার Type অবশ্যই **Secret** সিলেক্ট করবে:

| নাম | মান |
|---|---|
| `VERIFY_TOKEN` | নিজে বানানো যেকোনো গোপন শব্দ, যেমন `ITGuru_x7Kp29_secret` |
| `GROQ_API_KEY` | ধাপ ১-এর Groq key |
| `WHATSAPP_TOKEN` | ধাপ ৬-এর Temporary access token (পরে পার্মানেন্ট টোকেন দিয়ে বদলাবে) |
| `PHONE_NUMBER_ID` | ধাপ ৬-এর Phone number ID |
| `APP_SECRET` | ধাপ ৬-এর App Secret |

Save/Deploy করো।

> Secret ছাড়া সাধারণ Text/Variable হিসেবে বসালে পরের ডিপ্লয়ে সেগুলো মুছে যেতে পারে। তাই সব সিক্রেট Type = **Secret** দিয়ে বসাও।

## ধাপ ৮: Meta-তে Webhook কানেক্ট করো

1. Meta Developer → তোমার অ্যাপ → **WhatsApp → Configuration**।
2. **Webhook** অংশে **Edit** চাপো:
   - **Callback URL:** ধাপ ৫-এর Worker URL
   - **Verify token:** ধাপ ৭-এ দেওয়া `VERIFY_TOKEN` হুবহু
3. **Verify and save** চাপো। সফল হলে সবুজ টিক আসবে। (ব্যর্থ হলে নিচে সমস্যা সমাধান দেখো।)
4. **Webhook fields**-এর তালিকায় **messages** খুঁজে **Subscribe** চাপো। এটা না করলে মেসেজ আসবে না।

## ধাপ ৯: টেস্ট করো

1. তোমার ফোনের WhatsApp থেকে Meta-র টেস্ট নাম্বারে একটা মেসেজ পাঠাও, যেমন "আপনাদের বান্ডেলগুলো কী কী?"
2. কয়েক সেকেন্ডের মধ্যে AI-এর উত্তর আসা উচিত।
3. কিছু না এলে নিচের "সমস্যা সমাধান" দেখো।

## ধাপ ১০: পার্মানেন্ট টোকেন বানাও (জরুরি)

Temporary টোকেন ২৪ ঘণ্টা পর বন্ধ হয়ে যায়, তাই বট চালু রাখতে পার্মানেন্ট টোকেন লাগবে।

1. https://business.facebook.com/settings এ যাও (তোমার Business Portfolio সিলেক্ট করে)।
2. **Users → System users → Add** → নাম দাও (যেমন `itguru-bot`), Role: **Admin** → Create।
3. System user সিলেক্ট করে **Add assets → Apps** থেকে তোমার অ্যাপ সিলেক্ট করে **Full control** দাও।
4. একই ভাবে **WhatsApp accounts** থেকে তোমার WhatsApp Business Account যোগ করে **Full control** দাও।
5. **Generate new token** চাপো → অ্যাপ সিলেক্ট করো → Token expiration: **Never** → permissions-এ `whatsapp_business_messaging` ও `whatsapp_business_management` টিক দাও → Generate।
6. টোকেনটা কপি করে Cloudflare-এ `WHATSAPP_TOKEN` সিক্রেটে বসিয়ে দাও (আগেরটা মুছে নতুন মান দিয়ে)।

## ধাপ ১১: নিজের আসল নাম্বারে লাইভ করো

টেস্ট নাম্বার দিয়ে কাস্টমারদের মেসেজ করানো যাবে না, তাই আসল নাম্বার যোগ করতে হবে:

1. **WhatsApp → API Setup → Add phone number** চাপো। ডিসপ্লে নাম, ক্যাটাগরি দাও, নাম্বার ভেরিফাই করো (SMS বা কল দিয়ে OTP আসবে)।
2. নতুন নাম্বারের **Phone number ID** কপি করে Cloudflare-এ `PHONE_NUMBER_ID` বদলে দাও।
3. অ্যাপ ড্যাশবোর্ডের উপরে **App Mode** টগল **Development → Live** করো (এর জন্য Privacy Policy URL লাগে, তোমার সাইটে একটা পেজ বানিয়ে দিও)।
4. ডিসপ্লে নেমের অনুমোদন ও দরকার হলে Business Verification সম্পূর্ণ করো। Meta-র আবশ্যকতা সময়ে সময়ে বদলায়, তাই ড্যাশবোর্ডের নির্দেশনা অনুসরণ করো।
5. তোমার ওয়েবসাইট, ফেসবুক পেজ বা বিজ্ঞাপনে WhatsApp লিংক দাও: `https://wa.me/৮৮০১XXXXXXXXX` (দেশের কোড সহ, + ছাড়া)।

## ধাপ ১২ (ঐচ্ছিক): মানুষের হস্তক্ষেপ লাগলে Telegram-এ নোটিফিকেশন

পেমেন্ট, রিফান্ড, অভিযোগ বা AI উত্তর দিতে না পারলে বট নিজে থেকে তোমাকে জানাবে।

1. Telegram-এ **@BotFather** কে মেসেজ দাও → `/newbot` → নাম দাও → **Bot Token** পাবে।
2. তোমার নতুন বটকে Telegram-এ একটা মেসেজ পাঠাও (যেমন "hi")।
3. ব্রাউজারে খোলো: `https://api.telegram.org/bot<তোমার-টোকেন>/getUpdates` → রেজাল্টে `"chat":{"id": ...}` সংখ্যাটা তোমার Chat ID।
4. Cloudflare-এ দুটো সিক্রেট যোগ করো: `TELEGRAM_BOT_TOKEN` ও `TELEGRAM_CHAT_ID`।

---

## সমস্যা সমাধান

**Webhook verify হচ্ছে না (403 বা ব্যর্থ):**
- Callback URL ঠিক আছে কি না দেখো (শেষে বাড়তি স্ল্যাশ বা স্পেস নেই)।
- Meta-তে দেওয়া Verify token আর Cloudflare-এর `VERIFY_TOKEN` হুবহু এক কি না মিলিয়ে দেখো।
- সিক্রেট বসানোর পর Worker আবার ডিপ্লয় হয়েছে কি না দেখো।

**মেসেজ পাঠালে কোনো উত্তর আসছে না:**
- Meta Webhook-এ `messages` ফিল্ড Subscribe করা আছে কি না দেখো।
- Cloudflare → Worker → **Logs** (Observability/Real-time logs) এ error দেখো।
- টেস্ট নাম্বারে মেসেজ দিতে চাইলে তোমার নাম্বার "To" তালিকায় ভেরিফাইড কি না দেখো।
- `WHATSAPP_TOKEN` মেয়াদ উত্তীর্ণ হয়েছে কি না (Temporary হলে ২৪ ঘণ্টা পর বন্ধ)।
- সিগনেচার ব্যর্থ হচ্ছে সন্দেহ হলে `APP_SECRET` ঠিক আছে কি না দেখো (অস্থায়ীভাবে মুছে টেস্ট করা যায়)।

**AI "দুঃখিত, সমস্যা হচ্ছে" বলছে:**
- Logs-এ Groq-এর error দেখো। `429` মানে ফ্রি লিমিট শেষ, কিছুক্ষণ পরে ঠিক হবে। `401` মানে API key ভুল।
- Groq মডেলের নাম বদলে গেলে `wrangler.toml`-এর `GROQ_MODEL` আপডেট করো (console.groq.com-এর মডেল তালিকা দেখো)।

**AI ভুল প্রাইস বা ভুল তথ্য দিচ্ছে:**
- `knowledge.txt`-এ সঠিক তথ্য আছে কি না দেখো এবং আরও স্পষ্ট করে লেখো।

## নিয়মিত কাজ

- সার্ভিস/প্রাইস বদলালে শুধু GitHub-এ `knowledge.txt` এডিট করে Commit করো। কয়েক মিনিটের মধ্যে বট নতুন তথ্য জানবে।
- মাঝে মাঝে Groq-এর ফ্রি লিমিট ও Meta-র মেসেজ প্রাইসিং পেজ চেক করো, কারণ এগুলো বদলাতে পারে।
- কাস্টমারের মেসেজের উত্তর দেওয়ার ২৪ ঘণ্টার জানালা পেরিয়ে গেলে নিজে থেকে মেসেজ পাঠাতে অনুমোদিত টেমপ্লেট লাগে। এই বট শুধু কাস্টমারের মেসেজের উত্তর দেয়, তাই সমস্যা নেই।

## সীমাবদ্ধতা

- কাস্টমার একসাথে কয়েকটা মেসেজ পাঠালে বট প্রতিটার আলাদা উত্তর দেয়।
- ছবি, ভয়েস মেসেজ বা ফাইল বুঝতে পারে না। শুধু লেখা বোঝে, বাকিগুলোতে লিখে পাঠাতে বলে।
- AI মাঝে মাঝে ভুল করতে পারে, বিশেষ করে প্রাইস ও পলিসির ক্ষেত্রে। তাই `knowledge.txt` যত নির্ভুল ও বিস্তারিত রাখবে, ঝুঁকি তত কম।
