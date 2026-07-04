# TrueBearing — Deployment Guide

## How the AI backend works

The site calls Claude (Anthropic's AI) for four things: reading the CV, the two
live job-search sweeps, and cover-letter drafting.

- **Inside the Claude.ai preview** this works automatically with no key.
- **On your own hosting** the browser cannot call Anthropic without credentials,
  so you must pick ONE of the two options below.

## Option A — recommended: the included proxy (key stays secret)

No code edits needed — the page auto-detects the proxy at `/api/claude`
and uses it when present.

### One-click cloud deploy
- **Render** (free tier): push this repo to GitHub → render.com → *New +* →
  *Blueprint* → select the repo (it reads `render.yaml`) → paste your
  `ANTHROPIC_API_KEY` when prompted → Apply. Done.
- **Railway**: railway.com → *New Project* → *Deploy from GitHub repo* →
  select the repo (it reads `railway.json`) → add variable
  `ANTHROPIC_API_KEY` → deploy.

### Or run it yourself
```bash
ANTHROPIC_API_KEY=sk-ant-xxxx node server.js
# open http://localhost:3000
```
Works on any Node 18+ host (Fly.io, a VPS, cPanel with Node). The proxy has
a per-IP rate limit (30 AI calls / 10 min) and only forwards the exact
request shape the site uses.

Get your API key at https://console.anthropic.com (Settings → API keys).

## Option B — static hosting only (key is public — personal use only)

If you just want to put the single HTML file on Netlify/Vercel/GitHub Pages
for yourself, open `index.html`, find `API_CONFIG` and set:
```js
apiKey: "sk-ant-xxxx",
```
The file already sends the required `anthropic-dangerous-direct-browser-access`
header in this mode. **Anyone who views your page source can copy the key and
spend your credit — never do this for a public site.**

## Costs

Each full user session ≈ 4 AI calls (1 parse + 2 search sweeps + optional
letters). With web search enabled, expect roughly $0.03–0.08 per session at
current Sonnet pricing. The proxy's rate limit protects you from abuse; lower
the limit in `server.js` if needed.

## What was tested (automated suite, 55 checks, all passing)

- CV input: PDF/DOCX/TXT reading paths, paste fallback, <80-char rejection,
  re-upload after success/failure
- AI parsing: fenced/chatty/truncated JSON responses all handled; profile
  card, skill chips, prefilled roles, step indicators
- Sweep: 2 parallel web-search calls, deduplication of repeat postings,
  best-match sorting, non-text API blocks ignored
- Security: `javascript:`/`data:` URLs from search results are stripped;
  all AI-provided text is HTML-escaped (no injection into the page)
- Filters: match-score slider, employment type, work mode, country,
  district, text search, ghost-risk toggle, sorting (match/title/ghost),
  reset, and the empty state
- Cover-letter modal: open, AI generation, copy, Escape/backdrop close
- Failure modes: 401/403 and network/CORS errors show clear guidance and
  the UI always recovers; missing IntersectionObserver (old browsers)
  degrades gracefully

## Honest production notes

- Results per sweep are ~6–10 live vacancies. For hundreds of results you'd
  add job-board APIs (Adzuna, Jooble, Careerjet) behind the same proxy later.
- AI-found listings should always be verified at the source — the UI already
  says this in the footer.
- No user data is stored anywhere; the CV lives only in the browser session.
