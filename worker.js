// IT Guru Academy – WhatsApp AI Sales Assistant
// Cloudflare Worker + Groq (free) + WhatsApp Cloud API
import KNOWLEDGE from "./knowledge.txt";

const HISTORY_LIMIT = 10; // কাস্টমারের শেষ কতগুলো মেসেজ মনে রাখবে
const HISTORY_TTL = 60 * 60 * 24; // ২৪ ঘণ্টা পর হিস্টোরি মুছে যাবে

const SYSTEM_PROMPT = `তুমি IT Guru Academy-র সেলস অ্যাডভাইজার, একজন বন্ধুসুলভ মানুষের মতো কথা বলো।

নিয়ম:
1. কাস্টমার যে ভাষায় লেখে (বাংলা, English বা মিক্স) সেই ভাষায় উত্তর দাও।
2. উত্তর ছোট রাখো (২-৫ লাইন), WhatsApp-এর মতো সহজ ভাষায়।
3. আগে কাস্টমারের প্রয়োজন বোঝো (প্রয়োজনে একটা প্রশ্ন করো), তারপর সঠিক সার্ভিস/বান্ডেল সাজেস্ট করো।
4. শুধু নিচের "তথ্যভান্ডার" থেকে উত্তর দাও। প্রাইস বা তথ্য সেখানে না থাকলে বানিয়ে বলবে না, বলো "আমি কনফার্ম করে জানাচ্ছি"।
5. যদি কাস্টমার পেমেন্ট, রিফান্ড, অভিযোগ, বা সরাসরি মানুষের সাথে কথা বলতে চায়, অথবা তুমি উত্তর দিতে না পারো, তাহলে বলো যে টিমের একজন শীঘ্রই যোগাযোগ করবেন, আর উত্তরের একদম শেষে আলাদা করে [HANDOFF] লিখো।
6. তুমি যে AI সেটা কেউ সরাসরি জিজ্ঞেস করলে সততার সাথে বলো।
7. কাস্টমারের মেসেজ ভয়েস থেকে লেখায় রূপান্তরিত হতে পারে, তাই বানান বা শব্দে ভুল থাকতে পারে। অর্থ পরিষ্কার না হলে আন্দাজে উত্তর না দিয়ে ভদ্রভাবে আবার জিজ্ঞেস করো।

তথ্যভান্ডার:
${KNOWLEDGE}`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Meta webhook verification (GET)
    if (request.method === "GET") {
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN
      ) {
        return new Response(url.searchParams.get("hub.challenge"));
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") return new Response("Not allowed", { status: 405 });

    const raw = await request.text();

    // Meta-র সিগনেচার যাচাই (APP_SECRET সেট থাকলে)
    if (env.APP_SECRET) {
      const ok = await verifySignature(raw, request.headers.get("x-hub-signature-256"), env.APP_SECRET);
      if (!ok) return new Response("Invalid signature", { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    ctx.waitUntil(processWebhook(body, env));
    return new Response("OK"); // Meta-কে দ্রুত OK জানাতে হবে
  },
};

async function processWebhook(body, env) {
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const msg of change?.value?.messages ?? []) {
        try {
          await handleMessage(msg, env);
        } catch (err) {
          console.error("handleMessage error:", err);
        }
      }
    }
  }
}

async function handleMessage(msg, env) {
  const from = msg.from;

  // একই মেসেজ দুইবার এলে (Meta retry) স্কিপ করো
  const seenKey = `seen:${msg.id}`;
  if (await env.CHAT_KV.get(seenKey)) return;
  await env.CHAT_KV.put(seenKey, "1", { expirationTtl: 3600 });

  let userText;
  if (msg.type === "text") {
    userText = msg.text.body;
  } else if (msg.type === "audio") {
    // ভয়েস মেসেজ → Groq Whisper দিয়ে লেখায় রূপান্তর
    userText = await transcribeVoice(msg.audio.id, env);
    if (!userText) {
      await sendWhatsApp(from, "দুঃখিত, ভয়েসটা ঠিকমতো বুঝতে পারিনি। অনুগ্রহ করে লিখে পাঠাবেন? 🙂", env);
      return;
    }
  } else {
    await sendWhatsApp(from, "আপনার প্রশ্নটা অনুগ্রহ করে লিখে বা ভয়েস মেসেজে পাঠান, আমি সাহায্য করব। 🙂", env);
    return;
  }
  const histKey = `hist:${from}`;
  const history = JSON.parse((await env.CHAT_KV.get(histKey)) || "[]");

  const aiText = await askGroq(history, userText, env);
  const needsHuman = aiText.includes("[HANDOFF]");
  const reply = aiText.replace("[HANDOFF]", "").trim();

  await sendWhatsApp(from, reply, env);

  // হিস্টোরি সেভ
  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: reply });
  const trimmed = history.slice(-HISTORY_LIMIT * 2);
  await env.CHAT_KV.put(histKey, JSON.stringify(trimmed), { expirationTtl: HISTORY_TTL });

  if (needsHuman) {
    await notifyOwner(from, userText, env);
  }
}

async function askGroq(history, userText, env) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    console.error("Groq error:", res.status, await res.text());
    return "দুঃখিত, এই মুহূর্তে একটু সমস্যা হচ্ছে। একটু পরে আবার মেসেজ দিন, অথবা আমাদের টিম শীঘ্রই যোগাযোগ করবে। [HANDOFF]";
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "দুঃখিত, বুঝতে পারিনি। আবার একটু লিখবেন? 🙂";
}

// WhatsApp ভয়েস মেসেজ ডাউনলোড করে Groq Whisper দিয়ে টেক্সটে রূপান্তর
async function transcribeVoice(mediaId, env) {
  try {
    const version = env.GRAPH_API_VERSION || "v23.0";
    const auth = { Authorization: `Bearer ${env.WHATSAPP_TOKEN}` };

    // ১) মিডিয়ার ডাউনলোড URL আনো
    const metaRes = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, { headers: auth });
    if (!metaRes.ok) {
      console.error("Media meta error:", metaRes.status, await metaRes.text());
      return null;
    }
    const meta = await metaRes.json();

    // ২) অডিও ফাইল ডাউনলোড করো
    const fileRes = await fetch(meta.url, { headers: auth });
    if (!fileRes.ok) {
      console.error("Media download error:", fileRes.status);
      return null;
    }
    const audio = await fileRes.arrayBuffer();

    // ৩) Groq Whisper-এ পাঠাও
    const form = new FormData();
    form.append("file", new Blob([audio], { type: meta.mime_type || "audio/ogg" }), "voice.ogg");
    form.append("model", env.WHISPER_MODEL || "whisper-large-v3-turbo");
    form.append("response_format", "json");
    form.append("temperature", "0");
    form.append("prompt", "IT Guru Academy, LinkedIn Automation, WordPress, GitHub, Buffer, Groq, bKash, Nagad, Rocket");
    if (env.WHISPER_LANGUAGE) form.append("language", env.WHISPER_LANGUAGE); // যেমন "bn"; ফাঁকা রাখলে অটো-ডিটেক্ট

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
    if (!res.ok) {
      console.error("Whisper error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.text?.trim() || null;
  } catch (err) {
    console.error("transcribeVoice error:", err);
    return null;
  }
}

async function sendWhatsApp(to, text, env) {
  const version = env.GRAPH_API_VERSION || "v23.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${env.PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) console.error("WhatsApp send error:", res.status, await res.text());
}

// মানুষের হস্তক্ষেপ লাগলে Telegram-এ নোটিফিকেশন (ঐচ্ছিক)
async function notifyOwner(customerNumber, lastMessage, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = `🔔 হ্যান্ডঅফ দরকার\nকাস্টমার: +${customerNumber}\nশেষ মেসেজ: ${lastMessage}`;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

async function verifySignature(rawBody, header, secret) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, header.slice(7));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
