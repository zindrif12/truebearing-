# 📡 TrueBearing

**Upload your CV once. Get found on the map.**

TrueBearing is an AI-powered job radar: it reads your CV like a recruiter,
sweeps the live web for currently open vacancies, and plots only the jobs
that truly match you — scored, explained, and ready to apply.

## ✨ Features

- **Whole-web sweep** — live AI search across job boards and company career
  pages, deduplicated into single listings with their original source
- **Explained match score** — every vacancy gets a 0–100 fit score with the
  reason *why*, plus the skills you're missing to raise it
- **Ghost-job detector** — each posting is risk-rated (low / medium / high)
  so you stop wasting effort on jobs that were never real
- **Skill-gap plot** — near-misses become learning directions, not rejections
- **One-click tailored cover letter** — drafted from *your* CV for *that* job
- **Deep filters** — employment type (permanent / contract / part-time /
  hourly / internship), work mode (on-site / hybrid / remote), country →
  district (all 25 Sri Lankan districts + 16 more countries), minimum match
  score, salary, text search, ghost-risk toggle, and sorting
- **CV privacy** — the CV is processed in the browser session only; nothing
  is stored

## 🖥️ Tech

Single-file front end (HTML/CSS/JS, no framework, no build step) with
client-side PDF/DOCX parsing, plus a zero-dependency Node proxy that keeps
your Anthropic API key server-side. AI: Claude with live web search.

## 🚀 Quick start

```bash
# 1. get an API key from https://console.anthropic.com
# 2. run (no code edits needed — the page auto-detects the proxy):
ANTHROPIC_API_KEY=sk-ant-xxxx node server.js
# 3. open http://localhost:3000
```

**One-click cloud deploy:** the repo ships with `render.yaml` (Render
Blueprint) and `railway.json` — connect the GitHub repo, set
`ANTHROPIC_API_KEY`, deploy.

Full hosting options, costs, and security notes: see [DEPLOYMENT.md](DEPLOYMENT.md).

> **Note:** GitHub Pages can host the page itself, but it cannot run
> `server.js` — for a public deployment use a Node host (Railway, Render,
> Fly.io, a VPS) so your API key stays secret.

## ✅ Testing

Shipped with an automated end-to-end suite (55 checks): full user journey,
every filter, JSON-recovery edge cases, URL/HTML injection hardening, and
failure-mode recovery. See `test/e2e.test.js`.

```bash
cd test && npm install && node e2e.test.js
```

## 📄 License

MIT — see [LICENSE](LICENSE).
