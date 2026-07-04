/*  TrueBearing production server — zero dependencies, Node 18+
    ------------------------------------------------------------
    Works with EITHER AI provider (set one environment variable):

    FREE  →  GEMINI_API_KEY      get one at https://aistudio.google.com/apikey
                                 (Google account only, no credit card;
                                  free tier limits apply — see DEPLOYMENT.md)
    PAID  →  ANTHROPIC_API_KEY   https://console.anthropic.com

    Run:   GEMINI_API_KEY=xxxx node server.js
    Open:  http://localhost:3000
    The key stays on the server — visitors never see it.            */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const KEY_GEMINI = process.env.GEMINI_API_KEY;
if (!KEY_ANTHROPIC && !KEY_GEMINI) {
  console.error("Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY (paid) before starting.");
  process.exit(1);
}
const PROVIDER = KEY_ANTHROPIC ? "anthropic" : "gemini";
console.log("AI provider:", PROVIDER);

/* naive per-IP rate limit: 30 AI calls / 10 min */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 30;
}

/* ---- provider adapters: both return {status, body} where body matches
        Anthropic's response shape, which the front end expects ---- */

async function callAnthropic(clean) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KEY_ANTHROPIC,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(clean)
  });
  return { status: upstream.status, body: await upstream.text() };
}

async function callGemini(clean) {
  const prompt = clean.messages.map(m => String(m.content)).join("\n\n");
  const gBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 }   /* skip "thinking" to save quota/latency */
    },
    ...(clean.tools ? { tools: [{ google_search: {} }] } : {})
  };
  const upstream = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY_GEMINI },
      body: JSON.stringify(gBody)
    }
  );
  let data = {};
  try { data = await upstream.json(); } catch (e) {}
  if (!upstream.ok) {
    return { status: upstream.status, body: JSON.stringify({ error: (data.error && data.error.message) || "gemini error" }) };
  }
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.map(p => p.text || "").join("");
  /* translate to the Anthropic response shape the front end reads */
  return { status: 200, body: JSON.stringify({ content: [{ type: "text", text }] }) };
}

const server = http.createServer(async (req, res) => {
  /* ---- AI proxy ---- */
  if (req.method === "POST" && req.url === "/api/claude") {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?";
    if (limited(ip)) { res.writeHead(429).end('{"error":"rate limited"}'); return; }

    let body = "";
    req.on("data", c => { body += c; if (body.length > 200000) req.destroy(); });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        /* allow only what the site actually sends */
        const clean = {
          model: "claude-sonnet-4-6",
          max_tokens: Math.min(parsed.max_tokens || 1000, 2000),
          messages: parsed.messages,
          ...(parsed.tools ? { tools: [{ type: "web_search_20250305", name: "web_search" }] } : {})
        };
        const out = PROVIDER === "anthropic" ? await callAnthropic(clean) : await callGemini(clean);
        res.writeHead(out.status, { "Content-Type": "application/json" });
        res.end(out.body);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end('{"error":"proxy failure"}');
      }
    });
    return;
  }

  /* ---- static site ---- */
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) { res.writeHead(500).end("missing index.html"); return; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }
  res.writeHead(404).end("not found");
});

server.listen(PORT, () => console.log(`TrueBearing running → http://localhost:${PORT}`));
