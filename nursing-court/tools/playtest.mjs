// Headless playtest of every screen flow at 380px. Usage:
//   NODE_PATH=<node_modules> node tools/playtest.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.NODE_PATH, "noop.js"));
const { chromium } = require("playwright");
const bank = JSON.parse(readFileSync(path.join(root, "build", "bank.json"), "utf8"));
const byStem = new Map(bank.questions.map((q) => [q.stem, q]));
const shots = path.join(root, "build", "shots");
mkdirSync(shots, { recursive: true });

const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${readFileSync(path.join(root, "dist", "index.html"), "utf8")}</body></html>`;
const testFile = path.join(root, "build", "test.html");
writeFileSync(testFile, page_html);

const problems = [];
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 380, height: 800 }, deviceScaleFactor: 1 });
// Test harness only: a window.storage stand-in that survives reloads in this browser context.
await ctx.addInitScript(() => {
  window.storage = {
    get: async (k) => {
      const v = window.sessionStorage.getItem(k);
      return v ? { key: k, value: v } : null;
    },
    set: async (k, v) => {
      window.sessionStorage.setItem(k, v);
      return { key: k, value: v };
    },
  };
});
const page = await ctx.newPage();
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/ERR_(NAME|INTERNET|CONNECTION|TUNNEL|PROXY|CERT)/.test(m.text())) problems.push("console: " + m.text());
});
await page.goto("file://" + testFile);
await page.waitForSelector("text=Case files");

async function audit(name) {
  const r = await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const small = [...document.querySelectorAll("button, input, [role=tab]")]
      .filter((b) => b.offsetParent !== null && !b.classList.contains("sr-only"))
      .map((b) => ({ h: b.getBoundingClientRect().height, t: (b.innerText || b.getAttribute("aria-label") || b.id || "").slice(0, 30) }))
      .filter((x) => x.h > 0 && x.h < 44);
    return { sw, small };
  });
  if (r.sw > 380) problems.push(`${name}: horizontal overflow ${r.sw}px`);
  if (r.small.length) problems.push(`${name}: small tap targets ${JSON.stringify(r.small.slice(0, 5))}`);
  await page.screenshot({ path: path.join(shots, name + ".png"), fullPage: true });
}

async function currentQuestion() {
  const stem = await page.locator("p.text-lg.font-bold").first().innerText();
  const q = byStem.get(stem.trim());
  if (!q) throw new Error("stem not found in bank: " + stem);
  return q;
}
async function answer(q, { wrong = false } = {}) {
  if (q.type === "mcq") {
    const i = wrong ? (q.answer + 1) % 4 : q.answer;
    await page.locator("button", { hasText: q.options[i] }).first().click();
  } else {
    const typing = await page.locator("#nc-typed").count();
    if (typing) {
      await page.fill("#nc-typed", wrong ? "zzz wrong" : q.answer);
      await page.locator("button", { hasText: "Rest my case" }).click();
    } else {
      if (wrong) {
        const tokens = new Set([q.answer, ...(q.aliases || [])].flatMap((a) => a.toLowerCase().split(/\s+/)));
        const chips = await page.locator("button[data-chip=bank]:not([disabled])").allInnerTexts();
        const bad = chips.findIndex((c) => !tokens.has(c.trim().toLowerCase()));
        await page.locator("button[data-chip=bank]:not([disabled])").nth(Math.max(0, bad)).click();
      } else {
        for (const tok of q.answer.trim().split(/\s+/)) {
          await page.locator("button[data-chip=bank]:not([disabled])", { hasText: tok }).filter({ hasText: new RegExp(`^${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click();
        }
      }
      await page.locator("button", { hasText: "Rest my case" }).click();
    }
  }
  const verdict = await page.locator("text=/SUSTAINED!|OVERRULED!|TIME!/").last().innerText();
  const ok = /SUSTAINED/.test(verdict);
  if (ok === wrong) problems.push(`answer check mismatch on ${q.id} (wanted ${wrong ? "wrong" : "right"}, got ${verdict})`);
}
async function next() {
  await page.locator("button", { hasText: /Next ▶|See the verdict/ }).click();
}

// 1. Lobby
await audit("01-lobby");

// 2. Case file, round 1: 1 wrong, 1 hint, rest right
await page.locator("button", { hasText: "Standards of Nursing" }).click();
await audit("02-case-intro");
await page.locator("button", { hasText: "Start round" }).click();
for (let i = 0; i < 5; i++) {
  const q = await currentQuestion();
  if (i === 0) await audit("03-question-" + q.type);
  if (i === 1) {
    await page.locator("button", { hasText: "Ask for a hint" }).click();
  }
  await answer(q, { wrong: i === 2 });
  if (i === 2) await audit("04-feedback-wrong");
  await next();
}
await page.waitForSelector("text=/correct/");
await audit("05-result");
const resultText = await page.locator("main").innerText();
if (!/Appeal Queue \(1\)/.test(resultText)) problems.push("result: missed item not listed in Appeal Queue");

// 3. Next round all wrong -> Recess after 3 hearts lost
await page.locator("button", { hasText: "Next round" }).click();
let sawRecess = false;
for (let i = 0; i < 5; i++) {
  const q = await currentQuestion();
  await answer(q, { wrong: true });
  await next();
  if (await page.locator("text=Recess!").count()) {
    sawRecess = true;
    await audit("06-recess");
    await page.locator("button", { hasText: "Back to court" }).click();
  }
}
if (!sawRecess) problems.push("recess modal never appeared after losing all hearts");
await page.waitForSelector("text=/correct/");
await page.locator("button", { hasText: "Back to lobby" }).click();

// 4. Checkpoint: start a round, answer one, pause, continue
await page.locator("button", { hasText: "Controlling" }).click();
await page.locator("button", { hasText: "Start round" }).click();
const q1 = await currentQuestion();
await answer(q1);
await next();
await page.locator("button[aria-label^='Pause']").click();
await page.waitForSelector("text=/Continue:/");
await audit("07-lobby-continue");
// reload to prove persistence via window.storage
await page.reload();
await page.waitForSelector("text=/Continue:/", { timeout: 5000 }).catch(() => problems.push("checkpoint did not survive reload"));
await page.locator("button", { hasText: "Continue:" }).click();
const progress = await page.locator("span.tabular-nums").first().innerText();
if (!/^2\/5$/.test(progress.trim())) problems.push("continue resumed at wrong question: " + progress);
await page.locator("button[aria-label^='Pause']").click();

// 5. Appeals
await page.locator("button", { hasText: /^Appeals/ }).click();
await audit("08-appeals");
const due = await page.locator("button", { hasText: "Start appeal hearing" }).count();
if (!due) problems.push("no appeal items due after two rounds");
else {
  await page.locator("button", { hasText: "Start appeal hearing" }).click();
  const qa = await currentQuestion();
  await answer(qa);
  await page.locator("button[aria-label^='Pause']").click();
}

// 6. Evidence Locker
await page.locator("button", { hasText: "Evidence Locker" }).click();
await audit("09-locker");
await page.locator("button", { hasText: "Scope of nursing" }).click();
await audit("10-locker-topic");
await page.fill("#nc-search", "battery");
const hits = await page.locator("li").count();
if (hits < 3) problems.push("locker search for battery returned too few results");
await audit("11-locker-search");
await page.fill("#nc-search", "");
await page.locator("[role=tab]", { hasText: "Source notes" }).click();
await audit("12-source-notes");
await page.locator("button", { hasText: "Lobby" }).click();

// 7. Shop: buy the cheapest paid item
await page.locator("button", { hasText: /^Shop$/ }).click();
await page.locator("button", { hasText: "Long hair" }).click();
const shopMsg = await page.locator("p[aria-live=polite]").innerText();
if (!/Bought and equipped|need/.test(shopMsg)) problems.push("shop message unexpected: " + shopMsg);
await audit("13-shop");
await page.locator("button", { hasText: "Lobby" }).click();

// 8. Settings: typing mode + large text + reduced motion + speed; then typed answers incl. typo
await page.locator("button", { hasText: "Settings" }).click();
for (const id of ["set-type", "set-large", "set-motion", "set-cb"]) await page.locator(`label[for=${id}]`).click();
await audit("14-settings");
await page.locator("button", { hasText: "Lobby" }).click();
await page.locator("button", { hasText: "Legal Responsibilities" }).click();
await page.locator("button", { hasText: "Start round" }).click();
let typedTested = false;
for (let i = 0; i < 5; i++) {
  const q = await currentQuestion();
  if (q.type === "id" && !typedTested && q.answer.length > 6 && !/\d/.test(q.answer)) {
    const typo = q.answer.slice(0, 2) + q.answer.slice(3); // drop one letter
    await page.fill("#nc-typed", typo.toLowerCase());
    await page.locator("button", { hasText: "Rest my case" }).click();
    const t = await page.locator("main").innerText();
    if (!/SUSTAINED/.test(t) || !/Exact spelling/.test(t)) problems.push(`typo tolerance failed for ${q.id}: "${typo}"`);
    typedTested = true;
    await audit("15-typed-typo");
  } else await answer(q);
  await next();
}
await page.waitForSelector("text=/correct/");
await audit("16-result-large");

// 9. Grand Verdict boss mode renders
await page.locator("button", { hasText: "Back to lobby" }).click();
await page.locator("button", { hasText: "Grand Verdict" }).click();
await page.waitForSelector("text=FINAL VERDICT");
await audit("17-grand");

log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "ALL FLOWS PASSED");
await browser.close();
