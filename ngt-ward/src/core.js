/* ================= CORE: state, clock, scoring hooks, audio ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmtClock = (m) => { m = Math.round(m); const h = Math.floor(m / 60) % 24, mm = m % 60; return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem("ngtward:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ngtward:" + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};

let G = null; // current run

function newRun(caseData, mode) {
  return {
    c: caseData, mode, // "practice" | "demo"
    clock: START_MIN, waitMin: 0, over: false, stopped: null,
    items: {}, // id -> {ok:boolean, note}
    errors: [], // {cat, pts, msg, why, crit}
    log: [],
    // assessment
    chartSeen: new Set(), planDone: false, planOk: null, nutri: new Set(), allergyAsked: false,
    // planning
    tray: new Set(), formulaKey: null, cartTrips: 0, hob: 10, sideLying: false, curtain: 0, curtainTarget: 0,
    identified: false, explained: false, hhCount: 0, hhBefore: false, gloves: false, glovesEver: false,
    // tube & syringe
    plug: true, clampOn: true, syrOn: false, plunger: true, syrAsp: 0, // gastric mL inside syringe (aspiration mode)
    layers: [], // barrel layers when plunger out [{t:"feed"|"water", ml}]
    stomachGrv: caseData.grv, cupGastric: 0, aspirations: 0,
    phStage: 0, phValue: null, phRead: null, placement: null, // "ok" | "hold"
    grvMeasured: false, grvDecision: null, reinstilled: false, discarded: false,
    // feeding
    prep: { expiry: null, temp: null, swab: false, poured: false },
    feedCup: 0, waterCup: 0, fedFeed: 0, fedWater: 0, height: 0.5, flowing: false,
    feedStart: null, feedEnd: null, airIn: 0, discomfort: 0, crampAt: null, crampState: 0, crampPausedFor: 0,
    plugged: true, secured: false, instructed: false, disposed: false, glovesOff: false, hhAfter: false,
    evals: new Set(), evalWrong: new Set(), docs: null, notified: false,
    hintsUsed: 0,
  };
}

/* ---------- logging & marks ---------- */
function logEv(kind, text) {
  if (!G) return;
  G.log.unshift({ t: G.clock, kind, text });
  renderLog();
}
function mark(id, ok = true, note) {
  if (!G) return;
  const prev = G.items[id];
  if (prev && prev.ok === false && ok) return; // an error on an item sticks
  if (prev && prev.ok && ok) return;
  G.items[id] = { ok, note };
  renderChecklist();
  if (ok) sfx("tick");
}
/* An error. In practice mode the CI explains; in demo a critical error stops the return demonstration. */
function fault(cat, pts, msg, why, crit = false, itemId) {
  if (!G || G.over) return false;
  if (G.errors.some((e) => e.msg === msg)) { if (crit) toast(msg, "crit"); return crit; }
  G.errors.push({ cat, pts, msg, why, crit, at: G.clock });
  if (itemId) mark(itemId, false, msg);
  logEv(crit ? "crit" : "warn", msg);
  sfx(crit ? "crit" : "warn");
  toast(msg, crit ? "crit" : "warn");
  if (crit && G.mode === "demo") {
    G.stopped = { msg, why };
    setTimeout(() => finishCase(), 900);
  } else if (crit) {
    ciInterject(msg, why);
  }
  return crit;
}
function advance(min) { if (G && !G.over) { G.clock += min; updateHud(); } }
function waitClock(min) { if (G) { G.clock += min; G.waitMin += min; updateHud(); } }
const activeMin = () => G.clock - START_MIN - G.waitMin;
const needs = (x) => { const d = typeof x === "string" ? CHECK.find((y) => y.id === x) : x; return !d.when || d.when(G.c); };

/* ---------- Clinical Instructor hint: next expected step ---------- */
function nextHint() {
  if (!G) return "";
  const c = G.c, it = G.items;
  const done = (id) => it[id] && it[id].ok !== undefined;
  if (!G.chartSeen.has("orders")) return "Start at the nurses' station: read the doctor's order in the patient's chart.";
  if (!G.planDone) return "In the chart, review the feeding record and allergies, then confirm your feeding plan.";
  if (G.nutri.size < 3 || !G.allergyAsked) return "Go to the patient. Assess for malnutrition or dehydration and ask about food allergies or milk intolerance.";
  if (!G.tray.has("gloves") || !G.tray.has("syringe") || !G.tray.has("ph") || !G.formulaKey) return "Prepare your equipment at the supply cart. Bring the ordered formula, too.";
  if (G.hob < 30 && !G.sideLying) return "Use the bed controls at the foot of the bed. Raise the head of bed to Fowler's position (30° or higher).";
  if (!G.identified) return "Introduce yourself and verify identity with two identifiers (name and birthday or hospital number).";
  if (!G.explained) return "Explain the procedure: what you will do, why, and that it may feel full but should not hurt.";
  if (!G.hhBefore) return "Perform hand hygiene at the sink before you put on gloves.";
  if (G.curtain < 1) return "Close the privacy curtain. Tube feedings embarrass some clients.";
  if (!G.gloves && !G.glovesOff) return "Open the bedside procedure and apply clean gloves.";
  if (G.placement == null) {
    if (c.medAt != null && G.clock < c.medAt + 60) return `Paracetamol went down the tube at ${fmtClock(c.medAt)}. Wait until ${fmtClock(c.medAt + 60)} before testing pH.`;
    if (G.plug) return "Remove the plug from the tube end.";
    if (!G.syrOn) return "Attach the syringe (with plunger) to the tube.";
    if (G.clampOn) return "Release the clamp so you can aspirate.";
    if (G.syrAsp <= 0 && G.phStage === 0) return "Pull back the plunger to aspirate a sample.";
    if (G.phStage === 0) return "Drop the aspirate onto a pH strip.";
    return "Read the strip against the color chart and decide.";
  }
  if (G.placement === "hold") {
    if (!G.notified) return "Placement is not confirmed. Choose to hold and notify the nurse in charge.";
  } else if (c.outcome !== "hold_ph" && !G.grvMeasured) return "Aspirate all the gastric contents and empty them into the measuring container until nothing more returns.";
  else if (G.grvMeasured && !G.grvDecision) return "Compare the residual with the policy (100 mL, or more than half the last feeding) and decide.";
  else if (G.grvDecision === "hold" && !G.reinstilled) return "Re-instill the measured contents per policy: syringe with plunger attached, clamp open.";
  else if (G.grvDecision === "feed") {
    if (!G.reinstilled && !G.discarded) return "Re-instill the gastric contents per agency policy.";
    if (!G.prep.poured) return "Prepare the formula: check expiry, room temperature, clean the top with alcohol, then pour.";
    if (G.fedFeed < c.amount - 1) {
      if (G.plunger) return "Clamp the tube, then remove the plunger so the syringe becomes a barrel.";
      if (!G.syrOn) return "Connect the barrel to the clamped tube.";
      if (!G.layers.length) return "Pour feeding into the barrel, then release the clamp.";
      if (G.clampOn && G.crampState !== 1) return "Release the clamp and let it flow. Raise or lower the syringe to control the rate.";
      if (G.crampState === 1) return "The client feels cramps. Clamp the tube for a moment, then resume.";
      return "Keep the barrel topped up. Do not let it run dry.";
    }
    if (G.fedWater < 50 && !G.plugged) return "Pour the water flush in before the feeding drains out of the neck of the syringe.";
  }
  if (!G.plugged) return (G.placement === "hold" || G.grvDecision === "hold") ? "Clamp the tube, detach the syringe, and insert the plug." : "Clamp before the last of the water drains, then detach and plug the tube.";
  if (!G.secured) return "Secure the tubing to the client's gown.";
  if (!G.instructed) return "Ask the client to stay upright for at least 30 minutes.";
  if (!G.disposed) return "Dispose of used equipment at the waste bins.";
  if (!G.glovesOff) return "Remove and discard your gloves.";
  if (!G.hhAfter) return "Perform hand hygiene.";
  if (!done("e_eval")) return "Evaluate the client: tolerance, bowel sounds, fullness, weight, elimination, turgor, urine.";
  return "Document at the computer: feeding, water, duration, assessments, I&O, and any report.";
}

/* ---------- audio (WebAudio, synthesized) ---------- */
const AUD = { ctx: null, on: store.get("sound", true), noise: null };
function audioCtx() {
  if (!AUD.on) return null;
  try {
    if (!AUD.ctx) AUD.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (AUD.ctx.state === "suspended") AUD.ctx.resume();
  } catch (e) { return null; }
  return AUD.ctx;
}
function tone(freq, dur, type = "sine", vol = 0.08, when = 0, slide) {
  const ctx = audioCtx(); if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, vol = 0.05, freq = 1200, when = 0) {
  const ctx = audioCtx(); if (!ctx) return;
  if (!AUD.noise) { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AUD.noise = b; }
  const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = AUD.noise; s.loop = true; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(ctx.destination); s.start(t); s.stop(t + dur + 0.05);
}
function sfx(name) {
  switch (name) {
    case "tick": tone(880, 0.09, "triangle", 0.06); tone(1320, 0.12, "triangle", 0.05, 0.07); break;
    case "pick": tone(620, 0.07, "square", 0.03); break;
    case "drop": tone(400, 0.08, "square", 0.03); break;
    case "warn": tone(300, 0.18, "sawtooth", 0.04); break;
    case "crit": tone(220, 0.25, "sawtooth", 0.06); tone(180, 0.3, "sawtooth", 0.05, 0.2); break;
    case "step": tone(140 + Math.random() * 30, 0.04, "triangle", 0.015); break;
    case "water": noiseBurst(1.6, 0.05, 900); break;
    case "pour": noiseBurst(0.6, 0.04, 600); break;
    case "squelch": tone(180, 0.25, "sine", 0.05, 0, 90); break;
    case "gurgle": for (let i = 0; i < 5; i++) tone(90 + Math.random() * 80, 0.12, "sine", 0.07, i * 0.17 + Math.random() * 0.08, 60); break;
    case "click": tone(1200, 0.03, "square", 0.025); break;
    case "curtain": noiseBurst(0.7, 0.03, 2500); break;
    case "motor": tone(70, 0.9, "sawtooth", 0.025, 0, 85); break;
    case "win": [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, "triangle", 0.06, i * 0.11)); break;
    case "beep": tone(1000, 0.06, "sine", 0.02); break;
  }
}
