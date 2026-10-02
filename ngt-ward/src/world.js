/* ================= WORLD: the ward, the nurse, movement ================= */
const WW = 960, WH = 600;
const W = {
  cv: null, ctx: null, dpr: 1, scale: 1, camX: 0, camY: 0, vw: 0, vh: 0,
  t: 0, floor: null, keys: {}, joy: { x: 0, y: 0, on: false },
  p: { x: 560, y: 530, dir: "up", walkT: 0, moving: false, target: null, pending: null, stuck: 0, lastD: 0, stepAcc: 0, busy: 0 },
  near: null, hobShown: 10, sinkRun: 0, binOpen: 0, cartOpen: 0, bubble: null, ci: { x: 548, y: 470 },
  dist: 0, paused: true, demoMode: false, title: false,
};

const SOLIDS = [
  [296, 92, 128, 238],   // patient bed
  [432, 114, 28, 28],    // IV pole base
  [432, 244, 56, 48],    // overbed table
  [236, 96, 50, 52],     // bedside cabinet
  [206, 214, 40, 44],    // visitor chair
  [598, 100, 86, 74],    // supply cart
  [786, 84, 88, 34],     // sink
  [896, 100, 48, 58],    // waste bins
  [690, 436, 250, 40],   // desk top
  [900, 436, 40, 124],   // desk side
  [52, 326, 136, 224],   // bed 4
  [22, 96, 40, 40],      // plant
  [534, 452, 30, 30],    // clinical instructor
];
const SPOTS = [
  { id: "chart", label: "Patient chart", x: 735, y: 416, r: 56 },
  { id: "emr", label: "Computer: nurse's notes", x: 852, y: 416, r: 56 },
  { id: "cart", label: "Supply cart", x: 641, y: 198, r: 60 },
  { id: "sink", label: "Hand hygiene sink", x: 830, y: 140, r: 56 },
  { id: "bins", label: "Waste bins", x: 920, y: 182, r: 50 },
  { id: "patient", label: "", x: 464, y: 196, r: 54 },
  { id: "bedctl", label: "Bed controls", x: 360, y: 352, r: 46 },
  { id: "curtain", label: "Privacy curtain", x: 280, y: 362, r: 40 },
  { id: "ci", label: "Clinical Instructor", x: 549, y: 500, r: 44 },
  { id: "neighbor", label: "Bed 4", x: 150, y: 306, r: 40 },
];
const RAIL = [[262, 96], [262, 380], [494, 380], [494, 96]];
const RAIL_LEN = 284 + 232 + 284;

function initWorld(cv) {
  W.cv = cv; W.ctx = cv.getContext("2d");
  W.floor = buildFloor();
  resizeWorld();
  window.addEventListener("resize", resizeWorld);
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k) && !modalOpen()) e.preventDefault();
    W.keys[k] = true;
  });
  window.addEventListener("keyup", (e) => { W.keys[e.key.toLowerCase()] = false; });
  window.addEventListener("blur", () => { W.keys = {}; });
  cv.addEventListener("pointerdown", onWorldPointer);
}
function resizeWorld() {
  const r = W.cv.getBoundingClientRect();
  W.dpr = Math.min(window.devicePixelRatio || 1, 2);
  W.vw = Math.max(1, r.width); W.vh = Math.max(1, r.height);
  W.cv.width = Math.round(W.vw * W.dpr); W.cv.height = Math.round(W.vh * W.dpr);
  const visW = W.vw < 720 ? 600 : WW;
  W.scale = Math.max(W.vw / visW, W.vh / WH);
}
function camUpdate() {
  const vwW = W.vw / W.scale, vhW = W.vh / W.scale;
  const tx = clamp(W.p.x - vwW / 2, 0, Math.max(0, WW - vwW));
  const ty = clamp(W.p.y - vhW / 2, 0, Math.max(0, WH - vhW));
  W.camX = W.title ? (WW - vwW) / 2 : lerp(W.camX, tx, 0.15);
  W.camY = W.title ? (WH - vhW) / 2 : lerp(W.camY, ty, 0.15);
}

/* ---------- input ---------- */
function onWorldPointer(e) {
  if (W.paused || modalOpen()) return;
  audioCtx();
  const r = W.cv.getBoundingClientRect();
  const wx = (e.clientX - r.left) / W.scale + W.camX, wy = (e.clientY - r.top) / W.scale + W.camY;
  let hit = null, best = 1e9;
  for (const s of SPOTS) {
    const d = Math.hypot(wx - s.x, wy - s.y);
    if (d < s.r + 24 && d < best) { best = d; hit = s; }
  }
  if (!hit) { // clicking an object body also counts
    const obj = [["patient", 300, 96, 120, 230], ["cart", 598, 100, 86, 74], ["sink", 786, 60, 88, 60], ["bins", 896, 100, 48, 58], ["chart", 690, 436, 100, 40], ["emr", 800, 436, 100, 40], ["ci", 530, 440, 40, 50]];
    for (const [id, x, y, w, h] of obj) if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) hit = SPOTS.find((s) => s.id === id);
  }
  if (hit) {
    if (Math.hypot(W.p.x - hit.x, W.p.y - hit.y) < hit.r) { interact(hit.id); return; }
    W.p.target = { x: hit.x, y: hit.y }; W.p.pending = hit.id;
  } else {
    W.p.target = { x: clamp(wx, 20, WW - 20), y: clamp(wy, 108, WH - 20) }; W.p.pending = null;
  }
  W.p.stuck = 0;
}
function interactNearest() { if (W.near) interact(W.near.id); }

function collide(x, y, r) {
  if (x < 18 || x > WW - 18 || y < 106 || y > WH - 20) return true;
  for (const [sx, sy, sw, sh] of SOLIDS) {
    const cx = clamp(x, sx, sx + sw), cy = clamp(y, sy, sy + sh);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}

function updateWorld(dt) {
  W.t += dt;
  const p = W.p;
  let mx = 0, my = 0;
  if (!W.paused && !modalOpen()) {
    const k = W.keys;
    if (k["arrowleft"] || k["a"]) mx -= 1;
    if (k["arrowright"] || k["d"]) mx += 1;
    if (k["arrowup"] || k["w"]) my -= 1;
    if (k["arrowdown"] || k["s"]) my += 1;
    if (W.joy.on) { mx = W.joy.x; my = W.joy.y; }
    if (mx || my) { p.target = null; p.pending = null; }
    else if (p.target) {
      const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx, dy);
      const arriveR = p.pending ? (SPOTS.find((s) => s.id === p.pending).r * 0.55) : 6;
      if (d < arriveR) {
        const id = p.pending; p.target = null; p.pending = null;
        if (id) interact(id);
      } else { mx = dx / d; my = dy / d; }
    }
  }
  const len = Math.hypot(mx, my);
  p.moving = len > 0.05;
  if (p.moving) {
    const sp = 175 * Math.min(1, len);
    const vx = (mx / len) * sp * dt, vy = (my / len) * sp * dt;
    const ox = p.x, oy = p.y;
    if (!collide(p.x + vx, p.y, 13)) p.x += vx;
    if (!collide(p.x, p.y + vy, 13)) p.y += vy;
    const moved = Math.hypot(p.x - ox, p.y - oy);
    if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? "right" : "left"; else p.dir = my > 0 ? "down" : "up";
    p.walkT += dt * 11;
    p.stepAcc += moved;
    if (p.stepAcc > 34) { p.stepAcc = 0; sfx("step"); }
    W.dist += moved;
    if (G && !G.over && !W.title) { G.clock += moved / 150; } // walking costs ward time
    if (p.target && moved < 0.3) { p.stuck += dt; if (p.stuck > 0.4) { p.target = null; p.pending = null; } } else p.stuck = 0;
  }
  // nearest interactable
  let near = null, best = 1e9;
  for (const s of SPOTS) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < s.r && d < best) { best = d; near = s; }
  }
  W.near = near;
  if (!W.paused && !modalOpen() && (W.keys["e"] || W.keys[" "] || W.keys["enter"])) {
    W.keys["e"] = W.keys[" "] = W.keys["enter"] = false;
    interactNearest();
  }
  // equipment animation easing
  if (G) {
    const target = G.sideLying ? 20 : G.hob;
    const prev = W.hobShown;
    W.hobShown += clamp(target - W.hobShown, -40 * dt, 40 * dt);
    if (Math.abs(prev - W.hobShown) > 0.01 && Math.random() < 0.05) sfx("motor");
    G.curtain += clamp(G.curtainTarget - G.curtain, -1.4 * dt, 1.4 * dt);
  }
  W.sinkRun = Math.max(0, W.sinkRun - dt);
  W.binOpen = Math.max(0, W.binOpen - dt);
  W.cartOpen = Math.max(0, W.cartOpen - dt);
  if (W.bubble && W.bubble.until < W.t) W.bubble = null;
  if (G && !G.over && !W.title && !W.paused) updateHud();
}

/* ---------- drawing helpers ---------- */
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function shadow(ctx, x, y, rx, ry, a = 0.18) { ctx.fillStyle = `rgba(20,45,45,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

function buildFloor() {
  const c = document.createElement("canvas"); c.width = WW; c.height = WH;
  const x = c.getContext("2d");
  // vinyl tiles
  const ts = 48;
  for (let ty = 0; ty < WH; ty += ts) for (let tx = 0; tx < WW; tx += ts) {
    const alt = ((tx + ty) / ts) % 2 === 0;
    x.fillStyle = alt ? "#d7e4e1" : "#cfdeda"; x.fillRect(tx, ty, ts, ts);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(90,120,115,${0.06 + Math.random() * 0.05})`; x.fillRect(tx + Math.random() * ts, ty + Math.random() * ts, 2, 2); }
  }
  x.strokeStyle = "rgba(120,150,145,.35)"; x.lineWidth = 1;
  for (let i = 0; i <= WW; i += ts) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, WH); x.stroke(); }
  for (let i = 0; i <= WH; i += ts) { x.beginPath(); x.moveTo(0, i + .5); x.lineTo(WW, i + .5); x.stroke(); }
  // sheen
  const g = x.createLinearGradient(0, 0, WW, WH); g.addColorStop(0, "rgba(255,255,255,.14)"); g.addColorStop(.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.08)");
  x.fillStyle = g; x.fillRect(0, 0, WW, WH);
  // door mat + floor decal
  x.fillStyle = "#6f8582"; rr(x, 512, 556, 96, 34, 6); x.fill();
  x.fillStyle = "rgba(122,79,214,.16)"; x.font = "700 64px 'Barlow Condensed', sans-serif"; x.textAlign = "center"; x.fillText("WARD 7", 560, 395);
  // aspiration-precaution floor arrow near bed
  x.strokeStyle = "rgba(122,79,214,.28)"; x.lineWidth = 3; x.setLineDash([8, 7]); x.strokeRect(262, 96, 232, 284); x.setLineDash([]);
  // walls
  const wg = x.createLinearGradient(0, 0, 0, 84); wg.addColorStop(0, "#a9cbc4"); wg.addColorStop(1, "#bcd8d1");
  x.fillStyle = wg; x.fillRect(0, 0, WW, 84);
  x.fillStyle = "#7a9e97"; x.fillRect(0, 84, WW, 8);
  x.fillStyle = "#5f827b"; x.fillRect(0, 91, WW, 2);
  x.fillStyle = "#94b7b0"; x.fillRect(0, 0, 10, WH); x.fillRect(WW - 10, 0, 10, WH);
  x.fillStyle = "#94b7b0"; x.fillRect(0, WH - 10, 512, 10); x.fillRect(608, WH - 10, WW - 608, 10);
  // window
  x.fillStyle = "#e9f1f0"; rr(x, 52, 10, 176, 66, 4); x.fill();
  const sky = x.createLinearGradient(0, 14, 0, 72); sky.addColorStop(0, "#7cc1ea"); sky.addColorStop(1, "#c7e6f5");
  x.fillStyle = sky; x.fillRect(58, 16, 164, 54);
  // headwall
  x.fillStyle = "#e4eeec"; rr(x, 290, 10, 140, 70, 6); x.fill();
  x.fillStyle = "#2fae6c"; x.beginPath(); x.arc(312, 34, 7, 0, Math.PI * 2); x.fill(); // O2
  x.fillStyle = "#f4f4f4"; x.strokeStyle = "#889"; x.beginPath(); x.arc(334, 34, 7, 0, Math.PI * 2); x.fill(); x.stroke(); // suction
  x.fillStyle = "#c0392b"; rr(x, 350, 27, 18, 14, 3); x.fill(); // call light
  x.fillStyle = "#27484a"; x.font = "700 8px 'JetBrains Mono', monospace"; x.textAlign = "left"; x.fillText("O2   VAC  CALL", 304, 56);
  // sign: aspiration precautions
  x.fillStyle = "#7a4fd6"; rr(x, 296, 62, 128, 14, 3); x.fill();
  x.fillStyle = "#fff"; x.font = "700 9px 'Barlow Condensed', sans-serif"; x.textAlign = "center"; x.fillText("ASPIRATION PRECAUTIONS · HOB ≥ 30°", 360, 72.5);
  // hand hygiene poster
  x.fillStyle = "#fff"; rr(x, 700, 14, 66, 58, 3); x.fill();
  x.fillStyle = "#3a8fbf"; x.fillRect(700, 14, 66, 12);
  x.fillStyle = "#fff"; x.font = "700 8px 'Barlow Condensed', sans-serif"; x.fillText("5 MOMENTS", 733, 23);
  x.fillStyle = "#3a8fbf"; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(712 + i * 10.5, 40, 4, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = "#678"; for (let i = 0; i < 3; i++) x.fillRect(708, 52 + i * 6, 50, 2);
  // paper towel + soap
  x.fillStyle = "#f6f8f8"; rr(x, 880, 20, 34, 40, 4); x.fill(); x.fillStyle = "#c8d3d3"; x.fillRect(886, 52, 22, 6);
  x.fillStyle = "#e9eef0"; rr(x, 794, 22, 16, 30, 3); x.fill(); x.fillStyle = "#3a8fbf"; x.fillRect(797, 30, 10, 12);
  // door
  x.fillStyle = "#8a6e52"; x.fillRect(512, WH - 10, 96, 10);
  return c;
}

/* ---------- draw ---------- */
function drawWorld() {
  const ctx = W.ctx;
  camUpdate();
  ctx.setTransform(W.dpr, 0, 0, W.dpr, 0, 0);
  ctx.fillStyle = "#0a1d1e"; ctx.fillRect(0, 0, W.vw, W.vh);
  ctx.setTransform(W.dpr * W.scale, 0, 0, W.dpr * W.scale, -W.camX * W.scale * W.dpr, -W.camY * W.scale * W.dpr);
  ctx.drawImage(W.floor, 0, 0);
  drawWallDynamic(ctx);

  const list = [
    [148, drawCabinet], [258, drawChair], [174, drawCart], [118, drawSink], [158, drawBins],
    [142, drawIVPole], [292, drawTable], [330, drawBed], [476, drawDesk], [550, drawBed4], [136, drawPlant],
    [W.ci.y + 30, drawCI], [W.p.y + 14, drawPlayer],
  ];
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn(ctx);
  drawCurtain(ctx);
  drawPrompt(ctx);
  if (W.bubble) drawBubble(ctx, 360, 112 + (1 - Math.cos(W.hobShown * Math.PI / 180)) * 30, W.bubble.text);
}

function drawWallDynamic(ctx) {
  const t = W.t;
  // cloud drifting in window
  ctx.save(); ctx.beginPath(); ctx.rect(58, 16, 164, 54); ctx.clip();
  const cx = 40 + ((t * 6) % 240);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  [[0, 0, 12], [12, -4, 14], [26, 0, 11]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx, 38 + dy, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
  // blinds
  ctx.fillStyle = "rgba(240,245,244,.85)";
  for (let i = 0; i < 5; i++) ctx.fillRect(58, 16 + i * 4, 164, 2.4);
  ctx.fillStyle = "#c4d2d0"; ctx.fillRect(138, 10, 4, 66);
  // wall clock showing ward time
  const m = G ? G.clock : START_MIN + t / 3;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#27484a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(255, 42, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.4; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(255 + Math.sin(a) * 15, 42 - Math.cos(a) * 15); ctx.lineTo(255 + Math.sin(a) * 17.5, 42 - Math.cos(a) * 17.5); ctx.stroke(); }
  const hA = ((m / 60) % 12) / 12 * Math.PI * 2, mA = (m % 60) / 60 * Math.PI * 2;
  ctx.lineCap = "round"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(255, 42); ctx.lineTo(255 + Math.sin(hA) * 9, 42 - Math.cos(hA) * 9); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(255, 42); ctx.lineTo(255 + Math.sin(mA) * 14, 42 - Math.cos(mA) * 14); ctx.stroke();
  ctx.strokeStyle = "#e0464b"; ctx.lineWidth = 1; const sA = (t % 60) / 60 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(255, 42); ctx.lineTo(255 + Math.sin(sA) * 16, 42 - Math.cos(sA) * 16); ctx.stroke();
  ctx.lineCap = "butt";
  // vital signs monitor
  ctx.fillStyle = "#1f2b2c"; rr(ctx, 438, 10, 96, 62, 6); ctx.fill();
  ctx.fillStyle = "#081414"; ctx.fillRect(443, 15, 86, 52);
  const v = G ? G.c.vitals : { hr: 76, spo2: 98 };
  ctx.strokeStyle = "#5ef59c"; ctx.lineWidth = 1.4; ctx.beginPath();
  for (let i = 0; i <= 56; i++) {
    const ph = ((i / 56) + t * 0.9) % 1, k = (ph * v.hr / 60 * 1.2) % 1;
    let y = 0; if (k > .40 && k < .44) y = -4; else if (k > .46 && k < .48) y = 3; else if (k > .48 && k < .51) y = -16; else if (k > .51 && k < .54) y = 6; else if (k > .62 && k < .70) y = -3;
    const px = 445 + i, py = 36 + y; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = "#5ef59c"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.textAlign = "right"; ctx.fillText(v.hr, 527, 28);
  ctx.fillStyle = "#6ad1ff"; ctx.fillText(v.spo2 + "%", 527, 62);
  ctx.strokeStyle = "#6ad1ff"; ctx.beginPath();
  for (let i = 0; i <= 50; i++) { const ph = ((i / 50) + t * 0.9) % 1; const py = 56 - Math.max(0, Math.sin(ph * Math.PI * 2 * 3)) * 6; i ? ctx.lineTo(445 + i, py) : ctx.moveTo(445, py); }
  ctx.stroke();
}

function drawPlant(ctx) {
  shadow(ctx, 42, 134, 18, 6);
  ctx.fillStyle = "#c27b4a"; rr(ctx, 30, 112, 24, 24, 4); ctx.fill();
  ctx.fillStyle = "#3f8f5a";
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.sin(W.t * .8 + i) * .05; ctx.beginPath(); ctx.ellipse(42 + Math.cos(a) * 10, 108 + Math.sin(a) * 8, 10, 5, a, 0, Math.PI * 2); ctx.fill(); }
}
function drawCabinet(ctx) {
  shadow(ctx, 261, 150, 28, 6);
  ctx.fillStyle = "#e6ecea"; rr(ctx, 236, 96, 50, 40, 4); ctx.fill();
  ctx.fillStyle = "#cfd9d6"; ctx.fillRect(236, 130, 50, 18);
  ctx.fillStyle = "#9fb0ad"; ctx.fillRect(254, 137, 14, 3);
  // water pitcher + cup
  ctx.fillStyle = "#bfe3f2"; rr(ctx, 244, 102, 14, 18, 3); ctx.fill(); ctx.strokeStyle = "#7fa9b8"; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(272, 112, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}
function drawChair(ctx) {
  shadow(ctx, 226, 260, 24, 6);
  ctx.fillStyle = "#5a7d9a"; rr(ctx, 206, 214, 40, 12, 4); ctx.fill();
  ctx.fillStyle = "#6f93b1"; rr(ctx, 206, 226, 40, 30, 5); ctx.fill();
  ctx.fillStyle = "#4b6a84"; ctx.fillRect(206, 254, 4, 6); ctx.fillRect(242, 254, 4, 6);
}
function drawCart(ctx) {
  const open = W.cartOpen > 0 ? 8 : 0;
  shadow(ctx, 641, 178, 46, 8);
  ctx.fillStyle = "#dfe6e8"; rr(ctx, 598, 100, 86, 40, 6); ctx.fill();
  ctx.strokeStyle = "#9aa9ad"; ctx.lineWidth = 2; ctx.stroke();
  // items on top
  ctx.fillStyle = "#8a63e0"; rr(ctx, 606, 106, 18, 12, 3); ctx.fill();             // glove box
  ctx.fillStyle = "#fff"; rr(ctx, 628, 106, 20, 12, 2); ctx.fill(); ctx.fillStyle = "#3a8fbf"; ctx.fillRect(628, 110, 20, 3); // swabs
  ctx.fillStyle = "#c9d6dc"; ctx.beginPath(); ctx.ellipse(664, 114, 12, 7, 0, 0, Math.PI * 2); ctx.fill();  // basin
  ctx.fillStyle = "#fff"; rr(ctx, 606, 122, 8, 14, 2); ctx.fill(); ctx.fillStyle = "#3a8fbf"; rr(ctx, 616, 122, 8, 14, 2); ctx.fill(); ctx.fillStyle = "#2fae6c"; rr(ctx, 626, 122, 8, 14, 2); ctx.fill(); // formula
  // drawers (front face)
  const cols = ["#7a4fd6", "#3a8fbf", "#2fae6c"];
  for (let i = 0; i < 3; i++) {
    const oy = i === 1 ? open : 0;
    ctx.fillStyle = "#cbd5d8"; ctx.fillRect(598, 140 + i * 11 + oy, 86, 11);
    ctx.fillStyle = cols[i]; ctx.fillRect(632, 144 + i * 11 + oy, 18, 3);
    ctx.strokeStyle = "#9aa9ad"; ctx.lineWidth = 1; ctx.strokeRect(598.5, 140.5 + i * 11 + oy, 85, 10);
  }
  ctx.fillStyle = "#334"; [[602, 174], [680, 174]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "#27484a"; ctx.font = "700 9px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.fillText("ENTERAL SUPPLIES", 641, 96);
}
function drawSink(ctx) {
  shadow(ctx, 830, 120, 44, 6);
  ctx.fillStyle = "#f3f6f6"; rr(ctx, 786, 84, 88, 34, 8); ctx.fill(); ctx.strokeStyle = "#a8b6b6"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#d4e0e2"; ctx.beginPath(); ctx.ellipse(830, 101, 32, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9aa9ad"; rr(ctx, 826, 76, 8, 16, 3); ctx.fill(); // faucet
  ctx.fillStyle = "#7d8d90"; ctx.fillRect(812, 80, 10, 4); ctx.fillRect(838, 80, 10, 4); // elbow levers
  if (W.sinkRun > 0) {
    ctx.strokeStyle = "rgba(120,190,230,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(830, 92); ctx.lineTo(830 + Math.sin(W.t * 30) * .6, 102); ctx.stroke();
    for (let i = 0; i < 9; i++) { const a = W.t * 2 + i; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = "rgba(150,200,230,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(818 + (i * 7) % 26 + Math.sin(a) * 2, 98 + Math.cos(a * 1.3) * 3 - ((W.t * 10 + i * 5) % 12), 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
}
function drawBins(ctx) {
  const lid = W.binOpen > 0 ? 8 : 0;
  shadow(ctx, 920, 160, 28, 6);
  ctx.fillStyle = "#e7c14a"; rr(ctx, 896, 108, 22, 48, 4); ctx.fill();
  ctx.fillStyle = "#2b2f30"; rr(ctx, 922, 108, 22, 48, 4); ctx.fill();
  ctx.fillStyle = "#c49d2a"; rr(ctx, 895, 102 - lid, 24, 8, 3); ctx.fill();
  ctx.fillStyle = "#151819"; rr(ctx, 921, 102, 24, 8, 3); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "700 7px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center";
  ctx.fillText("INF", 907, 136); ctx.fillText("GEN", 933, 136);
}
function drawIVPole(ctx) {
  const x = 446, y = 128;
  shadow(ctx, x, y + 12, 16, 5);
  ctx.strokeStyle = "#7d8d90"; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + Math.cos(a) * 12, y + 6 + Math.sin(a) * 6); ctx.stroke(); }
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 12, y - 46); ctx.lineTo(x + 12, y - 46); ctx.stroke();
  // spare calibrated enteral feeding bag (closed system) + drip chamber
  ctx.fillStyle = "rgba(245,240,255,.95)"; rr(ctx, x - 20, y - 44, 15, 22, 4); ctx.fill(); ctx.strokeStyle = "#7a4fd6"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#7a4fd6"; ctx.font = "700 4px monospace"; ctx.textAlign = "center"; ctx.fillText("FEED", x - 12.5, y - 32);
  ctx.fillStyle = "rgba(230,245,250,.95)"; rr(ctx, x - 15, y - 21, 5, 9, 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(122,79,214,.7)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 12.5, y - 12); ctx.quadraticCurveTo(x - 16, y - 2, x - 6, y - 2); ctx.stroke();
  // pump
  ctx.fillStyle = "#e9eef0"; rr(ctx, x + 2, y - 30, 16, 20, 3); ctx.fill(); ctx.strokeStyle = "#9aa9ad"; ctx.stroke();
  ctx.fillStyle = "#183b3c"; ctx.fillRect(x + 4, y - 27, 12, 7); ctx.fillStyle = "#7ef0b0"; ctx.font = "700 5px monospace"; ctx.fillText("OFF", x + 10, y - 22);
}
function drawTable(ctx) {
  shadow(ctx, 460, 290, 32, 6);
  ctx.fillStyle = "#c8b49a"; rr(ctx, 432, 244, 56, 34, 5); ctx.fill();
  ctx.fillStyle = "#b39d82"; ctx.fillRect(432, 276, 56, 6);
  ctx.fillStyle = "#7d8d90"; ctx.fillRect(482, 282, 4, 10);
  if (G && G.tray.size) { // equipment laid out on the overbed table
    ctx.fillStyle = "#c9d6dc"; ctx.beginPath(); ctx.ellipse(446, 258, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (G.tray.has("measure")) { ctx.fillStyle = "#eef6f8"; rr(ctx, 460, 248, 9, 12, 2); ctx.fill(); ctx.fillStyle = G.cupGastric > 0 ? "#c9c46a" : "#eef6f8"; ctx.fillRect(461, 255, 7, 4); }
    if (G.formulaKey) { ctx.fillStyle = FORMULA_COL[formulaKind(G.formulaKey)]; rr(ctx, 473, 248, 8, 13, 2); ctx.fill(); }
    if (G.tray.has("water")) { ctx.fillStyle = "#8fd0ef"; rr(ctx, 440, 266, 8, 9, 2); ctx.fill(); }
    if (G.tray.has("ph")) { ctx.fillStyle = "#fff"; ctx.fillRect(452, 268, 16, 4); ctx.fillStyle = G.phStage ? phColor(G.c.ph) : "#f2e7a0"; ctx.fillRect(452, 268, 5, 4); }
  }
}
function drawBed(ctx) {
  const a = W.hobShown * Math.PI / 180, hinge = 196, back = 92 * Math.cos(a);
  const headY = hinge - back;
  shadow(ctx, 360, 318, 66, 12, .2);
  // frame
  ctx.fillStyle = "#93a3a8"; rr(ctx, 298, 94, 124, 234, 10); ctx.fill();
  ctx.fillStyle = "#53666b"; rr(ctx, 300, 90, 120, 12, 5); ctx.fill(); // headboard
  ctx.fillStyle = "#53666b"; rr(ctx, 300, 316, 120, 14, 5); ctx.fill(); // footboard
  ctx.fillStyle = "#fff"; rr(ctx, 336, 319, 48, 9, 2); ctx.fill();
  ctx.fillStyle = "#27484a"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("BED 3", 360, 326);
  // mattress lower part
  ctx.fillStyle = "#f4f7f7"; rr(ctx, 306, hinge - 2, 108, 316 - hinge, 6); ctx.fill();
  // raised backrest: shade by angle
  const sh = Math.round(244 - Math.sin(a) * 26);
  ctx.fillStyle = `rgb(${sh},${sh + 3},${sh + 3})`; rr(ctx, 306, headY, 108, back + 4, 6); ctx.fill();
  if (W.hobShown > 3) { ctx.fillStyle = "rgba(40,70,70,.18)"; ctx.fillRect(306, hinge - 1, 108, 5); }
  // pillow
  const sc = 1 + Math.sin(a) * .22;
  ctx.fillStyle = "#ffffff"; rr(ctx, 330, headY + 4, 60, 26 * Math.max(.55, Math.cos(a)) + 6, 8); ctx.fill(); ctx.strokeStyle = "#d5dfdf"; ctx.lineWidth = 1; ctx.stroke();
  // patient
  if (G || W.title) {
    const sex = G ? G.c.sex : "M";
    const breathe = Math.sin(W.t * 1.6) * 1.2;
    const hx = 360 + (G && G.sideLying ? 6 : 0), hy = headY + 18 * sc;
    // body under blanket
    ctx.fillStyle = "#7fa9d6"; rr(ctx, 318, hinge - 40 * Math.cos(a) + 14, 84, 316 - hinge + 40 * Math.cos(a) - 18, 14); ctx.fill();
    ctx.fillStyle = "#6a95c4"; for (let i = 0; i < 4; i++) ctx.fillRect(318, hinge + 30 + i * 22, 84, 3);
    // gown & shoulders
    ctx.fillStyle = "#dfeaf2"; ctx.beginPath(); ctx.ellipse(hx, hy + 26 * sc + breathe * .3, 34 * sc, 15 * sc + breathe * .4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a9c3d8"; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(hx + i * 12 * sc, hy + 26 * sc, 1.6, 0, Math.PI * 2); ctx.fill(); }
    // arms on blanket
    ctx.fillStyle = "#e7b991"; rr(ctx, hx - 36 * sc, hy + 30 * sc, 10, 40, 5); ctx.fill(); rr(ctx, hx + 26 * sc, hy + 30 * sc, 10, 40, 5); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(hx + 26 * sc, hy + 56 * sc, 10, 4); // ID band
    // head
    ctx.fillStyle = "#e3b08a"; ctx.beginPath(); ctx.arc(hx, hy, 13 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sex === "F" ? "#bdbdbd" : "#8f8f8f";
    ctx.beginPath(); ctx.arc(hx, hy - 4 * sc, 13.5 * sc, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (sex === "F") { ctx.beginPath(); ctx.ellipse(hx - 13 * sc, hy + 3, 4 * sc, 9 * sc, .2, 0, Math.PI * 2); ctx.ellipse(hx + 13 * sc, hy + 3, 4 * sc, 9 * sc, -.2, 0, Math.PI * 2); ctx.fill(); }
    // eyes (blink)
    const blink = (W.t % 4.3) < .14;
    ctx.fillStyle = "#3b2a22"; ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 1.4;
    if (blink || (G && G.c.id === "c4" && Math.sin(W.t * .3) > .6)) { ctx.beginPath(); ctx.moveTo(hx - 7 * sc, hy); ctx.lineTo(hx - 3 * sc, hy); ctx.moveTo(hx + 3 * sc, hy); ctx.lineTo(hx + 7 * sc, hy); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(hx - 5 * sc, hy, 1.7, 0, Math.PI * 2); ctx.arc(hx + 5 * sc, hy, 1.7, 0, Math.PI * 2); ctx.fill(); }
    const pain = G && G.discomfort > .5;
    ctx.beginPath(); if (pain) { ctx.moveTo(hx - 4, hy + 7 * sc); ctx.quadraticCurveTo(hx, hy + 4 * sc, hx + 4, hy + 7 * sc); } else { ctx.moveTo(hx - 4, hy + 6 * sc); ctx.quadraticCurveTo(hx, hy + 8 * sc, hx + 4, hy + 6 * sc); } ctx.stroke();
    // NGT: tape on nose, tube to the right side of the pillow
    ctx.fillStyle = "#fff"; ctx.fillRect(hx - 2, hy + 1, 5, 4);
    const flowing = G && G.flowing;
    ctx.strokeStyle = "#e8d9a8"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(hx + 1, hy + 4); ctx.bezierCurveTo(hx + 18, hy + 6, hx + 30, hy + 2, hx + 44, hy + 12); ctx.lineTo(hx + 52, hy + 30); ctx.stroke();
    ctx.fillStyle = (G && G.syrOn) ? "#7a4fd6" : "#9b80e8"; ctx.beginPath(); ctx.arc(hx + 52, hy + 30, 3, 0, Math.PI * 2); ctx.fill();
    if (flowing) { ctx.fillStyle = "#7a4fd6"; for (let i = 0; i < 4; i++) { const k = ((W.t * .9 + i / 4) % 1); const px = lerp(hx + 52, hx + 1, k), py = lerp(hy + 30, hy + 4, k) + Math.sin(k * 3) * 4; ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill(); } }
    if (G && G.secured) { ctx.fillStyle = "#fff"; ctx.fillRect(hx + 30, hy + 20, 8, 5); }
    if (G && G.sideLying) { ctx.fillStyle = "rgba(255,255,255,.8)"; rr(ctx, 312, hinge - 20, 16, 50, 6); ctx.fill(); }
  }
  // side rails
  ctx.strokeStyle = "#6f8085"; ctx.lineWidth = 3;
  [[302, 0], [418, 0]].forEach(([x]) => { ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x, 230); ctx.stroke(); });
  ctx.lineWidth = 1.2; for (let y = 146; y < 230; y += 14) { ctx.beginPath(); ctx.moveTo(299, y); ctx.lineTo(305, y); ctx.moveTo(415, y); ctx.lineTo(421, y); ctx.stroke(); }
  // HOB angle tag
  ctx.fillStyle = "rgba(15,31,30,.82)"; rr(ctx, 382, 332, 54, 16, 4); ctx.fill();
  ctx.fillStyle = W.hobShown >= 29.5 || (G && G.sideLying) ? "#7ef0b0" : "#ffb4b4"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText(G && G.sideLying ? "R-SIDE" : "HOB " + Math.round(W.hobShown) + "°", 409, 343.5);
}
function drawBed4(ctx) {
  shadow(ctx, 120, 545, 66, 10, .18);
  ctx.fillStyle = "#93a3a8"; rr(ctx, 54, 326, 132, 222, 10); ctx.fill();
  ctx.fillStyle = "#f4f7f7"; rr(ctx, 62, 336, 116, 204, 6); ctx.fill();
  ctx.fillStyle = "#fff"; rr(ctx, 92, 340, 56, 24, 8); ctx.fill();
  ctx.fillStyle = "#d9a37f"; ctx.beginPath(); ctx.arc(120, 354, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b3b3b"; ctx.beginPath(); ctx.arc(120, 349, 12.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c6a6d8"; rr(ctx, 66, 368, 108, 168, 12); ctx.fill();
  ctx.fillStyle = "#b391c9"; for (let i = 0; i < 5; i++) ctx.fillRect(66, 384 + i * 30, 108, 3);
  ctx.strokeStyle = "#3b2a22"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(113, 355); ctx.lineTo(117, 355); ctx.moveTo(123, 355); ctx.lineTo(127, 355); ctx.stroke();
  // z's
  ctx.fillStyle = "rgba(39,72,74,.6)"; ctx.font = "700 12px 'Barlow Condensed', sans-serif"; ctx.textAlign = "left";
  for (let i = 0; i < 3; i++) { const k = (W.t * .4 + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.fillText("z", 134 + k * 20, 344 - k * 30); }
  ctx.globalAlpha = 1;
  // half-drawn curtain
  ctx.strokeStyle = "#9cc9b9"; ctx.lineWidth = 7; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(196, 326); ctx.lineTo(196, 420); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#53666b"; rr(ctx, 54, 538, 132, 12, 5); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("BED 4", 120, 546.5);
}
function drawDesk(ctx) {
  shadow(ctx, 815, 478, 128, 8, .15);
  ctx.fillStyle = "#b9a184"; rr(ctx, 690, 436, 250, 40, 4); ctx.fill(); rr(ctx, 900, 436, 40, 124, 4); ctx.fill();
  ctx.fillStyle = "#a58d70"; ctx.fillRect(690, 470, 210, 6);
  // chart rack with red binder (Mr/Mrs chart)
  ctx.fillStyle = "#7d8d90"; ctx.fillRect(712, 440, 46, 26);
  const cols = ["#c0392b", "#3a8fbf", "#2fae6c", "#e9a93a"];
  cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(715 + i * 11, 442, 9, 22); });
  ctx.fillStyle = "#fff"; ctx.fillRect(716, 446, 7, 5);
  // computer
  ctx.fillStyle = "#26363a"; rr(ctx, 826, 438, 52, 30, 3); ctx.fill();
  ctx.fillStyle = "#0e2a2b"; ctx.fillRect(829, 441, 46, 22);
  ctx.fillStyle = "#7ef0b0"; ctx.font = "700 5px monospace"; ctx.textAlign = "left"; ctx.fillText("NURSE'S NOTES", 832, 449);
  ctx.fillStyle = "#9cc"; for (let i = 0; i < 3; i++) ctx.fillRect(832, 452 + i * 3.5, 30 - i * 6, 1.6);
  if ((W.t % 1) < .5) { ctx.fillStyle = "#7ef0b0"; ctx.fillRect(832 + 30 - 12, 459, 3, 2); }
  ctx.fillStyle = "#3b4b4f"; ctx.fillRect(846, 468, 12, 4);
  ctx.fillStyle = "#e9eef0"; rr(ctx, 790, 444, 28, 14, 2); ctx.fill(); // keyboard-ish clipboard
  ctx.fillStyle = "#5a7d9a"; ctx.beginPath(); ctx.arc(860, 500, 14, 0, Math.PI * 2); ctx.fill(); // chair
}
function drawCurtain(ctx) {
  if (!G && !W.title) return;
  const k = G ? G.curtain : 0;
  // ceiling rail
  ctx.strokeStyle = "rgba(90,110,115,.55)"; ctx.lineWidth = 2;
  ctx.beginPath(); RAIL.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  const len = Math.max(26, k * RAIL_LEN);
  // walk the rail drawing a pleated band
  ctx.lineCap = "round";
  let acc = 0;
  for (let s = 0; s < RAIL.length - 1; s++) {
    const [x1, y1] = RAIL[s], [x2, y2] = RAIL[s + 1], segL = Math.hypot(x2 - x1, y2 - y1);
    const take = clamp(len - acc, 0, segL);
    if (take <= 0) break;
    const steps = Math.ceil(take / 6);
    for (let i = 0; i < steps; i++) {
      const t0 = (i * 6) / segL, t1 = Math.min(take, (i + 1) * 6) / segL;
      ctx.strokeStyle = i % 2 ? "rgba(150,205,186,.95)" : "rgba(126,186,165,.95)";
      ctx.lineWidth = k < .1 ? 12 : 8;
      ctx.beginPath(); ctx.moveTo(lerp(x1, x2, t0), lerp(y1, y2, t0)); ctx.lineTo(lerp(x1, x2, t1), lerp(y1, y2, t1)); ctx.stroke();
    }
    acc += segL;
  }
  ctx.lineCap = "butt";
}
function drawCI(ctx) {
  const x = W.ci.x, y = W.ci.y;
  shadow(ctx, x, y + 30, 14, 5);
  ctx.fillStyle = "#2c3e50"; ctx.fillRect(x - 7, y + 14, 6, 14); ctx.fillRect(x + 1, y + 14, 6, 14);
  ctx.fillStyle = "#f3f6f6"; rr(ctx, x - 12, y - 6, 24, 24, 6); ctx.fill(); ctx.strokeStyle = "#8aa"; ctx.lineWidth = 1; ctx.stroke(); // white coat
  ctx.fillStyle = "#7a4fd6"; ctx.fillRect(x - 12, y + 2, 24, 3);
  ctx.fillStyle = "#c58c6a"; ctx.beginPath(); ctx.arc(x, y - 14, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2b1d16"; ctx.beginPath(); ctx.arc(x, y - 17, 10.5, Math.PI * .95, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(x - 3.5, y - 13, 1.4, 0, Math.PI * 2); ctx.arc(x + 3.5, y - 13, 1.4, 0, Math.PI * 2); ctx.fill();
  // clipboard + writing hand
  ctx.fillStyle = "#b9a184"; ctx.fillRect(x + 6, y + 2, 12, 15); ctx.fillStyle = "#fff"; ctx.fillRect(x + 8, y + 5, 8, 10);
  const wr = Math.sin(W.t * 6) * 2; ctx.fillStyle = "#333"; ctx.fillRect(x + 10 + wr, y + 8, 4, 1);
  ctx.fillStyle = "rgba(15,31,30,.82)"; rr(ctx, x - 14, y - 38, 28, 12, 3); ctx.fill();
  ctx.fillStyle = "#e6f1ef"; ctx.font = "700 8px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.fillText("CI", x, y - 29);
}
function drawPlayer(ctx) {
  const p = W.p, x = p.x, y = p.y;
  const sw = p.moving ? Math.sin(p.walkT) : 0, bob = p.moving ? Math.abs(Math.sin(p.walkT)) * 1.6 : Math.sin(W.t * 2) * .4;
  shadow(ctx, x, y + 14, 13, 5, .22);
  const gl = G && G.gloves;
  // legs
  ctx.fillStyle = "#e9eef0"; ctx.strokeStyle = "#71878b"; ctx.lineWidth = 1;
  if (p.dir === "left" || p.dir === "right") {
    rr(ctx, x - 4 + sw * 4, y + 2, 6, 12, 2); ctx.fill(); ctx.stroke(); rr(ctx, x - 2 - sw * 4, y + 2, 6, 12, 2); ctx.fill(); ctx.stroke();
  } else {
    rr(ctx, x - 7, y + 2 - sw * 2, 6, 12, 2); ctx.fill(); ctx.stroke(); rr(ctx, x + 1, y + 2 + sw * 2, 6, 12, 2); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#f7f7f7"; ctx.fillRect(x - 7, y + 12 - (p.dir === "up" || p.dir === "down" ? sw * 2 : 0), 6, 3); ctx.fillRect(x + 1, y + 12 + (p.dir === "up" || p.dir === "down" ? sw * 2 : 0), 6, 3);
  const by = y - bob;
  // body: white student uniform with teal trim
  ctx.fillStyle = "#fbfdfd"; rr(ctx, x - 11, by - 14, 22, 20, 7); ctx.fill(); ctx.strokeStyle = "#71878b"; ctx.stroke();
  ctx.fillStyle = "#1f7a7a"; ctx.fillRect(x - 11, by + 2, 22, 2.5);
  if (p.dir !== "up") { ctx.fillStyle = "#1f7a7a"; ctx.beginPath(); ctx.moveTo(x - 5, by - 14); ctx.lineTo(x, by - 9); ctx.lineTo(x + 5, by - 14); ctx.fill(); ctx.fillStyle = "#7a4fd6"; ctx.fillRect(x + 4, by - 8, 4, 5); }
  // arms
  const armC = gl ? "#8a63e0" : "#e0ae88";
  ctx.fillStyle = "#fbfdfd";
  const carrying = G && G.tray.size > 0 && !W.paused;
  if (p.dir === "left" || p.dir === "right") {
    const s = p.dir === "right" ? 1 : -1;
    rr(ctx, x - 3 + s * (carrying ? 6 : sw * 5), by - 10, 6, 13, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = armC; ctx.beginPath(); ctx.arc(x + s * (carrying ? 9 : sw * 5), by + 4, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    rr(ctx, x - 15, by - 11 + (carrying ? 0 : sw * 3), 6, 13, 3); ctx.fill(); ctx.stroke(); rr(ctx, x + 9, by - 11 - (carrying ? 0 : sw * 3), 6, 13, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = armC; ctx.beginPath(); ctx.arc(x - 12, by + 3 + (carrying ? 0 : sw * 3), 3, 0, Math.PI * 2); ctx.arc(x + 12, by + 3 - (carrying ? 0 : sw * 3), 3, 0, Math.PI * 2); ctx.fill();
  }
  // carried kidney tray
  if (carrying && p.dir !== "up") {
    const tx = p.dir === "left" ? x - 12 : p.dir === "right" ? x + 12 : x;
    ctx.fillStyle = "#c9d6dc"; ctx.beginPath(); ctx.ellipse(tx, by + 5, 11, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#7d9aa3"; ctx.stroke();
    ctx.fillStyle = "#7a4fd6"; ctx.fillRect(tx - 7, by + 2, 9, 2.5); ctx.fillStyle = "#fff"; ctx.fillRect(tx + 2, by + 1, 4, 5);
  }
  // head
  const hy = by - 24;
  ctx.fillStyle = "#e0ae88"; ctx.beginPath(); ctx.arc(x, hy, 10.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2b1d16";
  if (p.dir === "up") { ctx.beginPath(); ctx.arc(x, hy, 11, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x, hy + 6, 5, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.beginPath(); ctx.arc(x, hy - 3, 11, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    const ex = p.dir === "left" ? -3 : p.dir === "right" ? 3 : 0;
    if (p.dir === "left") { ctx.beginPath(); ctx.arc(x + 8, hy, 5, 0, Math.PI * 2); ctx.fill(); }
    if (p.dir === "right") { ctx.beginPath(); ctx.arc(x - 8, hy, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#1b1b1b";
    const blink = (W.t % 3.7) < .12;
    if (blink) { ctx.fillRect(x - 5 + ex, hy + 1, 3, 1); ctx.fillRect(x + 2 + ex, hy + 1, 3, 1); }
    else { ctx.beginPath(); ctx.arc(x - 3.5 + ex, hy + 1, 1.4, 0, Math.PI * 2); ctx.arc(x + 3.5 + ex, hy + 1, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "rgba(220,110,110,.35)"; ctx.beginPath(); ctx.arc(x - 6 + ex, hy + 4, 2, 0, Math.PI * 2); ctx.arc(x + 6 + ex, hy + 4, 2, 0, Math.PI * 2); ctx.fill();
  }
  // nursing cap
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#8aa"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 8, hy - 8); ctx.lineTo(x + 8, hy - 8); ctx.lineTo(x + 6, hy - 14); ctx.lineTo(x - 6, hy - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1f7a7a"; ctx.fillRect(x - 6, hy - 12, 12, 1.6);
  if (W.p.busy > W.t) { // busy ring
    const k = 1 - (W.p.busy - W.t) / 1.2;
    ctx.strokeStyle = "#7a4fd6"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, hy - 26, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(k, 0, 1)); ctx.stroke();
  }
}
function drawPrompt(ctx) {
  const n = W.near;
  if (!n || W.paused || W.title || modalOpen()) return;
  const label = n.id === "patient" ? (G ? G.c.short : "Patient") : n.label;
  ctx.font = "700 13px 'Atkinson Hyperlegible', sans-serif";
  const w = ctx.measureText(label).width + 36, x = n.x - w / 2, y = n.y - n.r - 6 + Math.sin(W.t * 4) * 2 - (n.id === "patient" ? 10 : 0);
  ctx.fillStyle = "rgba(13,38,39,.92)"; rr(ctx, x, y - 20, w, 24, 6); ctx.fill();
  ctx.strokeStyle = "#b9a0ff"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#7a4fd6"; rr(ctx, x + 5, y - 16, 17, 16, 3); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "700 11px 'JetBrains Mono', monospace"; ctx.fillText("E", x + 13.5, y - 4);
  ctx.textAlign = "left"; ctx.font = "700 13px 'Atkinson Hyperlegible', sans-serif"; ctx.fillStyle = "#e6f1ef"; ctx.fillText(label, x + 28, y - 3.5);
}
function drawBubble(ctx, x, y, text) {
  ctx.font = "700 12px 'Atkinson Hyperlegible', sans-serif";
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { if (ctx.measureText(cur + " " + w).width > 170 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
  lines.push(cur);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18, h = lines.length * 15 + 10;
  const bx = clamp(x - w / 2, 14, WW - w - 14), by = Math.max(4, y - h - 14);
  ctx.fillStyle = "#fff"; rr(ctx, bx, by, w, h, 8); ctx.fill(); ctx.strokeStyle = "#7a4fd6"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, by + h); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 6, by + h); ctx.fill();
  ctx.fillStyle = "#10201f"; ctx.textAlign = "left"; lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 17 + i * 15));
}
function say(text, secs = 4) { W.bubble = { text, until: W.t + secs }; }
function busy(sec = 1.2) { W.p.busy = W.t + sec; }
