# TrueBearing — Deployment Guide

## How the AI backend works

The site calls Claude (Anthropic's AI) for four things: reading the CV, the two
live job-search sweeps, and cover-letter drafting.

- **Inside the Claude.ai preview** this works automatically with no key.
- **On your own hosting** the browser cannot call Anthropic without credentials,
  so you must pick ONE of the two options below.

## Option A — recommended: run the included proxy (key stays secret)

1. Get an API key at https://console.anthropic.com (Settings → API keys).
2. In `truebearing.html`, find `API_CONFIG` near the top of the `<script>` and change:
   ```js
   endpoint: "/api/claude",
   ```
3. Put `truebearing.html` and `server.js` in the same folder, then:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-xxxx node server.js
   ```
4. Open http://localhost:3000

Works the same on any Node host (Railway, Render, Fly.io, a VPS, cPanel with
Node support). The proxy includes a basic per-IP rate limit (30 AI calls /
10 min) and only forwards the exact request shape the site uses.

## Option B — static hosting only (key is public — personal use only)

If you just want to put the single HTML file on Netlify/Vercel/GitHub Pages
for yourself, set in `API_CONFIG`:
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
