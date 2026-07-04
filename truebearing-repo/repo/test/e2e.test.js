const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ FAIL: " + name); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- mock AI backend ---------- */
const PROFILE_JSON = JSON.stringify({
  name: "Disal Perera", title: ".NET Developer", seniority: "senior", years: 6,
  skills: ["C#", ".NET", "Azure Functions", "Dataverse", "OpenXML", "SQL", "Business Central", "REST APIs", "Git", "Power Platform", "Dynamics 365", "CI/CD"],
  roles: [".NET Developer", "Dynamics 365 BC Consultant", "Azure Developer"],
  country: "Sri Lanka"
});
const JOBS = [
  { t: "Senior .NET Developer", c: "Acme Tech", l: "Colombo", co: "Sri Lanka", ty: "Permanent", mo: "Hybrid", sal: "LKR 400k", u: "https://jobs.acme.lk/123", src: "AcmeCareers", m: 92, why: "Direct C#/.NET Azure match.", gap: [], gr: "low", grw: "fresh posting" },
  { t: "BC Functional Consultant", c: "ERP Partners", l: "Colombo", co: "Sri Lanka", ty: "Contract", mo: "Remote", sal: "", u: "javascript:alert(1)", src: "LinkedIn", m: 85, why: "Matches BC support background.", gap: ["Power BI"], gr: "medium", grw: "no salary listed" },
  { t: "Azure Engineer", c: "CloudCo", l: "Gampaha", co: "Sri Lanka", ty: "Part-time", mo: "On-site", sal: "$40/hr", u: "https://cloudco.com/jobs/9", src: "Indeed", m: 74, why: "Azure Functions overlap.", gap: ["Terraform", "K8s"], gr: "high", grw: "reposted many times" },
  { t: "Junior PHP Dev", c: "WebShack", l: "Kandy", co: "Sri Lanka", ty: "Permanent", mo: "On-site", sal: "", u: "https://webshack.lk/j/2", src: "TopJobs", m: 41, why: "Weak overlap.", gap: ["PHP", "Laravel"], gr: "bogus-value", grw: "" },
  { t: "Senior .NET Developer", c: "Acme Tech", l: "Colombo", co: "Sri Lanka", ty: "Permanent", mo: "Hybrid", sal: "LKR 400k", u: "https://jobs.acme.lk/123", src: "Indeed", m: 90, why: "duplicate posting", gap: [], gr: "low", grw: "" }
];
const JOBS_JSON = JSON.stringify(JOBS);
const LETTER = "Dear [Hiring Manager],\n\nI am excited to apply...\n\nBest regards,\nDisal";

let apiCalls = [];
let failMode = null; // null | 401 | "network"

function mockFetch(url, opts) {
  const body = JSON.parse(opts.body);
  const prompt = body.messages[0].content;
  apiCalls.push({ url, useSearch: !!body.tools, model: body.model, max_tokens: body.max_tokens });
  if (failMode === "network") return Promise.reject(new TypeError("Failed to fetch"));
  if (failMode === 401) return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });

  let content;
  if (prompt.includes("expert recruiter")) {
    content = [{ type: "text", text: "```json\n" + PROFILE_JSON + "\n```" }]; // fenced, tests stripping
  } else if (prompt.includes("job-search agent")) {
    content = [
      { type: "server_tool_use", id: "x", name: "web_search", input: {} },   // non-text blocks must be ignored
      { type: "web_search_tool_result", content: [] },
      { type: "text", text: "Here are the results:\n" + JOBS_JSON }
    ];
  } else {
    content = [{ type: "text", text: LETTER }];
  }
  return Promise.resolve({ ok: true, status: 200, json: async () => ({ content }) });
}

function makeDom({ withIO = true } = {}) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://truebearing.example/",
    beforeParse(window) {
      window.fetch = mockFetch;
      window.HTMLElement.prototype.scrollIntoView = () => {};
      if (!withIO) delete window.IntersectionObserver;
      else if (!window.IntersectionObserver) {
        window.IntersectionObserver = class { constructor(cb){this.cb=cb} observe(el){ this.cb([{isIntersecting:true,target:el}]); } unobserve(){} };
      }
    }
  });
  return dom;
}

const fire = (el, type, win) => el.dispatchEvent(new win.Event(type, { bubbles: true }));

(async () => {

/* ============ SUITE 1: unit tests on pure functions ============ */
console.log("\n[1] Pure function unit tests");
{
  const dom = makeDom();
  await sleep(50);
  const { extractJSON, safeUrl, esc } = dom.window.__tb;

  ok(extractJSON('{"a":1}').a === 1, "extractJSON: clean object");
  ok(extractJSON('```json\n[{"a":1},{"a":2}]\n```').length === 2, "extractJSON: fenced array");
  ok(extractJSON('Sure! Here you go: [{"a":1}] hope that helps').length === 1, "extractJSON: chatty preamble/postamble");
  // truncated array salvage (simulates max_tokens cutoff)
  const truncated = '[{"t":"Dev","c":"A","m":90},{"t":"Eng","c":"B","m":8';
  const salvaged = extractJSON(truncated);
  ok(Array.isArray(salvaged) && salvaged.length === 1 && salvaged[0].t === "Dev", "extractJSON: salvages truncated array");
  let threw = false; try { extractJSON("no json here at all"); } catch (e) { threw = true; }
  ok(threw, "extractJSON: throws on garbage");

  ok(safeUrl("https://ok.com/x") === "https://ok.com/x", "safeUrl: https allowed");
  ok(safeUrl("javascript:alert(1)") === "", "safeUrl: javascript: blocked");
  ok(safeUrl("data:text/html,x") === "", "safeUrl: data: blocked");
  ok(safeUrl("not a url") === "", "safeUrl: garbage blocked");
  ok(esc('<img src=x onerror=a> "quote"') === '&lt;img src=x onerror=a&gt; &quot;quote&quot;', "esc: HTML escaped");
  dom.window.close();
}

/* ============ SUITE 2: page boot & initial state ============ */
console.log("\n[2] Page boot & initial state");
{
  const dom = makeDom();
  await sleep(50);
  const d = dom.window.document;
  ok(d.querySelectorAll(".rv.in").length === d.querySelectorAll(".rv").length, "scroll-reveal: all sections revealed (IO stub)");
  ok(d.getElementById("prefCountry").value === "Sri Lanka", "country select defaults to Sri Lanka");
  ok(d.getElementById("prefDistrict").options.length === 26, "district select has 25 SL districts + Any");
  ok(d.getElementById("parseBtn").disabled === true, "parse button disabled before CV provided");
  ok(d.getElementById("results").classList.contains("show") === false, "results hidden on load");
  dom.window.close();
}

/* ============ SUITE 3: no-IntersectionObserver browser ============ */
console.log("\n[3] Legacy browser (no IntersectionObserver)");
{
  const dom = makeDom({ withIO: false });
  await sleep(50);
  const d = dom.window.document;
  ok(!!dom.window.__tb, "script survives missing IntersectionObserver");
  ok(d.querySelectorAll(".rv.in").length === d.querySelectorAll(".rv").length, "fallback reveals all sections");
  dom.window.close();
}

/* ============ SUITE 4: full user journey ============ */
console.log("\n[4] Full journey: paste CV → parse → prefs → sweep → results");
{
  apiCalls = []; failMode = null;
  const dom = makeDom();
  await sleep(50);
  const w = dom.window, d = w.document;

  // paste CV
  d.getElementById("pasteToggle").click();
  ok(d.getElementById("cvPaste").classList.contains("show"), "paste area toggles open");
  const cv = "Disal Perera. Senior .NET developer with 6 years in C#, Azure Functions, Dataverse, Business Central support. " + "x".repeat(100);
  d.getElementById("cvPaste").value = cv;
  fire(d.getElementById("cvPaste"), "input", w);
  ok(d.getElementById("parseBtn").disabled === false, "parse button enables after paste ≥80 chars");

  // parse
  d.getElementById("parseBtn").click();
  await sleep(80);
  ok(d.getElementById("profileCard").classList.contains("show"), "profile card appears after parse");
  ok(d.getElementById("pName").textContent === "Disal Perera", "profile name rendered");
  ok(d.getElementById("pSkills").children.length === 12, "12 skill chips rendered");
  ok(d.getElementById("prefRoles").value.includes(".NET Developer"), "target roles prefilled from CV");
  ok(d.getElementById("panelPrefs").style.display === "block", "preferences panel revealed");
  ok(d.getElementById("fix1").classList.contains("done") && d.getElementById("fix2").classList.contains("active"), "step indicators advance 1→2");
  ok(apiCalls.length === 1 && apiCalls[0].useSearch === false, "parse used exactly 1 API call, no web search");

  // set some prefs and sweep
  d.querySelector('#typeRow input[value="Contract"]').checked = true;
  d.querySelector('#typeRow input[value="Part-time"]').checked = true;
  d.getElementById("scanBtn").click();
  await sleep(60);
  ok(d.getElementById("scanning").classList.contains("show") || d.getElementById("results").classList.contains("show"), "scanning state engaged");
  await sleep(250);
  ok(d.getElementById("results").classList.contains("show"), "results section shown after sweep");
  ok(apiCalls.length === 3 && apiCalls[1].useSearch && apiCalls[2].useSearch, "sweep ran 2 parallel web-search calls");
  ok(apiCalls.every(c => c.max_tokens === 1000 && c.model === "claude-sonnet-4-6"), "API calls use correct model/max_tokens");

  const cards = d.querySelectorAll(".job-card");
  ok(cards.length === 4, `duplicate posting deduplicated (5 mock + repeat → 4 cards, got ${cards.length})`);
  ok(d.getElementById("jobList").innerHTML.indexOf("javascript:") === -1, "malicious javascript: URL stripped from Apply link");
  const firstScore = cards[0].querySelector(".g-val").textContent;
  ok(firstScore.startsWith("92"), "results sorted by best match first");
  ok(cards[0].querySelector(".gap-ok") !== null, "zero-gap job shows 'meets every requirement'");
  ok(d.querySelector(".badge.ghost-medium") !== null, "invalid ghost value normalised to medium");
  ok(d.getElementById("fTypes").querySelectorAll("input").length === 3, "type filter built from result data (3 unique types)");

  /* ---- filters ---- */
  console.log("\n[5] Filters, sorting, reset");
  d.getElementById("fMatch").value = "80";
  fire(d.getElementById("fMatch"), "input", w);
  ok(d.querySelectorAll(".job-card").length === 2, "min-match 80% filter → 2 cards");
  ok(d.getElementById("fMatchVal").textContent === "80%", "match slider label updates");

  d.getElementById("fMatch").value = "0"; fire(d.getElementById("fMatch"), "input", w);
  const permBox = d.querySelector('.ftype[value="Permanent"]');
  permBox.checked = false; fire(permBox, "change", w);
  ok([...d.querySelectorAll(".job-card .badge.type")].every(b => b.textContent !== "Permanent"), "unchecking Permanent removes permanent jobs");
  permBox.checked = true; fire(permBox, "change", w);

  d.getElementById("fNoGhost").checked = true; fire(d.getElementById("fNoGhost"), "change", w);
  ok(d.querySelectorAll(".badge.ghost-high").length === 0, "hide-high-ghost filter removes high-risk job");
  d.getElementById("fNoGhost").checked = false; fire(d.getElementById("fNoGhost"), "change", w);

  d.getElementById("fDistrict").value = "Gampaha"; fire(d.getElementById("fDistrict"), "change", w);
  ok(d.querySelectorAll(".job-card").length === 1, "district filter → only Gampaha job");
  d.getElementById("fDistrict").value = ""; fire(d.getElementById("fDistrict"), "change", w);

  d.getElementById("fSearch").value = "azure"; fire(d.getElementById("fSearch"), "input", w);
  ok(d.querySelectorAll(".job-card").length >= 1 && [...d.querySelectorAll(".job-title")].some(t => t.textContent.includes("Azure")), "text search finds Azure job");

  d.getElementById("fSort").value = "title"; fire(d.getElementById("fSort"), "change", w);
  d.getElementById("fSearch").value = ""; fire(d.getElementById("fSearch"), "input", w);
  const titles = [...d.querySelectorAll(".job-title")].map(t => t.textContent);
  ok(titles.join() === [...titles].sort((a,b)=>a.localeCompare(b)).join(), "sort by title A–Z works");

  // impossible combo → empty state
  d.getElementById("fMatch").value = "100"; fire(d.getElementById("fMatch"), "input", w);
  ok(d.querySelector(".empty-state") !== null, "empty state shown when filters match nothing");

  d.getElementById("fReset").click();
  ok(d.querySelectorAll(".job-card").length === 4 && d.getElementById("fMatch").value === "0", "reset restores all cards and controls");

  /* ---- cover letter modal ---- */
  console.log("\n[6] Cover letter modal");
  d.querySelector("[data-cl]").click();
  await sleep(80);
  ok(d.getElementById("modalBack").classList.contains("show"), "modal opens");
  ok(d.getElementById("modalBody").textContent.includes("Hiring Manager"), "letter text rendered from AI");
  ok(d.getElementById("modalTitle").textContent.includes("Acme Tech"), "modal title carries job context");
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok(!d.getElementById("modalBack").classList.contains("show"), "Escape key closes modal");

  /* ---- rescan flow ---- */
  d.getElementById("rescanBtn").click();
  ok(!d.getElementById("results").classList.contains("show") && d.getElementById("panelPrefs").style.display === "block", "new sweep returns to preferences");
  dom.window.close();
}

/* ============ SUITE 7: failure modes ============ */
console.log("\n[7] Failure modes");
{
  // 401 auth failure on parse
  apiCalls = []; failMode = 401;
  const dom = makeDom();
  await sleep(50);
  const w = dom.window, d = w.document;
  d.getElementById("pasteToggle").click();
  d.getElementById("cvPaste").value = "Some long enough CV text ".repeat(10);
  fire(d.getElementById("cvPaste"), "input", w);
  d.getElementById("parseBtn").click();
  await sleep(80);
  ok(d.getElementById("parseNote").textContent.includes("DEPLOYMENT"), "401 shows self-hosting guidance instead of generic error");
  ok(d.getElementById("parseBtn").disabled === false, "parse button recovers after failure");

  // network/CORS failure on sweep
  failMode = null;
  d.getElementById("parseBtn").click();
  await sleep(80);
  failMode = "network";
  d.getElementById("scanBtn").click();
  await sleep(300);
  ok(d.getElementById("scanStatus").textContent.includes("DEPLOYMENT"), "network/CORS failure on sweep shows guidance");
  await sleep(2700); // recovery timer
  ok(d.getElementById("panelPrefs").style.display === "block", "UI recovers to preferences after failed sweep");
  dom.window.close();
}

/* ============ SUITE 8: short CV rejected ============ */
console.log("\n[8] Input validation");
{
  const dom = makeDom();
  await sleep(50);
  const w = dom.window, d = w.document;
  d.getElementById("pasteToggle").click();
  d.getElementById("cvPaste").value = "too short";
  fire(d.getElementById("cvPaste"), "input", w);
  ok(d.getElementById("parseBtn").disabled === true, "CV under 80 chars keeps parse disabled");
  dom.window.close();
}

console.log(`\n========================\nRESULT: ${pass} passed, ${fail} failed\n========================`);
process.exit(fail ? 1 : 0);
})();
