// Headless playthrough of every client in practice mode, plus a mobile screenshot.
// Usage: NODE_PATH=$(npm root -g) node tools/playtest.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.NODE_PATH || "/opt/node22/lib/node_modules", "noop.js"));
const { chromium } = require("playwright");
const shots = path.join(root, "build", "shots");
mkdirSync(shots, { recursive: true });
const url = pathToFileURL(path.join(root, "dist", "play.html")).href;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(caseId, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${caseId} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_/.test(m.text())) problems.push(`${caseId} console: ${m.text()}`); });
  await page.goto(url);
  await sleep(400);
  if (opts.titleShot) await page.screenshot({ path: path.join(shots, `title${opts.tag || ""}.png`) });
  const click = async (sel) => { const el = page.locator(sel).first(); await el.click({ timeout: 3000 }); await sleep(60); };
  const act = async (id) => { await page.evaluate((i) => window.__ngt.interact(i), id); await sleep(80); };
  const S = () => page.evaluate(() => { const g = window.__ngt.state(); return g && { grv: g.stomachGrv, asp: g.syrAsp, layers: g.layers.map((l) => [l.t, l.ml]), feedCup: g.feedCup, fed: g.fedFeed, water: g.fedWater, cramp: g.crampState, clamp: g.clampOn, med: g.c.medAt, clock: g.clock, outcome: g.c.outcome, ph: g.c.ph, formula: g.c.cart.find((x) => x.ok && !x.expired).key }; });
  const close = () => click("#modalClose");

  await click(`[data-case=${caseId}]`);
  await click("[data-close]");
  // chart + plan
  await act("chart");
  for (const t of ["record", "mar", "allergy", "policy"]) await click(`[data-chart=${t}]`);
  const c = await page.evaluate(() => { const g = window.__ngt.state().c; return { formula: g.formula, amount: g.amount, freq: g.freq, id: g.id, lactose: g.lactose }; });
  await page.selectOption("#pl_f", c.formula); await page.selectOption("#pl_a", String(c.amount)); await page.selectOption("#pl_q", c.freq);
  await page.selectOption("#pl_t", c.id === "c3" ? "poor" : c.id === "c4" ? "none" : "ok");
  await page.selectOption("#pl_l", c.lactose ? "lf" : "none");
  await click("[data-plan]");
  await close();
  // assess
  await act("patient"); await click("[data-pt=assess]");
  for (const k of ["weight", "mucosa", "turgor", "allergy"]) await click(`[data-as=${k}]`);
  await close();
  // cart
  await act("cart");
  for (const k of ["gloves", "syringe", "ph", "emesis", "measure", "water", "steth", "alcohol"]) await click(`[data-cart=${k}]`);
  const st0 = await S();
  await click(`[data-cart=${st0.formula}]`);
  await click("[data-close]");
  // position, identify, explain
  await act("bedctl"); await click("[data-bedp='45']"); await click("[data-bedp=apply]");
  await act("patient"); await click("[data-pt=identify]"); await click("[data-id=greet]");
  await page.check("input[value=name]"); await page.check("input[value=dob]"); await click("[data-id=verify]");
  await click("[data-pt=explain]"); await click("[data-ex=good]"); await close();
  // hand hygiene
  await act("sink");
  for (const k of ["wet", "soap", "rub"]) await click(`[data-hh=${k}]`);
  await sleep(1800);
  for (const k of ["rinse", "dry", "tap"]) await click(`[data-hh=${k}]`);
  await act("curtain");
  if (opts.wardShot) { await sleep(900); await page.screenshot({ path: path.join(shots, `ward${opts.tag || ""}.png`) }); }
  // bedside
  await act("patient"); await click("[data-pt=bedside]");
  const P = (a) => click(`[data-proc=${a}]`);
  await P("gloves"); await P("plug"); await P("attach"); await P("clamp");
  await P("aspirate"); await sleep(1000);
  if (st0.med != null) { await P("wait"); }
  await P("phtest"); await sleep(1700);
  await click(`[data-dec=phread][data-val='${st0.ph}']`);
  await click(`[data-dec=phint][data-val=${st0.ph <= 5.5 ? "ok" : "hold"}]`);
  if (st0.outcome === "hold_ph") {
    await P("clamp"); await P("attach");
    if ((await S()).asp > 0) { /* sample left in syringe: discard via container */ await P("empty"); }
    await P("plug"); await P("secure");
  } else {
    // aspirate everything
    for (let i = 0; i < 6; i++) { const s = await S(); if (s.grv <= 0) break; if (s.asp >= 59) { await P("clamp"); await P("attach"); await P("empty"); await P("attach"); await P("clamp"); } await P("aspirate"); await sleep(1000); }
    await P("clamp"); await P("attach"); await P("empty");
    await click(`[data-dec=grv][data-val=${st0.outcome === "feed" ? "reinstill" : "hold"}]`);
    await P("attach"); await P("clamp"); await P("reinstill"); await sleep(1300);
    await P("clamp");
    if (st0.outcome === "feed") {
      await P("plunger");
      await P("prep");
      await click("[data-prep=label]");
      const expired = await page.locator(".note.crit").count();
      if (expired) throw new Error(caseId + ": chose a bad formula");
      await click("[data-prep=temp][data-val=room]"); await click("[data-prep=swab]"); await click("[data-prep=pour]");
      await P("pourFeed"); await P("clamp"); // release -> flows
      let shot = false, waterIn = false;
      for (let i = 0; i < 400; i++) {
        await sleep(100);
        const s = await S();
        const total = s.layers.reduce((a, l) => a + l[1], 0);
        if (s.cramp === 1 && !s.clamp) { await P("clamp"); await sleep(2600); await P("clamp"); continue; }
        if (!shot && s.fed > 60 && opts.procShot) { await page.screenshot({ path: path.join(shots, `bedside${opts.tag || ""}.png`) }); shot = true; }
        if (s.feedCup > 0 && total < 25) await P("pourFeed");
        else if (s.feedCup <= 0 && !waterIn && total < 8) { await P("pourWater"); waterIn = true; }
        else if (waterIn && s.layers.length && s.layers[0][0] === "water" && s.layers.length === 1 && total < 9) { await P("clamp"); break; }
      }
    }
    await P("attach"); await P("plug"); await P("secure");
  }
  await close();
  await act("patient"); await click("[data-pt=instruct]"); await click("[data-in=good]");
  await click("[data-pt=evaluate]");
  for (const k of ["tolerance", "bowel", "regurg", "weight", "stool", "turgor", "urine", "glucose"]) await click(`[data-ev=${k}]`);
  await click("[data-ev=finish]"); await close();
  await act("bins");
  for (const [k, v] of [["syr", "y"], ["strip", "y"], ["carton", "b"], ["wrap", "b"]]) await click(`[data-bin=${k}][data-val=${v}]`);
  await click("[data-bin=done]"); await click("[data-bin=gloves]"); await close();
  await act("sink"); await click("[data-hh=rubalc]"); await sleep(1400);
  // documentation
  const fin = await page.evaluate(() => { const g = window.__ngt.state(); return { fed: Math.round(g.fedFeed), water: Math.round(g.fedWater), dur: g.feedStart != null ? Math.round((g.feedEnd || g.clock) - g.feedStart) : 0, kind: g.c.formula, outcome: g.c.outcome }; });
  await act("emr");
  await page.selectOption("#dc_f", fin.fed > 5 ? fin.kind : "none");
  await page.fill("#dc_a", String(fin.fed)); await page.fill("#dc_w", String(fin.water)); await page.fill("#dc_d", String(fin.dur)); await page.fill("#dc_io", String(fin.fed + fin.water));
  await page.selectOption("#dc_r", fin.outcome === "feed" ? "none" : fin.outcome === "hold_grv" ? "grv" : "ph");
  const truths = await page.evaluate(() => [...document.querySelectorAll("input[name=dcs]")].map((i) => i.value));
  for (const k of ["tol", "bs", "soft", "hob", "held", "dist"]) if (truths.includes(k)) {
    const ok = await page.evaluate((key) => { const g = window.__ngt.state(); return true; }, k);
  }
  // check statements that are true for this run
  const trueKeys = fin.outcome === "feed" ? ["tol", "bs", "hob"] : fin.outcome === "hold_grv" ? ["bs", "dist", "hob", "held"] : ["bs", "soft", "hob", "held"];
  for (const k of trueKeys) await page.check(`input[name=dcs][value=${k}]`);
  await click("[data-doc=confirm]"); await click("[data-doc=go]");
  await sleep(500);
  const result = await page.evaluate(() => { const g = window.__ngt.state(); return { total: document.querySelector(".grade .big")?.textContent, label: document.querySelector(".grade .lab")?.textContent, errors: g.errors.map((e) => e.msg), missed: Object.keys(g.items).filter((k) => !g.items[k].ok) }; });
  if (opts.resultShot) await page.screenshot({ path: path.join(shots, `results${opts.tag || ""}.png`), fullPage: true });
  await ctx.close();
  return result;
}

for (const id of ["c1", "c2", "c3", "c4"]) {
  try {
    const r = await run(id, id === "c1" ? { titleShot: true, wardShot: true, procShot: true, resultShot: true } : {});
    console.log(id, r.total, r.label, "errors:", r.errors, "notOk:", r.missed);
  } catch (e) { problems.push(id + " FAILED: " + e.message.split("\n")[0]); }
}
try {
  const r = await run("c2", { viewport: { width: 390, height: 844 }, titleShot: true, wardShot: true, procShot: true, tag: "-mobile" });
  console.log("mobile c2", r.total, r.label);
} catch (e) { problems.push("mobile FAILED: " + e.message.split("\n")[0]); }
await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no problems");
