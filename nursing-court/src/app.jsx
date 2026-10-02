import React, { useState, useEffect, useMemo, useRef } from "react";

/* ============================================================
   NURSING COURT: NCM 119-A courtroom quiz game
   Stage 1: question bank (generated from bank/*.txt)
   ============================================================ */
const BANK = /*__BANK__*/ null;

const QUESTIONS = BANK.questions;
const TOPICS = BANK.topics;
const UNITS = BANK.units;
const Q_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
const UNIT_BY_NUM = Object.fromEntries(UNITS.map((u) => [u.unit, u]));
const UNIT_ORDER = [10, 9, 8, 12, 14, 11].filter((n) => UNIT_BY_NUM[n]);
const QS_BY_UNIT = {};
QUESTIONS.forEach((q) => (QS_BY_UNIT[q.unit] = QS_BY_UNIT[q.unit] || []).push(q));

/* ============================================================
   Stage 2: game engine
   ============================================================ */
const STORAGE_KEY = "nursing-court-v1";
const ROUND_SIZE = 5;
const BOSS_SIZE = 10;
const MAX_HEARTS = 3;
const BREAK_MS = 15 * 60 * 1000;
const SPEED_SECONDS = 30;

const COLORS = {
  ink: "#111827",
  blue: "#2563EB",
  yellow: "#FFD23F",
  green: "#2ED573",
  red: "#E11D48",
  purple: "#7C3AED",
  wood: "#8B5A2B",
  woodDark: "#5C3A1A",
  paper: "#FFFDF5",
};
const FEEDBACK = {
  normal: { right: "#16A34A", wrong: "#E11D48", rightSoft: "#DCFCE7", wrongSoft: "#FFE4E6" },
  cb: { right: "#0072B2", wrong: "#D55E00", rightSoft: "#DBEAFE", wrongSoft: "#FFEDD5" },
};

const SHOP = [
  { id: "skin-1", slot: "skin", name: "Tone 1", cost: 0, color: "#F6D2B0" },
  { id: "skin-2", slot: "skin", name: "Tone 2", cost: 0, color: "#E0AC7E" },
  { id: "skin-3", slot: "skin", name: "Tone 3", cost: 0, color: "#B9814F" },
  { id: "skin-4", slot: "skin", name: "Tone 4", cost: 0, color: "#7A4E2D" },
  { id: "hair-short", slot: "hair", name: "Short hair", cost: 0 },
  { id: "hair-bun", slot: "hair", name: "Neat bun", cost: 0 },
  { id: "hair-long", slot: "hair", name: "Long hair", cost: 60 },
  { id: "hair-curly", slot: "hair", name: "Curly hair", cost: 60 },
  { id: "hair-wig", slot: "hair", name: "Barrister's wig", cost: 150 },
  { id: "hat-none", slot: "hat", name: "No hat", cost: 0 },
  { id: "hat-cap", slot: "hat", name: "Nurse cap", cost: 0 },
  { id: "hat-grad", slot: "hat", name: "Graduation cap", cost: 200 },
  { id: "hat-top", slot: "hat", name: "Top hat", cost: 250 },
  { id: "hat-crown", slot: "hat", name: "Chief Justice crown", cost: 600 },
  { id: "robe-scrubs", slot: "robe", name: "Teal scrubs", cost: 0, color: "#14B8A6" },
  { id: "robe-white", slot: "robe", name: "White coat", cost: 100, color: "#F8FAFC" },
  { id: "robe-black", slot: "robe", name: "Black court robe", cost: 150, color: "#1F2937" },
  { id: "robe-purple", slot: "robe", name: "Royal purple robe", cost: 350, color: "#7C3AED" },
  { id: "robe-gold", slot: "robe", name: "Golden robe", cost: 700, color: "#EAB308" },
  { id: "gavel-wood", slot: "gavel", name: "Wooden gavel", cost: 0, color: "#8B5A2B" },
  { id: "gavel-silver", slot: "gavel", name: "Silver gavel", cost: 150, color: "#9CA3AF" },
  { id: "gavel-gold", slot: "gavel", name: "Gold gavel", cost: 400, color: "#EAB308" },
  { id: "gavel-rainbow", slot: "gavel", name: "Rainbow gavel", cost: 900, color: "rainbow" },
];
const ITEM = Object.fromEntries(SHOP.map((i) => [i.id, i]));
const SLOT_LABEL = { skin: "Skin", hair: "Hair and wigs", hat: "Hats", robe: "Robes", gavel: "Gavels" };

const BADGES = {
  "first-case": { name: "First Case Closed", desc: "Finish your first round." },
  sustained: { name: "Objection Sustained!", desc: "Get a perfect round with no hints." },
  streak10: { name: "On a Roll", desc: "Answer 10 in a row correctly." },
  appeal: { name: "Appeal Granted", desc: "Clear a question from the Appeal Queue." },
  boss: { name: "Final Verdict", desc: "Finish a Final Verdict boss round." },
  grand: { name: "Supreme Court", desc: "Score 8/10 or more in the Grand Verdict." },
  daily: { name: "Daily Docket", desc: "Complete a daily quest." },
  master: { name: "Case Closed", desc: "Earn 3 mastery stars in any case file." },
};

const RANKS = ["Paralegal", "Junior Counsel", "Counsel", "Senior Counsel", "Nurse Attorney", "Chief Justice"];

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

function defaultState() {
  return {
    v: 1,
    coins: 50,
    xp: 0,
    streak: 0,
    bestStreak: 0,
    roundsPlayed: 0,
    seen: {},
    appeal: {},
    unitRounds: {},
    badges: [],
    owned: SHOP.filter((i) => i.cost === 0).map((i) => i.id),
    look: { skin: "skin-2", hair: "hair-bun", hat: "hat-cap", robe: "robe-scrubs", gavel: "gavel-wood" },
    daily: { date: "", wins: 0, claimed: false },
    settings: {
      reducedMotion: prefersReducedMotion(),
      sound: true,
      largeText: false,
      cbSafe: false,
      inputMode: "bank",
      speed: false,
      breaks: true,
    },
    checkpoint: null,
  };
}

function mergeState(saved) {
  const base = defaultState();
  if (!saved || typeof saved !== "object") return base;
  const out = { ...base, ...saved };
  out.settings = { ...base.settings, ...(saved.settings || {}) };
  out.look = { ...base.look, ...(saved.look || {}) };
  out.daily = { ...base.daily, ...(saved.daily || {}) };
  out.owned = Array.from(new Set([...(base.owned || []), ...(saved.owned || [])]));
  if (out.checkpoint && !(out.checkpoint.qids || []).every((id) => Q_BY_ID[id])) out.checkpoint = null;
  return out;
}

// window.storage (artifact storage API) with an in-memory fallback. Never localStorage.
const memoryStore = {};
let saveQueue = Promise.resolve();
async function loadState() {
  try {
    if (window.storage && typeof window.storage.get === "function") {
      const r = await window.storage.get(STORAGE_KEY);
      const raw = r && typeof r === "object" ? r.value : r;
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    /* fall through to memory */
  }
  try {
    return memoryStore[STORAGE_KEY] ? JSON.parse(memoryStore[STORAGE_KEY]) : null;
  } catch (e) {
    return null;
  }
}
async function saveState(state) {
  const raw = JSON.stringify(state);
  memoryStore[STORAGE_KEY] = raw;
  try {
    if (window.storage && typeof window.storage.set === "function") await window.storage.set(STORAGE_KEY, raw);
  } catch (e) {
    /* in-memory copy still holds progress for this session */
  }
}

function todayKey() {
  return new Date().toDateString();
}
function level(xp) {
  return 1 + Math.floor(xp / 250);
}
function rankName(xp) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level(xp) - 1) / 3))];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- answer matching ----------
function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/\brepublic act\b/g, "ra")
    .replace(/\bpresidential decree\b/g, "pd")
    .replace(/\bexecutive order\b/g, "eo")
    .replace(/\barticles?\b/g, "art")
    .replace(/\bsections?\b/g, "sec")
    .replace(/\bseries\b/g, "s")
    .replace(/\bnumber\b/g, "no")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\bno (?=\d)/g, "")
    .trim()
    .replace(/^(the|a|an) /, "");
}
function compact(s) {
  return norm(s).replace(/ /g, "");
}
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function checkId(q, input) {
  const given = compact(input);
  if (!given) return { correct: false };
  const targets = [q.answer, ...(q.aliases || [])];
  if (targets.some((t) => compact(t) === given)) return { correct: true };
  for (const t of targets) {
    const c = compact(t);
    if (/\d/.test(c) || c.length < 5) continue;
    const allowed = c.length > 8 ? 2 : 1;
    if (lev(c, given) <= allowed) return { correct: true, note: `Accepted. Exact spelling: "${q.answer}".` };
  }
  return { correct: false };
}
function idHint(q) {
  const words = q.answer.trim().split(/\s+/);
  if (/^[\d%.\- ]+$/.test(q.answer.trim()) || /^\d/.test(q.answer.trim()))
    return `It starts with "${q.answer.trim()[0]}" · ${words.length} word${words.length > 1 ? "s" : ""}.`;
  return `Starts with "${q.answer.trim()[0].toUpperCase()}" · ${words.length} word${words.length > 1 ? "s" : ""}.`;
}
function mcqEliminated(q) {
  const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
  return wrong[hashStr(q.id) % wrong.length];
}
function wordBank(q) {
  const tokens = q.answer.trim().split(/\s+/);
  const lower = new Set(tokens.map((t) => t.toLowerCase()));
  const target = Math.min(10, Math.max(6, tokens.length + 4));
  const sameTopic = QUESTIONS.filter((o) => o.type === "id" && o.id !== q.id && o.topic === q.topic);
  const sameUnit = QUESTIONS.filter((o) => o.type === "id" && o.id !== q.id && o.unit === q.unit && o.topic !== q.topic);
  const decoys = [];
  for (const src of [shuffle(sameTopic), shuffle(sameUnit)]) {
    for (const o of src) {
      for (const t of o.answer.trim().split(/\s+/)) {
        if (decoys.length + tokens.length >= target) break;
        const k = t.toLowerCase();
        if (!lower.has(k) && !decoys.some((d) => d.toLowerCase() === k)) decoys.push(t);
      }
    }
  }
  return shuffle([...tokens, ...decoys].map((text, i) => ({ key: `${i}-${text}`, text })));
}

// ---------- round building ----------
function questionPool(cfg) {
  if (cfg.topic) return QUESTIONS.filter((q) => q.topic === cfg.topic);
  if (cfg.unit) return QS_BY_UNIT[cfg.unit] || [];
  return QUESTIONS;
}
function priority(state, q) {
  const s = state.seen[q.id];
  if (!s) return 0;
  if (s.w > s.c) return 1;
  return 2 + (s.c - s.w) * 0.1 + (s.last || 0) / 1e6;
}
function buildRound(state, cfg) {
  const size = cfg.size || ROUND_SIZE;
  let picked = [];
  if (cfg.kind === "appeal") {
    const entries = Object.entries(state.appeal);
    const due = entries.filter(([, a]) => a.due <= state.roundsPlayed).map(([id]) => id);
    const rest = entries.filter(([, a]) => a.due > state.roundsPlayed).map(([id]) => id);
    picked = [...shuffle(due), ...(cfg.includeLater ? shuffle(rest) : [])].slice(0, size);
  } else {
    let pool = questionPool(cfg);
    if (cfg.kind === "grand") {
      // spread a Grand Verdict across every case file
      const perUnit = UNIT_ORDER.map((u) => shuffle(QS_BY_UNIT[u]).sort((a, b) => priority(state, a) - priority(state, b)));
      while (picked.length < size && perUnit.some((l) => l.length)) {
        for (const l of perUnit) if (l.length && picked.length < size) picked.push(l.shift().id);
      }
      return shuffle(picked);
    }
    if (cfg.kind === "boss") pool = pool.filter((q) => q.difficulty >= 2).length >= size ? pool.filter((q) => q.difficulty >= 2) : pool;
    const poolIds = new Set(pool.map((q) => q.id));
    const dueAppeals = Object.entries(state.appeal)
      .filter(([id, a]) => poolIds.has(id) && a.due <= state.roundsPlayed)
      .map(([id]) => id);
    picked = shuffle(dueAppeals).slice(0, cfg.kind === "boss" ? 3 : 2);
    const ranked = shuffle(pool.filter((q) => !picked.includes(q.id))).sort((a, b) => priority(state, a) - priority(state, b));
    for (const q of ranked) {
      if (picked.length >= size) break;
      picked.push(q.id);
    }
  }
  return shuffle(picked);
}

function unitMastery(state, unit) {
  const qs = QS_BY_UNIT[unit] || [];
  const mastered = qs.filter((q) => (state.seen[q.id] || {}).c > 0).length;
  const total = qs.length;
  const stars = mastered >= total ? 3 : mastered >= Math.ceil(total * (2 / 3)) ? 2 : mastered >= Math.ceil(total / 3) ? 1 : 0;
  const nextAt = stars >= 3 ? null : [Math.ceil(total / 3), Math.ceil(total * (2 / 3)), total][stars];
  return { mastered, total, stars, toNext: nextAt === null ? 0 : nextAt - mastered };
}

function modeOf(q, kind) {
  if (kind === "boss" || kind === "grand") return "verdict";
  if (q.type === "id") return "stand";
  return q.situational ? "cross" : "objection";
}
const MODE_INFO = {
  objection: { label: "OBJECTION!", speaker: "Opposing counsel", color: COLORS.red, ask: "Choose the response that wins the point." },
  stand: { label: "TAKE THE STAND", speaker: "The judge", color: COLORS.purple, ask: "State your answer." },
  cross: { label: "CROSS-EXAMINATION", speaker: "The witness", color: COLORS.blue, ask: "What is the best answer for this case?" },
  verdict: { label: "FINAL VERDICT", speaker: "The judge", color: "#B45309", ask: "Mixed evidence. Stay sharp." },
};

// ---------- sound ----------
let audioCtx = null;
function beep(kind, enabled) {
  if (!enabled) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === "right" ? [523, 784] : kind === "wrong" ? [220, 175] : kind === "win" ? [523, 659, 784, 1047] : [440];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.13);
    });
  } catch (e) {
    /* audio is optional */
  }
}

/* ============================================================
   Stage 3: art and screens
   ============================================================ */
const STUDS = {
  backgroundColor: COLORS.blue,
  backgroundImage: "radial-gradient(circle at 12px 12px, rgba(255,255,255,0.16) 5px, transparent 6px)",
  backgroundSize: "24px 24px",
};
const CHUNK = { boxShadow: `0 5px 0 ${COLORS.ink}` };
const CHUNK_SM = { boxShadow: `0 3px 0 ${COLORS.ink}` };

const CSS = `
.nc-display{font-family:'Lilita One','Arial Black',Impact,sans-serif;letter-spacing:.02em}
.nc-root{font-family:'Nunito',ui-rounded,system-ui,sans-serif}
.nc-press{transition:transform .08s ease, box-shadow .08s ease}
.nc-press:active{transform:translateY(3px);box-shadow:0 2px 0 #111827 !important}
@keyframes nc-bang{0%{transform:rotate(0)}35%{transform:rotate(-40deg)}65%{transform:rotate(10deg)}100%{transform:rotate(0)}}
@keyframes nc-cheer{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes nc-gasp{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(2px) scaleY(.88)}}
@keyframes nc-pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes nc-rise{0%{transform:translateY(24px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes nc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@keyframes nc-confetti{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(160px) rotate(540deg);opacity:0}}
.nc-gavel{transform-box:fill-box;transform-origin:15% 85%}
.nc-react-right .nc-gavel,.nc-react-wrong .nc-gavel{animation:nc-bang .45s ease-out 2}
.nc-juror{transform-box:fill-box;transform-origin:50% 100%}
.nc-react-right .nc-juror{animation:nc-cheer .32s ease-in-out 3}
.nc-react-right .nc-juror:nth-child(2){animation-delay:.08s}
.nc-react-right .nc-juror:nth-child(3){animation-delay:.16s}
.nc-react-wrong .nc-juror{animation:nc-gasp .5s ease-in-out 2}
.nc-sign{transform-box:fill-box;transform-origin:50% 100%;animation:nc-pop .35s ease-out}
.nc-rise{animation:nc-rise .25s ease-out}
.nc-shake{animation:nc-shake .3s ease-in-out}
.nc-confetti{animation:nc-confetti 1.4s ease-in forwards}
.nc-still *,.nc-still{animation:none !important;transition:none !important}
`;

// ---------- icons ----------
function Heart({ on, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3h4v1h4V3h4v1h1v5h-1v1h-1v1h-1v1h-1v1H9v1H7v-1H6v-1H5v-1H4v-1H3V9H2V8H1V4h1z" fill={on ? "#E11D48" : "#CBD5E1"} stroke={COLORS.ink} strokeWidth="1" />
    </svg>
  );
}
function Coin({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="#FFD23F" stroke={COLORS.ink} strokeWidth="1.5" />
      <rect x="6" y="6" width="6" height="3" rx="0.5" fill={COLORS.woodDark} />
      <rect x="9" y="8.5" width="1.6" height="6" fill={COLORS.woodDark} />
    </svg>
  );
}
function Star({ on, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" fill={on ? "#FFD23F" : "#E5E7EB"} stroke={COLORS.ink} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function Flame({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 1 2 1 3 1-2 2-4 2-7z" fill="#FB923C" stroke={COLORS.ink} strokeWidth="1.3" />
    </svg>
  );
}

// ---------- blocky avatar ----------
function AvatarG({ look, x = 0, y = 0, s = 1 }) {
  const skin = (ITEM[look.skin] || ITEM["skin-2"]).color;
  const robeItem = ITEM[look.robe] || ITEM["robe-scrubs"];
  const robe = robeItem.color;
  const gavelItem = ITEM[look.gavel] || ITEM["gavel-wood"];
  const hairCol = "#3B2416";
  const ink = COLORS.ink;
  const gavelFill = gavelItem.color === "rainbow" ? "url(#nc-rainbow)" : gavelItem.color;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <linearGradient id="nc-rainbow" x1="0" x2="1">
          <stop offset="0" stopColor="#EF4444" />
          <stop offset="0.33" stopColor="#FACC15" />
          <stop offset="0.66" stopColor="#22C55E" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      {/* legs */}
      <rect x="17" y="62" width="12" height="24" fill="#334155" stroke={ink} strokeWidth="1.5" />
      <rect x="31" y="62" width="12" height="24" fill="#334155" stroke={ink} strokeWidth="1.5" />
      {/* torso */}
      <rect x="14" y="36" width="32" height="28" fill={robe} stroke={ink} strokeWidth="1.5" />
      {look.robe === "robe-scrubs" && <path d="M24 36 L30 44 L36 36" fill="none" stroke={ink} strokeWidth="1.5" />}
      {look.robe === "robe-white" && <rect x="28" y="36" width="4" height="28" fill="#CBD5E1" />}
      {(look.robe === "robe-black" || look.robe === "robe-purple" || look.robe === "robe-gold") && (
        <rect x="24" y="36" width="12" height="7" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      )}
      {/* arms */}
      <rect x="4" y="37" width="10" height="22" fill={robe} stroke={ink} strokeWidth="1.5" />
      <rect x="46" y="37" width="10" height="22" fill={robe} stroke={ink} strokeWidth="1.5" />
      <rect x="4" y="58" width="10" height="7" fill={skin} stroke={ink} strokeWidth="1.5" />
      <rect x="46" y="58" width="10" height="7" fill={skin} stroke={ink} strokeWidth="1.5" />
      {/* gavel in right hand */}
      <g>
        <rect x="49" y="46" width="4" height="18" fill={COLORS.woodDark} stroke={ink} strokeWidth="1" />
        <rect x="43" y="40" width="16" height="8" rx="1.5" fill={gavelFill} stroke={ink} strokeWidth="1.5" />
      </g>
      {/* hair behind head */}
      {look.hair === "hair-long" && <rect x="13" y="10" width="34" height="34" fill={hairCol} stroke={ink} strokeWidth="1.5" />}
      {/* head */}
      <rect x="16" y="8" width="28" height="28" rx="4" fill={skin} stroke={ink} strokeWidth="1.5" />
      <rect x="23" y="18" width="4" height="6" fill={ink} />
      <rect x="33" y="18" width="4" height="6" fill={ink} />
      <path d="M24 28 Q30 33 36 28" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
      {/* hair on top */}
      {look.hair === "hair-short" && <rect x="15" y="6" width="30" height="8" rx="2" fill={hairCol} stroke={ink} strokeWidth="1.5" />}
      {look.hair === "hair-bun" && (
        <g>
          <rect x="15" y="6" width="30" height="8" rx="2" fill={hairCol} stroke={ink} strokeWidth="1.5" />
          <rect x="24" y="0" width="12" height="7" rx="3" fill={hairCol} stroke={ink} strokeWidth="1.5" />
        </g>
      )}
      {look.hair === "hair-long" && <rect x="15" y="6" width="30" height="8" rx="2" fill={hairCol} stroke={ink} strokeWidth="1.5" />}
      {look.hair === "hair-curly" && (
        <g fill={hairCol} stroke={ink} strokeWidth="1.2">
          {[16, 23, 30, 37, 44].map((cx) => (
            <circle key={cx} cx={cx} cy="8" r="4.5" />
          ))}
        </g>
      )}
      {look.hair === "hair-wig" && (
        <g fill="#F1F5F9" stroke={ink} strokeWidth="1.2">
          <rect x="14" y="4" width="32" height="9" rx="3" />
          {[10, 17, 24, 31].map((cy) => (
            <g key={cy}>
              <rect x="10" y={cy} width="7" height="7" rx="3" />
              <rect x="43" y={cy} width="7" height="7" rx="3" />
            </g>
          ))}
        </g>
      )}
      {/* hats */}
      {look.hat === "hat-cap" && (
        <g>
          <path d="M18 7 L22 -1 L38 -1 L42 7 Z" fill="#FFFFFF" stroke={ink} strokeWidth="1.5" />
          <rect x="28.5" y="0.5" width="3" height="5" fill="#E11D48" />
          <rect x="27.5" y="1.5" width="5" height="3" fill="#E11D48" />
        </g>
      )}
      {look.hat === "hat-grad" && (
        <g>
          <rect x="20" y="0" width="20" height="7" fill="#111827" stroke={ink} strokeWidth="1" />
          <path d="M12 0 L30 -6 L48 0 L30 5 Z" fill="#1F2937" stroke={ink} strokeWidth="1.2" />
          <path d="M44 1 L46 10" stroke="#FFD23F" strokeWidth="1.6" />
        </g>
      )}
      {look.hat === "hat-top" && (
        <g>
          <rect x="13" y="4" width="34" height="4" fill="#111827" stroke={ink} strokeWidth="1" />
          <rect x="19" y="-14" width="22" height="19" fill="#111827" stroke={ink} strokeWidth="1" />
          <rect x="19" y="0" width="22" height="3" fill="#E11D48" />
        </g>
      )}
      {look.hat === "hat-crown" && (
        <path d="M16 7 L16 -5 L22 1 L30 -8 L38 1 L44 -5 L44 7 Z" fill="#FACC15" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </g>
  );
}
function Avatar({ look, size = 96 }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="-2 -16 64 106" role="img" aria-label="Your blocky nurse attorney avatar">
      <AvatarG look={look} />
    </svg>
  );
}

// ---------- courtroom scene ----------
function NPCHead({ x, y, skin, hair, w = 18 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={w} rx="2" fill={skin} stroke={COLORS.ink} strokeWidth="1.3" />
      <rect x={x - 1} y={y - 2} width={w + 2} height="6" rx="1.5" fill={hair} stroke={COLORS.ink} strokeWidth="1.2" />
      <rect x={x + w * 0.27} y={y + w * 0.4} width="2.5" height="3.5" fill={COLORS.ink} />
      <rect x={x + w * 0.6} y={y + w * 0.4} width="2.5" height="3.5" fill={COLORS.ink} />
    </g>
  );
}
function Courtroom({ reaction, mode, look, still }) {
  const sign =
    reaction === "right"
      ? { text: "SUSTAINED!", fill: "#16A34A" }
      : reaction === "wrong"
      ? { text: "OVERRULED!", fill: "#E11D48" }
      : mode === "objection"
      ? { text: "OBJECTION!", fill: "#E11D48" }
      : null;
  return (
    <div className={`${still ? "nc-still" : ""} nc-react-${reaction || "idle"}`}>
      <svg viewBox="0 0 360 150" className="w-full block" role="img" aria-label="Courtroom: judge at the bench, jury on the right, you at counsel table">
        <defs>
          <pattern id="nc-panel" width="40" height="22" patternUnits="userSpaceOnUse">
            <rect width="40" height="22" fill="#E8D3A8" />
            <rect y="20" width="40" height="2" fill="#C9A86E" />
            <rect x="38" width="2" height="22" fill="#D7BC87" />
          </pattern>
        </defs>
        <rect width="360" height="150" fill="url(#nc-panel)" />
        <rect y="118" width="360" height="32" fill={COLORS.wood} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <rect key={i} x={i * 40 + 4} y="122" width="32" height="4" rx="2" fill="#A0703F" />
        ))}
        {/* judge */}
        <NPCHead x={166} y={18} skin="#E0AC7E" hair="#F1F5F9" w={28} />
        <rect x="160" y="44" width="40" height="16" fill="#1F2937" stroke={COLORS.ink} strokeWidth="1.3" />
        {/* bench */}
        <rect x="118" y="56" width="124" height="62" fill={COLORS.wood} stroke={COLORS.ink} strokeWidth="2" />
        <rect x="112" y="52" width="136" height="9" fill={COLORS.woodDark} stroke={COLORS.ink} strokeWidth="2" />
        <circle cx="180" cy="88" r="15" fill="#FFD23F" stroke={COLORS.ink} strokeWidth="2" />
        <path d="M172 92 h16 M180 79 v13 M174 82 l12 0" stroke={COLORS.ink} strokeWidth="2" />
        {/* judge's gavel */}
        <g className="nc-gavel">
          <rect x="214" y="30" width="4" height="22" fill={COLORS.woodDark} stroke={COLORS.ink} strokeWidth="1" />
          <rect x="206" y="24" width="20" height="10" rx="2" fill="#A0703F" stroke={COLORS.ink} strokeWidth="1.5" />
        </g>
        {/* witness stand (cross-examination) */}
        {mode === "cross" && (
          <g>
            <NPCHead x={90} y={58} skin="#F6D2B0" hair="#111827" />
            <rect x="86" y="76" width="26" height="14" fill="#2563EB" stroke={COLORS.ink} strokeWidth="1.2" />
            <rect x="80" y="84" width="38" height="34" fill={COLORS.woodDark} stroke={COLORS.ink} strokeWidth="2" />
          </g>
        )}
        {/* jury box */}
        <g>
          <g>
            <g className="nc-juror">
              <NPCHead x={272} y={64} skin="#B9814F" hair="#111827" />
              <rect x="270" y="82" width="22" height="12" fill="#F97316" stroke={COLORS.ink} strokeWidth="1.2" />
            </g>
            <g className="nc-juror">
              <NPCHead x={298} y={60} skin="#F6D2B0" hair="#92400E" />
              <rect x="296" y="78" width="22" height="16" fill="#22C55E" stroke={COLORS.ink} strokeWidth="1.2" />
            </g>
            <g className="nc-juror">
              <NPCHead x={324} y={64} skin="#7A4E2D" hair="#4B5563" />
              <rect x="322" y="82" width="22" height="12" fill="#A855F7" stroke={COLORS.ink} strokeWidth="1.2" />
            </g>
          </g>
          <rect x="262" y="92" width="92" height="26" fill={COLORS.woodDark} stroke={COLORS.ink} strokeWidth="2" />
        </g>
        {/* player at counsel table */}
        <AvatarG look={look} x={14} y={46} s={0.78} />
        <rect x="6" y="100" width="62" height="18" fill={COLORS.woodDark} stroke={COLORS.ink} strokeWidth="2" />
        {/* bailiff sign */}
        {sign && (
          <g key={sign.text + reaction} className="nc-sign">
            <rect x="248" y="6" width="104" height="30" rx="4" fill={sign.fill} stroke={COLORS.ink} strokeWidth="2.5" />
            <text x="300" y="27" textAnchor="middle" fontFamily="'Lilita One','Arial Black',sans-serif" fontSize="16" fill="#FFFFFF">
              {sign.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------- UI building blocks ----------
function Btn({ children, onClick, color = "yellow", className = "", disabled, ariaLabel, small }) {
  const bg = { yellow: COLORS.yellow, green: COLORS.green, blue: COLORS.blue, red: COLORS.red, purple: COLORS.purple, white: "#FFFFFF", ink: COLORS.ink }[color] || color;
  const fg = ["blue", "red", "purple", "ink"].includes(color) ? "#FFFFFF" : COLORS.ink;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`nc-press nc-display rounded-xl border-4 border-gray-900 ${small ? "px-3 py-2 text-base" : "px-4 py-3 text-lg"} min-h-12 focus:outline-none focus-visible:ring-4 focus-visible:ring-white disabled:opacity-50 ${className}`}
      style={{ background: bg, color: fg, ...(small ? CHUNK_SM : CHUNK) }}
    >
      {children}
    </button>
  );
}
function Card({ children, className = "", style }) {
  return (
    <div className={`bg-white rounded-2xl border-4 border-gray-900 ${className}`} style={{ ...CHUNK, ...style }}>
      {children}
    </div>
  );
}
function TopBar({ title, onBack, right }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Btn small color="white" onClick={onBack} ariaLabel="Back to lobby">
        ◀ Lobby
      </Btn>
      <h1 className="nc-display text-2xl text-white flex-1 min-w-0 truncate" style={{ textShadow: `2px 2px 0 ${COLORS.ink}` }}>
        {title}
      </h1>
      {right}
    </div>
  );
}
function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1 bg-white rounded-lg border-2 border-gray-900 px-2 py-1" aria-label={label}>
      {icon}
      <span className="font-extrabold tabular-nums text-gray-900">{value}</span>
    </div>
  );
}
function Toggle({ id, label, desc, value, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 py-3 border-b-2 border-gray-200 last:border-b-0 cursor-pointer min-h-12">
      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-gray-900">{label}</span>
        {desc && <span className="block text-sm text-gray-600">{desc}</span>}
      </span>
      <input id={id} type="checkbox" className="sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative inline-block w-14 h-8 rounded-full border-4 border-gray-900 shrink-0"
        style={{ background: value ? COLORS.green : "#CBD5E1" }}
      >
        <span className="absolute w-5 h-5 bg-white rounded-full border-2 border-gray-900" style={{ top: 2, left: value ? 26 : 2, transition: "left .15s" }} />
      </span>
    </label>
  );
}
function Modal({ children, label }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(17,24,39,0.6)" }} role="dialog" aria-modal="true" aria-label={label}>
      <div className="w-full max-w-md nc-rise">{children}</div>
    </div>
  );
}
function Stars({ n, size = 28 }) {
  return (
    <div className="flex gap-1" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} on={i < n} size={size} />
      ))}
    </div>
  );
}
function ProgressBar({ value, max, color = COLORS.green }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-4 w-full rounded-full border-2 border-gray-900 bg-white overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full" style={{ width: `${pct}%`, background: color, transition: "width .3s" }} />
    </div>
  );
}

// ---------- Lobby ----------
function Lobby({ S, go, startRound, claimDaily }) {
  const appealDue = Object.values(S.appeal).filter((a) => a.due <= S.roundsPlayed).length;
  const appealTotal = Object.keys(S.appeal).length;
  const cp = S.checkpoint;
  const lvl = level(S.xp);
  const xpInto = S.xp % 250;
  const dailyToday = S.daily.date === todayKey() ? S.daily : { wins: 0, claimed: false };
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <div className="bg-white rounded-2xl border-4 border-gray-900 p-1 shrink-0" style={CHUNK}>
          <Avatar look={S.look} size={72} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="nc-display text-3xl text-white leading-none" style={{ textShadow: `3px 3px 0 ${COLORS.ink}` }}>
            Nursing Court
          </h1>
          <p className="text-white font-bold text-sm mt-1">
            Lv {lvl} {rankName(S.xp)}
          </p>
          <div className="mt-1">
            <ProgressBar value={xpInto} max={250} color={COLORS.yellow} />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Stat icon={<Coin />} value={S.coins} label={`${S.coins} Gavel Coins`} />
            <Stat icon={<Flame />} value={S.streak} label={`Answer streak ${S.streak}`} />
          </div>
        </div>
      </header>

      {cp && (
        <Btn color="green" onClick={() => go({ name: "play" })} className="w-full text-xl">
          ▶ Continue: {cp.title} ({Math.min(cp.idx + 1, cp.qids.length)}/{cp.qids.length})
        </Btn>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Daily quest</p>
            <p className="font-extrabold text-gray-900">Win 3 rounds today (3+ correct out of 5)</p>
          </div>
          {dailyToday.claimed ? (
            <span className="font-extrabold text-green-700">Done</span>
          ) : dailyToday.wins >= 3 ? (
            <Btn small color="green" onClick={claimDaily}>
              Claim 100
            </Btn>
          ) : (
            <span className="nc-display text-xl tabular-nums">{dailyToday.wins}/3</span>
          )}
        </div>
      </Card>

      <section aria-label="Case files" className="flex flex-col gap-3">
        <h2 className="nc-display text-2xl text-white" style={{ textShadow: `2px 2px 0 ${COLORS.ink}` }}>
          Case files
        </h2>
        {UNIT_ORDER.map((u, i) => {
          const unit = UNIT_BY_NUM[u];
          const m = unitMastery(S, u);
          return (
            <button
              key={u}
              type="button"
              onClick={() => go({ name: "case", unit: u })}
              className="nc-press text-left bg-white rounded-2xl border-4 border-gray-900 p-3 flex items-center gap-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 min-h-12"
              style={CHUNK}
            >
              <span className="nc-display text-2xl w-14 h-14 shrink-0 rounded-xl border-4 border-gray-900 flex items-center justify-center" style={{ background: [COLORS.yellow, COLORS.green, "#FB923C", "#60A5FA", "#F472B6", "#A78BFA"][i % 6] }}>
                {u}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-extrabold text-gray-900 leading-tight">{unit.title}</span>
                <span className="block text-sm text-gray-600 truncate">{unit.tagline}</span>
                <span className="flex items-center gap-2 mt-1">
                  <Stars n={m.stars} size={18} />
                  <span className="text-xs font-bold text-gray-600 tabular-nums">
                    {m.mastered}/{m.total}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Btn color="red" onClick={() => go({ name: "appeal" })}>
          Appeals {appealTotal > 0 ? `(${appealDue}/${appealTotal})` : ""}
        </Btn>
        <Btn color="purple" onClick={() => go({ name: "locker" })}>
          Evidence Locker
        </Btn>
        <Btn color="yellow" onClick={() => go({ name: "shop" })}>
          Shop
        </Btn>
        <Btn color="white" onClick={() => go({ name: "settings" })}>
          Settings
        </Btn>
      </div>
      <Btn color="ink" className="w-full" onClick={() => startRound({ kind: "grand", size: BOSS_SIZE, title: "Grand Verdict (all units)" })}>
        Grand Verdict: 10 mixed questions, all units
      </Btn>
      {S.badges.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-2">Badges</p>
          <div className="flex flex-wrap gap-2">
            {S.badges.map((b) => (
              <span key={b} className="text-sm font-extrabold px-2 py-1 rounded-lg border-2 border-gray-900" style={{ background: COLORS.yellow }} title={BADGES[b] && BADGES[b].desc}>
                {BADGES[b] ? BADGES[b].name : b}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------- Case file intro ----------
function CaseIntro({ S, unit, go, startRound }) {
  const u = UNIT_BY_NUM[unit];
  const m = unitMastery(S, unit);
  const topics = TOPICS.filter((t) => t.unit === unit);
  const rounds = S.unitRounds[unit] || 0;
  const qs = QS_BY_UNIT[unit];
  return (
    <div className="flex flex-col gap-4">
      <TopBar title={`Case File ${unit}`} onBack={() => go({ name: "lobby" })} />
      <Card className="p-4">
        <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500">Unit {unit}</p>
        <h2 className="nc-display text-2xl text-gray-900">{u.title}</h2>
        <p className="text-gray-700 mt-1">
          {u.tagline}. {topics.length} topics, {qs.length} questions.
        </p>
        {u.note && (
          <p className="mt-3 text-sm font-bold rounded-lg border-2 border-gray-900 p-2" style={{ background: "#FEF3C7" }}>
            ⚠ {u.note}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3">
          <Stars n={m.stars} />
          <span className="text-sm font-bold text-gray-700">
            {m.stars >= 3 ? "Case closed. Every question answered correctly at least once." : `Next star in ${m.toNext} new correct answer${m.toNext === 1 ? "" : "s"}.`}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar value={m.mastered} max={m.total} />
        </div>
      </Card>
      <Btn color="green" className="w-full text-xl" onClick={() => startRound({ kind: "unit", unit, title: `Unit ${unit} · Round ${rounds + 1}` })}>
        Start round (5 questions)
      </Btn>
      <Btn color="ink" className="w-full" onClick={() => startRound({ kind: "boss", unit, size: BOSS_SIZE, title: `Unit ${unit} · Final Verdict` })}>
        Final Verdict boss (10 questions, double coins)
      </Btn>
      {rounds < 3 && <p className="text-white font-bold text-sm text-center">Tip: play about 3 rounds before the boss. It is open any time.</p>}
      <Card className="p-4">
        <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-2">Practice one topic</p>
        <div className="flex flex-col gap-2">
          {topics.map((t) => {
            const tq = QUESTIONS.filter((q) => q.topic === t.id);
            const done = tq.filter((q) => (S.seen[q.id] || {}).c > 0).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => startRound({ kind: "topic", unit, topic: t.id, title: t.title })}
                className="text-left rounded-xl border-2 border-gray-900 px-3 py-2 min-h-12 flex items-center gap-2 hover:bg-yellow-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
              >
                <span className="flex-1 min-w-0 font-bold text-gray-900">{t.title}</span>
                <span className="text-xs font-extrabold tabular-nums text-gray-600">
                  {done}/{tq.length}
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ---------- Question screen ----------
function IdAnswer({ q, mode, disabled, onSubmit, onToggleMode, eliminatedHint }) {
  const [built, setBuilt] = useState([]);
  const [typed, setTyped] = useState("");
  const chips = useMemo(() => wordBank(q), [q.id]);
  useEffect(() => {
    setBuilt([]);
    setTyped("");
  }, [q.id]);
  const usedKeys = new Set(built.map((b) => b.key));
  const answerText = mode === "bank" ? built.map((b) => b.text).join(" ") : typed;
  return (
    <div className="flex flex-col gap-3">
      {mode === "bank" ? (
        <>
          <div className="min-h-14 rounded-xl border-4 border-dashed border-gray-900 bg-yellow-50 p-2 flex flex-wrap gap-2 items-center" aria-live="polite" aria-label="Your answer">
            {built.length === 0 && <span className="text-gray-500 font-bold px-1">Tap the words in order</span>}
            {built.map((b) => (
              <button key={b.key} type="button" disabled={disabled} onClick={() => setBuilt(built.filter((x) => x.key !== b.key))} className="px-3 py-2 rounded-lg border-2 border-gray-900 font-extrabold bg-white min-h-11">
                {b.text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                data-chip="bank"
                disabled={disabled || usedKeys.has(c.key)}
                onClick={() => setBuilt([...built, c])}
                className="nc-press px-3 py-2 rounded-lg border-2 border-gray-900 font-extrabold min-h-12 disabled:opacity-30"
                style={{ background: "#E0F2FE", ...CHUNK_SM }}
              >
                {c.text}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Btn small color="white" disabled={disabled || !built.length} onClick={() => setBuilt(built.slice(0, -1))}>
              Undo
            </Btn>
            <Btn small color="white" disabled={disabled || !built.length} onClick={() => setBuilt([])}>
              Clear
            </Btn>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onSubmit(typed);
          }}
        >
          <label htmlFor="nc-typed" className="sr-only">
            Type your answer
          </label>
          <input
            id="nc-typed"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={disabled}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-full rounded-xl border-4 border-gray-900 px-3 py-3 text-lg font-bold min-h-12 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
            placeholder="Type your answer"
          />
        </form>
      )}
      {eliminatedHint && (
        <p className="font-bold text-sm rounded-lg border-2 border-gray-900 px-2 py-1" style={{ background: "#FEF3C7" }}>
          Hint: {eliminatedHint}
        </p>
      )}
      <div className="flex gap-2 items-center">
        <Btn color="green" className="flex-1" disabled={disabled || !answerText.trim()} onClick={() => onSubmit(answerText)}>
          Rest my case
        </Btn>
      </div>
      <button type="button" onClick={onToggleMode} className="text-sm font-extrabold underline text-gray-700 self-start min-h-11">
        {mode === "bank" ? "Type instead" : "Use the word bank instead"}
      </button>
    </div>
  );
}

function FeedbackPanel({ q, pending, onNext, palette, last }) {
  const right = pending.correct;
  const isMcq = q.type === "mcq";
  const correctText = isMcq ? q.options[q.answer] : q.answer;
  const pickedWhyNot = isMcq && !right && pending.picked !== null && pending.picked !== undefined ? q.whyNot[String(pending.picked)] : null;
  return (
    <Card className="p-4 nc-rise" style={{ background: right ? palette.rightSoft : palette.wrongSoft }}>
      <div className="flex items-center gap-2">
        <span className="nc-display text-white text-xl px-3 py-1 rounded-lg border-4 border-gray-900" style={{ background: right ? palette.right : palette.wrong }}>
          {right ? "✓ SUSTAINED!" : pending.timeout ? "⏱ TIME!" : "✗ OVERRULED!"}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-gray-900" aria-live="polite">
        {!right && (
          <p>
            <span className="font-extrabold">Correct answer: </span>
            {isMcq ? `${"ABCD"[q.answer]}. ` : ""}
            <span className="font-extrabold">{correctText}</span>
          </p>
        )}
        {pending.note && <p className="text-sm font-bold">{pending.note}</p>}
        {!isMcq && !right && pending.typed && (
          <p className="text-sm">
            You said: <span className="font-bold">{pending.typed}</span>
          </p>
        )}
        <p>
          <span className="font-extrabold">Why: </span>
          {q.rationale}
        </p>
        {pickedWhyNot && (
          <p>
            <span className="font-extrabold">Why not "{q.options[pending.picked]}": </span>
            {pickedWhyNot}
          </p>
        )}
        {q.mnemonic && (
          <p className="text-sm">
            <span className="font-extrabold">Memory hook: </span>
            {q.mnemonic}
          </p>
        )}
        {q.note && (
          <p className="text-sm rounded-lg border-2 border-gray-900 p-2" style={{ background: "#FEF3C7" }}>
            <span className="font-extrabold">⚠ {q.note}</span>
          </p>
        )}
        {!right && <p className="text-sm font-bold text-gray-700">Added to your Appeal Queue. It comes back after your next round.</p>}
        <p className="text-xs text-gray-600">{q.sourceTag}</p>
      </div>
      <Btn color={right ? "green" : "yellow"} className="w-full mt-3 text-xl" onClick={onNext}>
        {last ? "See the verdict" : "Next ▶"}
      </Btn>
    </Card>
  );
}

function Play({ S, update, go, finishRound, palette }) {
  const cp = S.checkpoint;
  const settings = S.settings;
  const q = cp ? Q_BY_ID[cp.qids[cp.idx]] : null;
  const [recess, setRecess] = useState(false);
  const [breakTime, setBreakTime] = useState(false);
  const [stretch, setStretch] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS);
  const [shakeKey, setShakeKey] = useState(0);
  const lastBreak = useRef(Date.now());
  const pending = cp && cp.pending;

  useEffect(() => {
    setTimeLeft(SPEED_SECONDS);
  }, [q && q.id]);
  useEffect(() => {
    if (!settings.speed || pending || !q || recess || breakTime) return;
    if (timeLeft <= 0) {
      submit({ timeout: true });
      return;
    }
    const t = setTimeout(() => setTimeLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  });
  useEffect(() => {
    if (stretch <= 0) return;
    const t = setTimeout(() => setStretch((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [stretch]);

  if (!cp || !q) {
    return (
      <div className="flex flex-col gap-4">
        <TopBar title="Court is adjourned" onBack={() => go({ name: "lobby" })} />
        <Card className="p-4">
          <p className="font-bold">No round in progress. Pick a case file from the lobby.</p>
        </Card>
      </div>
    );
  }
  const mode = modeOf(q, cp.kind);
  const info = MODE_INFO[mode];
  const hinted = !!cp.hints[q.id];
  const eliminated = q.type === "mcq" && hinted ? mcqEliminated(q) : null;

  function submit({ picked = null, typed = "", timeout = false }) {
    if (pending) return;
    let result;
    if (timeout) result = { correct: false };
    else if (q.type === "mcq") result = { correct: picked === q.answer };
    else result = checkId(q, typed);
    beep(result.correct ? "right" : "wrong", settings.sound);
    if (!result.correct) setShakeKey((k) => k + 1);
    update((n) => {
      const c = n.checkpoint;
      const s = n.seen[q.id] || { c: 0, w: 0, last: 0 };
      s.last = n.roundsPlayed;
      const mult = c.kind === "boss" || c.kind === "grand" ? 2 : 1;
      let earned = 0;
      if (result.correct) {
        s.c += 1;
        n.streak += 1;
        n.bestStreak = Math.max(n.bestStreak, n.streak);
        earned = (10 + (n.streak >= 3 ? 5 : 0)) * mult;
        n.coins += earned;
        n.xp += 10 * q.difficulty;
        if (n.streak >= 10 && !n.badges.includes("streak10")) n.badges.push("streak10");
        const a = n.appeal[q.id];
        if (a) {
          if (a.stage >= 1) {
            delete n.appeal[q.id];
            if (!n.badges.includes("appeal")) n.badges.push("appeal");
          } else n.appeal[q.id] = { stage: 1, due: n.roundsPlayed + 3 };
        }
      } else {
        s.w += 1;
        n.streak = 0;
        c.hearts = Math.max(0, c.hearts - 1);
        n.appeal[q.id] = { stage: 0, due: n.roundsPlayed + 1 };
      }
      n.seen[q.id] = s;
      c.results.push({ id: q.id, correct: result.correct, hint: !!c.hints[q.id], earned });
      c.pending = { correct: result.correct, picked, typed, note: result.note || "", timeout };
    });
  }
  function next() {
    const last = cp.idx + 1 >= cp.qids.length;
    if (cp.hearts <= 0 && !last) {
      setRecess(true);
      return;
    }
    advance();
  }
  function advance() {
    const last = cp.idx + 1 >= cp.qids.length;
    if (last) {
      finishRound();
      return;
    }
    update((n) => {
      n.checkpoint.pending = null;
      n.checkpoint.idx += 1;
    });
    if (settings.breaks && Date.now() - lastBreak.current > BREAK_MS) {
      setBreakTime(true);
      lastBreak.current = Date.now();
    }
  }
  function takeHint() {
    update((n) => {
      n.checkpoint.hints[q.id] = true;
    });
  }
  const nextQ = Q_BY_ID[cp.qids[cp.idx + 1]];
  const nextTopic = nextQ ? TOPIC_BY_ID[nextQ.topic] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Btn small color="white" onClick={() => go({ name: "lobby" })} ariaLabel="Pause and go to lobby. Your round is saved.">
          ❚❚
        </Btn>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-white font-extrabold text-sm mb-1">
            <span className="truncate">{cp.title}</span>
            <span className="tabular-nums shrink-0 ml-2">
              {cp.idx + 1}/{cp.qids.length}
            </span>
          </div>
          <ProgressBar value={cp.idx + (pending ? 1 : 0)} max={cp.qids.length} color={COLORS.yellow} />
        </div>
        <div className="flex" aria-label={`Credibility: ${cp.hearts} of ${MAX_HEARTS} hearts`}>
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <Heart key={i} on={i < cp.hearts} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-4 border-gray-900 overflow-hidden bg-white" style={CHUNK}>
        <Courtroom reaction={pending ? (pending.correct ? "right" : "wrong") : null} mode={mode} look={S.look} still={settings.reducedMotion} />
      </div>

      {!pending && (
        <Card key={`q-${q.id}-${shakeKey}`} className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="nc-display text-white text-sm px-2 py-1 rounded-md border-2 border-gray-900" style={{ background: info.color }}>
              {info.label}
            </span>
            <span className="text-xs font-bold text-gray-500 truncate flex-1 min-w-0">{TOPIC_BY_ID[q.topic].title}</span>
            {settings.speed && (
              <span className="nc-display tabular-nums text-lg" style={{ color: timeLeft <= 5 ? COLORS.red : COLORS.ink }} aria-label={`${timeLeft} seconds left`}>
                {timeLeft}s
              </span>
            )}
          </div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mt-3">{info.speaker}:</p>
          <p className="text-lg font-bold text-gray-900 leading-snug mt-1">{q.stem}</p>
          <p className="text-sm text-gray-600 mt-2">{q.type === "id" ? "State your answer." : info.ask}</p>
        </Card>
      )}

      {!pending && q.type === "mcq" && (
        <div className="flex flex-col gap-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={i === eliminated}
              onClick={() => submit({ picked: i })}
              className="nc-press text-left bg-white rounded-xl border-4 border-gray-900 p-3 flex gap-3 items-start min-h-14 disabled:opacity-30 disabled:line-through focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
              style={CHUNK_SM}
            >
              <span className="nc-display w-9 h-9 shrink-0 rounded-lg border-2 border-gray-900 flex items-center justify-center" style={{ background: COLORS.yellow }}>
                {"ABCD"[i]}
              </span>
              <span className="font-bold text-gray-900 pt-1 min-w-0">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {!pending && q.type === "id" && (
        <Card className="p-3">
          <IdAnswer
            q={q}
            mode={settings.inputMode}
            disabled={!!pending}
            onSubmit={(typed) => submit({ typed })}
            eliminatedHint={hinted ? idHint(q) : null}
            onToggleMode={() =>
              update((n) => {
                n.settings.inputMode = n.settings.inputMode === "bank" ? "type" : "bank";
              })
            }
          />
        </Card>
      )}

      {!pending && !hinted && (
        <button type="button" onClick={takeHint} className="self-center text-white font-extrabold underline min-h-11 px-3">
          Ask for a hint (free, but costs you a star)
        </button>
      )}

      {pending && <FeedbackPanel q={q} pending={pending} onNext={next} palette={palette} last={cp.idx + 1 >= cp.qids.length} />}

      {recess && (
        <Modal label="Recess">
          <Card className="p-5">
            <h2 className="nc-display text-3xl text-gray-900">Recess!</h2>
            <p className="mt-2 text-gray-800">
              The judge calls a short break. Your credibility is restored to {MAX_HEARTS} hearts. Mistakes here are how you learn.
            </p>
            {nextTopic && (
              <div className="mt-3 rounded-xl border-2 border-gray-900 p-3" style={{ background: "#FEF3C7" }}>
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-600">Evidence for your next question</p>
                <p className="font-extrabold text-gray-900">{nextTopic.title}</p>
                <p className="text-sm text-gray-800 mt-1">{nextTopic.summary}</p>
              </div>
            )}
            <Btn
              color="green"
              className="w-full mt-4"
              onClick={() => {
                update((n) => {
                  n.checkpoint.hearts = MAX_HEARTS;
                });
                setRecess(false);
                advance();
              }}
            >
              Back to court
            </Btn>
          </Card>
        </Modal>
      )}

      {breakTime && (
        <Modal label="Break reminder">
          <Card className="p-5">
            <h2 className="nc-display text-3xl text-gray-900">Recess! Stretch break</h2>
            <p className="mt-2 text-gray-800">You have been in court for 15 minutes. Stand up, roll your shoulders, and drink some water.</p>
            {stretch > 0 ? (
              <p className="nc-display text-5xl text-center my-4 tabular-nums" aria-live="polite">
                {stretch}
              </p>
            ) : (
              <Btn color="blue" className="w-full mt-4" onClick={() => setStretch(60)}>
                Start a 1-minute stretch
              </Btn>
            )}
            <Btn color={stretch > 0 ? "green" : "white"} className="w-full mt-3" onClick={() => { setBreakTime(false); setStretch(0); }}>
              {stretch > 0 ? "I'm back" : "Skip the break"}
            </Btn>
          </Card>
        </Modal>
      )}
    </div>
  );
}

// ---------- Round result ----------
function Result({ summary, go, startRound, S }) {
  const { title, correct, total, stars, coins, xp, missed, newBadges, cfg, unit } = summary;
  const m = unit ? unitMastery(S, unit) : null;
  const still = S.settings.reducedMotion;
  return (
    <div className="flex flex-col gap-4 relative">
      {!still && stars === 3 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="nc-confetti absolute w-3 h-3 border-2 border-gray-900" style={{ left: `${(i * 53) % 100}%`, background: [COLORS.yellow, COLORS.green, COLORS.red, "#60A5FA"][i % 4], animationDelay: `${(i % 6) * 0.12}s` }} />
          ))}
        </div>
      )}
      <Card className="p-5 text-center">
        <p className="text-xs font-extrabold uppercase tracking-wider text-gray-500">{title}</p>
        <h2 className="nc-display text-4xl text-gray-900 mt-1">{stars === 3 ? "Case won!" : stars === 2 ? "Strong case!" : "Case heard!"}</h2>
        <div className="flex justify-center my-3">
          <Stars n={stars} size={44} />
        </div>
        <p className="nc-display text-2xl tabular-nums">
          {correct}/{total} correct
        </p>
        <div className="flex justify-center gap-3 mt-3">
          <Stat icon={<Coin />} value={`+${coins}`} label={`${coins} coins earned`} />
          <Stat icon={<Star on size={18} />} value={`+${xp} XP`} label={`${xp} XP earned`} />
        </div>
        {m && (
          <p className="mt-3 font-bold text-gray-700">
            {m.stars >= 3 ? `Unit ${unit} is fully mastered.` : `Unit ${unit}: next mastery star in ${m.toNext} new correct answer${m.toNext === 1 ? "" : "s"}.`}
          </p>
        )}
      </Card>
      {newBadges.length > 0 && (
        <Card className="p-4" style={{ background: COLORS.yellow }}>
          <p className="nc-display text-xl">New badge{newBadges.length > 1 ? "s" : ""}!</p>
          {newBadges.map((b) => (
            <p key={b} className="font-extrabold">
              {BADGES[b].name}: <span className="font-bold">{BADGES[b].desc}</span>
            </p>
          ))}
        </Card>
      )}
      {missed.length > 0 && (
        <Card className="p-4">
          <p className="nc-display text-xl text-gray-900">Sent to the Appeal Queue ({missed.length})</p>
          <p className="text-sm text-gray-600 mb-2">These come back after your next round, then again 3 rounds later.</p>
          <ul className="flex flex-col gap-2">
            {missed.map((id) => {
              const q = Q_BY_ID[id];
              return (
                <li key={id} className="rounded-xl border-2 border-gray-900 p-2">
                  <p className="text-sm text-gray-800">{q.stem}</p>
                  <p className="font-extrabold text-gray-900 mt-1">→ {q.type === "mcq" ? q.options[q.answer] : q.answer}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Btn color="green" className="w-full text-xl" onClick={() => startRound({ ...cfg, title: cfg.kind === "unit" ? `Unit ${cfg.unit} · Round ${(S.unitRounds[cfg.unit] || 0) + 1}` : cfg.title })}>
        Next round ▶
      </Btn>
      <Btn color="white" className="w-full" onClick={() => go({ name: "lobby" })}>
        Back to lobby
      </Btn>
    </div>
  );
}

// ---------- Appeal Queue ----------
function Appeals({ S, go, startRound }) {
  const entries = Object.entries(S.appeal);
  const due = entries.filter(([, a]) => a.due <= S.roundsPlayed);
  const later = entries.filter(([, a]) => a.due > S.roundsPlayed);
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Appeal Queue" onBack={() => go({ name: "lobby" })} />
      <Card className="p-4">
        <p className="text-gray-800">
          Missed questions come back here: first after <b>1 round</b>, then <b>3 rounds</b> later. Get one right twice in a row and the appeal is granted.
        </p>
        <p className="nc-display text-2xl mt-2 tabular-nums">
          {due.length} due now · {later.length} waiting
        </p>
      </Card>
      {due.length > 0 && (
        <Btn color="green" className="w-full text-xl" onClick={() => startRound({ kind: "appeal", size: Math.min(ROUND_SIZE, due.length), title: "Appeal hearing" })}>
          Start appeal hearing ({Math.min(ROUND_SIZE, due.length)})
        </Btn>
      )}
      {due.length === 0 && later.length > 0 && (
        <Btn color="yellow" className="w-full" onClick={() => startRound({ kind: "appeal", includeLater: true, size: Math.min(ROUND_SIZE, later.length), title: "Early appeal practice" })}>
          Practice waiting appeals early
        </Btn>
      )}
      {entries.length === 0 && (
        <Card className="p-4">
          <p className="font-bold">No appeals. Every missed question will land here so nothing slips through.</p>
        </Card>
      )}
      {entries.length > 0 && (
        <Card className="p-4">
          <ul className="flex flex-col gap-2">
            {[...due, ...later].map(([id, a]) => {
              const q = Q_BY_ID[id];
              if (!q) return null;
              const wait = a.due - S.roundsPlayed;
              return (
                <li key={id} className="rounded-xl border-2 border-gray-900 p-2">
                  <p className="text-xs font-extrabold text-gray-500">
                    Unit {q.unit} · {wait <= 0 ? "due now" : `due in ${wait} round${wait === 1 ? "" : "s"}`} · step {a.stage + 1} of 2
                  </p>
                  <p className="text-sm text-gray-900">{q.stem}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------- Evidence Locker ----------
function QuestionReview({ q }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border-2 border-gray-900 p-3">
      <p className="text-xs font-extrabold text-gray-500">
        {q.id} · {q.type === "mcq" ? (q.situational ? "Situational MCQ" : "MCQ") : "Identification"} · difficulty {q.difficulty}
      </p>
      <p className="text-gray-900 mt-1">{q.stem}</p>
      {q.type === "mcq" ? (
        <ol className="mt-2 flex flex-col gap-1">
          {q.options.map((o, i) => (
            <li key={i} className={`text-sm rounded-md px-2 py-1 ${i === q.answer ? "font-extrabold border-2 border-gray-900" : "text-gray-700"}`} style={i === q.answer ? { background: "#DCFCE7" } : undefined}>
              {"ABCD"[i]}. {o} {i === q.answer ? "✓" : ""}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 font-extrabold rounded-md px-2 py-1 border-2 border-gray-900 inline-block" style={{ background: "#DCFCE7" }}>
          ✓ {q.answer}
          {q.aliases && q.aliases.length > 0 && <span className="font-bold text-gray-600"> (also: {q.aliases.join(", ")})</span>}
        </p>
      )}
      <p className="text-sm text-gray-800 mt-2">
        <b>Why:</b> {q.rationale}
      </p>
      {q.mnemonic && (
        <p className="text-sm text-gray-800 mt-1">
          <b>Memory hook:</b> {q.mnemonic}
        </p>
      )}
      {q.note && (
        <p className="text-sm mt-2 rounded-md border-2 border-gray-900 p-2" style={{ background: "#FEF3C7" }}>
          <b>⚠ {q.note}</b>
        </p>
      )}
      {q.type === "mcq" && (
        <>
          <button type="button" className="text-sm font-extrabold underline mt-1 min-h-11" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Hide why the others are wrong" : "Why the others are wrong"}
          </button>
          {open && (
            <ul className="text-sm text-gray-800 flex flex-col gap-1">
              {Object.entries(q.whyNot).map(([i, w]) => (
                <li key={i}>
                  <b>{"ABCD"[Number(i)]}.</b> {w}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
function Locker({ go, startRound }) {
  const [tab, setTab] = useState(UNIT_ORDER[0]);
  const [openTopic, setOpenTopic] = useState(null);
  const [query, setQuery] = useState("");
  const qn = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (qn.length < 2) return [];
    return QUESTIONS.filter((q) =>
      [q.stem, q.type === "mcq" ? q.options.join(" ") : q.answer, (q.aliases || []).join(" "), q.rationale, TOPIC_BY_ID[q.topic].title].join(" ").toLowerCase().includes(qn)
    );
  }, [qn]);
  const topicHits = useMemo(() => (qn.length < 2 ? [] : TOPICS.filter((t) => (t.title + " " + t.summary).toLowerCase().includes(qn))), [qn]);
  const notes = useMemo(() => QUESTIONS.filter((q) => q.note), []);
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Evidence Locker" onBack={() => go({ name: "lobby" })} />
      <Card className="p-3">
        <label htmlFor="nc-search" className="text-xs font-extrabold uppercase tracking-wider text-gray-500">
          Search every unit
        </label>
        <input
          id="nc-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. battery, BARS, RA 9288, smoothing"
          className="w-full mt-1 rounded-xl border-4 border-gray-900 px-3 py-2 text-base font-bold min-h-12 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
        />
      </Card>
      {qn.length >= 2 ? (
        <div className="flex flex-col gap-3">
          <p className="text-white font-extrabold">
            {topicHits.length} topic{topicHits.length === 1 ? "" : "s"} · {results.length} question{results.length === 1 ? "" : "s"}
            {results.length > 40 ? " (showing the first 40)" : ""}
          </p>
          {topicHits.map((t) => (
            <Card key={t.id} className="p-3">
              <p className="text-xs font-extrabold text-gray-500">Unit {t.unit} · {t.section}</p>
              <p className="font-extrabold text-gray-900">{t.title}</p>
              <p className="text-sm text-gray-800 mt-1">{t.summary}</p>
            </Card>
          ))}
          <ul className="flex flex-col gap-2 bg-white rounded-2xl border-4 border-gray-900 p-3" style={CHUNK}>
            {results.slice(0, 40).map((q) => (
              <QuestionReview key={q.id} q={q} />
            ))}
            {results.length === 0 && <li className="font-bold">No questions match. Try a shorter word.</li>}
          </ul>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Units">
            {UNIT_ORDER.map((u) => (
              <button key={u} type="button" role="tab" aria-selected={tab === u} onClick={() => { setTab(u); setOpenTopic(null); }} className="nc-display px-3 py-2 rounded-lg border-4 border-gray-900 min-h-12" style={{ background: tab === u ? COLORS.yellow : "#FFFFFF", ...CHUNK_SM }}>
                Unit {u}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={tab === "notes"} onClick={() => setTab("notes")} className="nc-display px-3 py-2 rounded-lg border-4 border-gray-900 min-h-12" style={{ background: tab === "notes" ? COLORS.yellow : "#FFFFFF", ...CHUNK_SM }}>
              ⚠ Source notes
            </button>
          </div>
          {tab === "notes" ? (
            <Card className="p-4">
              <p className="text-gray-800 mb-3">
                The modules are transcribed notes with some typos. These items use the module's meaning. Check them with your professor.
              </p>
              {UNITS.filter((u) => u.note).map((u) => (
                <p key={u.unit} className="text-sm mb-2 rounded-md border-2 border-gray-900 p-2" style={{ background: "#FEF3C7" }}>
                  <b>Unit {u.unit}:</b> {u.note}
                </p>
              ))}
              <ul className="flex flex-col gap-2">
                {notes.map((q) => (
                  <li key={q.id} className="text-sm border-b-2 border-gray-200 pb-2">
                    <b>
                      {q.id} ({TOPIC_BY_ID[q.topic].title}):
                    </b>{" "}
                    {q.note.replace(/^Source note:\s*/, "")}
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <Card className="p-3">
                <p className="nc-display text-xl">Unit {tab}: {UNIT_BY_NUM[tab].title}</p>
                {UNIT_BY_NUM[tab].note && <p className="text-sm font-bold mt-1">⚠ {UNIT_BY_NUM[tab].note}</p>}
              </Card>
              {TOPICS.filter((t) => t.unit === tab).map((t) => {
                const tq = QUESTIONS.filter((q) => q.topic === t.id);
                const isOpen = openTopic === t.id;
                return (
                  <Card key={t.id} className="p-0 overflow-hidden">
                    <button type="button" onClick={() => setOpenTopic(isOpen ? null : t.id)} aria-expanded={isOpen} className="w-full text-left p-3 flex items-center gap-2 min-h-12 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">
                      <span className="flex-1 min-w-0">
                        <span className="block font-extrabold text-gray-900">{t.title}</span>
                        <span className="block text-xs text-gray-500">{t.section} · {tq.length} questions</span>
                      </span>
                      <span className="nc-display text-xl" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 flex flex-col gap-3">
                        <div className="rounded-xl border-2 border-gray-900 p-3" style={{ background: "#E0F2FE" }}>
                          <p className="text-xs font-extrabold uppercase tracking-wider text-gray-600">Concept summary</p>
                          <p className="text-gray-900 mt-1">{t.summary}</p>
                          {t.mnemonic && (
                            <p className="text-sm mt-2">
                              <b>Memory hook:</b> {t.mnemonic}
                            </p>
                          )}
                        </div>
                        <Btn small color="green" onClick={() => startRound({ kind: "topic", unit: t.unit, topic: t.id, title: t.title })}>
                          Practice this topic
                        </Btn>
                        <ul className="flex flex-col gap-2">
                          {tq.map((q) => (
                            <QuestionReview key={q.id} q={q} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Shop ----------
function Shop({ S, update, go }) {
  const [msg, setMsg] = useState("");
  function act(item) {
    const owned = S.owned.includes(item.id);
    if (!owned && S.coins < item.cost) {
      setMsg(`You need ${item.cost - S.coins} more Gavel Coins for the ${item.name}. Win a round to earn more.`);
      return;
    }
    update((n) => {
      if (!n.owned.includes(item.id)) {
        n.coins -= item.cost;
        n.owned.push(item.id);
      }
      n.look[item.slot] = item.id;
    });
    setMsg(owned ? `Equipped: ${item.name}.` : `Bought and equipped: ${item.name}.`);
  }
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Shop" onBack={() => go({ name: "lobby" })} right={<Stat icon={<Coin />} value={S.coins} label={`${S.coins} Gavel Coins`} />} />
      <Card className="p-4 flex items-center gap-4">
        <Avatar look={S.look} size={96} />
        <p className="text-gray-800 font-bold" aria-live="polite">
          {msg || "Spend Gavel Coins on hats, wigs, robes, and gavels. Tap an item you own to wear it."}
        </p>
      </Card>
      {Object.keys(SLOT_LABEL).map((slot) => (
        <Card key={slot} className="p-4">
          <p className="nc-display text-xl mb-2">{SLOT_LABEL[slot]}</p>
          <div className="grid grid-cols-2 gap-2">
            {SHOP.filter((i) => i.slot === slot).map((item) => {
              const owned = S.owned.includes(item.id);
              const worn = S.look[slot] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => act(item)}
                  className="nc-press text-left rounded-xl border-4 border-gray-900 p-2 min-h-14 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
                  style={{ background: worn ? COLORS.yellow : "#FFFFFF", ...CHUNK_SM }}
                  aria-pressed={worn}
                >
                  <span className="flex items-center gap-2">
                    {item.color && <span className="w-5 h-5 rounded border-2 border-gray-900 shrink-0" style={{ background: item.color === "rainbow" ? "linear-gradient(90deg,#EF4444,#FACC15,#22C55E,#3B82F6)" : item.color }} />}
                    <span className="font-extrabold text-gray-900 text-sm">{item.name}</span>
                  </span>
                  <span className="block text-xs font-bold text-gray-600 mt-1">{worn ? "Wearing" : owned ? "Owned · tap to wear" : `${item.cost} coins`}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Settings ----------
function Settings({ S, update, go, resetAll }) {
  const [confirm, setConfirm] = useState(false);
  const st = S.settings;
  const set = (k) => (v) =>
    update((n) => {
      n.settings[k] = v;
    });
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Settings" onBack={() => go({ name: "lobby" })} />
      <Card className="px-4 py-1">
        <Toggle id="set-motion" label="Reduce motion" desc="Turns off gavel, jury, and confetti animations." value={st.reducedMotion} onChange={set("reducedMotion")} />
        <Toggle id="set-sound" label="Sound effects" desc="Short beeps for right and wrong answers." value={st.sound} onChange={set("sound")} />
        <Toggle id="set-large" label="Larger text" desc="Makes all text bigger." value={st.largeText} onChange={set("largeText")} />
        <Toggle id="set-cb" label="Color-blind-safe colors" desc="Blue for right, orange for wrong. Icons always show too." value={st.cbSafe} onChange={set("cbSafe")} />
        <Toggle id="set-type" label="Type identification answers" desc="Off = tap words from a word bank (default)." value={st.inputMode === "type"} onChange={(v) => set("inputMode")(v ? "type" : "bank")} />
        <Toggle id="set-speed" label="Speed Round timer" desc={`Optional ${SPEED_SECONDS}-second timer per question. Off by default.`} value={st.speed} onChange={set("speed")} />
        <Toggle id="set-breaks" label="Break reminders" desc="A stretch break after about 15 minutes. You can skip it." value={st.breaks} onChange={set("breaks")} />
      </Card>
      <Card className="p-4">
        <p className="font-extrabold">Progress saves after every answer and every round.</p>
        <p className="text-sm text-gray-600 mt-1">If saving is not available on this device, progress lasts until you close the page.</p>
        {!confirm ? (
          <Btn small color="white" className="mt-3" onClick={() => setConfirm(true)}>
            Reset all progress
          </Btn>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <p className="font-extrabold" style={{ color: COLORS.red }}>
              This erases coins, stars, badges, appeals, and items. It cannot be undone.
            </p>
            <div className="flex gap-2">
              <Btn small color="red" onClick={() => { resetAll(); setConfirm(false); }}>
                Erase everything
              </Btn>
              <Btn small color="white" onClick={() => setConfirm(false)}>
                Keep my progress
              </Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   App shell
   ============================================================ */
export default function NursingCourt() {
  const [S, setS] = useState(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState({ name: "lobby" });

  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (!alive) return;
      if (saved) setS(mergeState(saved));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    // Save on every change (checkpoint after each answer and each round), queued so writes land in order.
    if (loaded) saveQueue = saveQueue.then(() => saveState(S)).catch(() => {});
  }, [S, loaded]);
  useEffect(() => {
    try {
      if (!document.getElementById("nc-fonts")) {
        const l = document.createElement("link");
        l.id = "nc-fonts";
        l.rel = "stylesheet";
        l.href = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;700;800&display=swap";
        document.head.appendChild(l);
      }
    } catch (e) {
      /* fonts are optional */
    }
  }, []);
  useEffect(() => {
    try {
      document.documentElement.style.fontSize = S.settings.largeText ? "18px" : "16px";
    } catch (e) {
      /* ignore */
    }
  }, [S.settings.largeText]);
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch (e) {
      /* ignore */
    }
  }, [screen.name, S.checkpoint && S.checkpoint.idx]);

  const update = (fn) =>
    setS((prev) => {
      const n = JSON.parse(JSON.stringify(prev));
      fn(n);
      return n;
    });
  const go = (s) => setScreen(s);
  const palette = S.settings.cbSafe ? FEEDBACK.cb : FEEDBACK.normal;

  function startRound(cfg) {
    const qids = buildRound(S, cfg);
    if (!qids.length) {
      go({ name: cfg.kind === "appeal" ? "appeal" : "lobby" });
      return;
    }
    update((n) => {
      n.checkpoint = { kind: cfg.kind, unit: cfg.unit || null, topic: cfg.topic || null, title: cfg.title, cfg, qids, idx: 0, results: [], hearts: MAX_HEARTS, hints: {}, pending: null, badgesAtStart: [...S.badges] };
    });
    go({ name: "play" });
  }

  function finishRound() {
    const cp = S.checkpoint;
    const correct = cp.results.filter((r) => r.correct).length;
    const hints = cp.results.filter((r) => r.hint).length;
    const total = cp.qids.length;
    const score = (correct - 0.5 * hints) / total;
    const stars = score >= 0.95 ? 3 : score >= 0.75 ? 2 : 1;
    const missed = cp.results.filter((r) => !r.correct).map((r) => r.id);
    const coinsFromAnswers = cp.results.reduce((a, r) => a + (r.earned || 0), 0);
    const bonus = 20 + (stars === 3 ? 30 : stars === 2 ? 10 : 0);
    const xpGain = cp.results.reduce((a, r) => a + (r.correct ? 10 * Q_BY_ID[r.id].difficulty : 0), 0);
    const newBadges = [];
    const nextState = JSON.parse(JSON.stringify(S));
    const n = nextState;
    const award = (b) => {
      if (!n.badges.includes(b)) {
        n.badges.push(b);
        newBadges.push(b);
      }
    };
    n.roundsPlayed += 1;
    n.coins += bonus;
    if (cp.unit && cp.kind === "unit") n.unitRounds[cp.unit] = (n.unitRounds[cp.unit] || 0) + 1;
    if (n.daily.date !== todayKey()) n.daily = { date: todayKey(), wins: 0, claimed: false };
    if (correct / total >= 0.6) n.daily.wins += 1;
    award("first-case");
    if (correct === total && hints === 0 && total >= ROUND_SIZE) award("sustained");
    if (cp.kind === "boss") award("boss");
    if (cp.kind === "grand" && correct >= 8) award("grand");
    const before = cp.badgesAtStart || [];
    ["streak10", "appeal"].forEach((b) => {
      if (!before.includes(b) && n.badges.includes(b) && !newBadges.includes(b)) newBadges.push(b);
    });
    if (UNIT_ORDER.some((u) => unitMastery(n, u).stars >= 3)) award("master");
    n.checkpoint = null;
    setS(nextState);
    beep(stars >= 2 ? "win" : "click", S.settings.sound);
    go({
      name: "result",
      summary: { title: cp.title, correct, total, stars, coins: coinsFromAnswers + bonus, xp: xpGain, missed, newBadges, cfg: cp.cfg, unit: cp.unit },
    });
  }

  function claimDaily() {
    update((n) => {
      if (n.daily.date === todayKey() && n.daily.wins >= 3 && !n.daily.claimed) {
        n.daily.claimed = true;
        n.coins += 100;
        if (!n.badges.includes("daily")) n.badges.push("daily");
      }
    });
  }

  function resetAll() {
    const fresh = defaultState();
    fresh.settings = S.settings;
    setS(fresh);
    go({ name: "lobby" });
  }

  let body;
  if (screen.name === "case") body = <CaseIntro S={S} unit={screen.unit} go={go} startRound={startRound} />;
  else if (screen.name === "play") body = <Play S={S} update={update} go={go} finishRound={finishRound} palette={palette} />;
  else if (screen.name === "result") body = <Result summary={screen.summary} go={go} startRound={startRound} S={S} />;
  else if (screen.name === "appeal") body = <Appeals S={S} go={go} startRound={startRound} />;
  else if (screen.name === "locker") body = <Locker go={go} startRound={startRound} />;
  else if (screen.name === "shop") body = <Shop S={S} update={update} go={go} />;
  else if (screen.name === "settings") body = <Settings S={S} update={update} go={go} resetAll={resetAll} />;
  else body = <Lobby S={S} go={go} startRound={startRound} claimDaily={claimDaily} />;

  return (
    <div className={`nc-root min-h-screen w-full ${S.settings.reducedMotion ? "nc-still" : ""}`} style={STUDS}>
      <style>{CSS}</style>
      <main className="mx-auto w-full max-w-md px-4 py-5">{body}</main>
    </div>
  );
}
