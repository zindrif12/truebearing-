/*  TrueBearing production server — zero dependencies, Node 18+
    ------------------------------------------------------------
    1) Get an Anthropic API key: https://console.anthropic.com
    2) In index.html, set:  API_CONFIG.endpoint = "/api/claude"
    3) Run:
         ANTHROPIC_API_KEY=sk-ant-xxxx node server.js
    4) Open http://localhost:3000
    The key stays on the server — visitors never see it.            */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY before starting."); process.exit(1); }

/* naive per-IP rate limit: 30 AI calls / 10 min */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 30;
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
        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify(clean)
        });
        const text = await upstream.text();
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(text);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end('{"error":"proxy failure"}');
      }
    });
    return;
  }

  /* ---- static site ---- */
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html" || req.url === "/index.html")) {
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
