/* ================= UI: HUD, modals, stations, scoring, screens ================= */
const WHY = {
  a_order: "Before a tube feeding, determine the type, amount and frequency ordered.",
  a_tol: "Tolerance of previous feedings tells you whether to proceed, slow down, or report.",
  a_nutri: "Signs of malnutrition or dehydration are the baseline you evaluate the feeding against.",
  a_allergy: "Check allergies and intolerances against the formula; notify the provider if incompatible.",
  p_equip: "Preparing everything first keeps the procedure efficient and uninterrupted.",
  p_position: "Fowler's position uses gravity and prevents aspiration of fluid into the lungs.",
  p_identify: "Two identifiers prevent giving a feeding to the wrong client.",
  p_explain: "Explaining what, why and how to participate reduces anxiety; it may feel full but should not hurt.",
  p_hh: "Hand hygiene before the procedure prevents cross-infection.",
  p_gloves: "Clean gloves protect you from body fluids.",
  p_privacy: "Tube feedings are embarrassing to some people.",
  i_placement: "Aspirate and check pH before every feeding; a misplaced tube risks aspiration.",
  i_medwait: "Medication can alter gastric pH. Allow 1 hour before testing.",
  i_residual: "Measure the residual, act per policy, and re-instill the contents.",
  i_hold: "High residual or pH 6 or higher: hold the feeding and notify per agency policy.",
  i_expiry: "Check the expiration date of the feeding.",
  i_temp: "Room-temperature feeding prevents cramping.",
  i_swab: "Clean the top of the container with alcohol before opening (open system).",
  i_connect: "Connect the barrel to a pinched or clamped tube to keep air out.",
  i_flow: "Let it flow slowly; raise or lower the syringe; pause for discomfort.",
  i_flush: "Flush 50 to 100 mL water before the feeding drains from the neck.",
  i_clamp: "Clamp before all of the water is instilled, then plug the tube.",
  i_secure: "Securing the tube to the gown prevents pulling and displacement.",
  i_upright: "Stay upright (or right side-lying, elevated) at least 30 minutes after.",
  i_dispose: "Dispose of equipment in the right bins.",
  i_glovesoff: "Remove and discard gloves after disposal.",
  i_hh2: "Hand hygiene after removing gloves.",
  e_eval: "Follow up: tolerance, bowel sounds, regurgitation/fullness, weight, elimination, turgor, urine.",
  d_feed: "Document the kind and amount of feeding.",
  d_water: "Document the water used to flush the tube.",
  d_dur: "Document the duration of the feeding.",
  d_assess: "Document your assessments of the client.",
  d_io: "Record the feeding plus water on the intake and output record.",
  d_report: "Report significant deviations from normal to the primary care provider.",
};

/* ---------- toasts / log / HUD ---------- */
function toast(msg, kind = "ok") {
  const box = $("#toasts"); if (!box) return;
  const el = document.createElement("div"); el.className = "toast " + kind; el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 4200);
}
function renderLog() {
  const ol = $("#log"); if (!ol || !G) return;
  ol.innerHTML = G.log.slice(0, 60).map((l) => `<li class="${l.kind}"><time>${fmtClock(l.t)}</time>${esc(l.text)}</li>`).join("") || `<li class="info">Nothing yet. Your actions appear here.</li>`;
}
let hudTick = 0;
function updateHud() {
  if (!G) return;
  const now = performance.now(); if (now - hudTick < 200) return; hudTick = now;
  $("#hudClock").textContent = fmtClock(G.clock);
  if (G.mode === "practice" && !G.ciHidden) { $("#ciBar").hidden = false; $("#ciText").textContent = nextHint(); }
  else $("#ciBar").hidden = true;
}
function renderChecklist() {
  const pane = $("#pane-check"); if (!pane || !G) return;
  const items = CHECK.filter(needs);
  let next = null;
  for (const d of items) if (!G.items[d.id]) { next = d.id; break; }
  if (G.mode === "demo") {
    const done = items.filter((d) => G.items[d.id]);
    pane.innerHTML = `<p class="hidden-list">Return demonstration: the checklist is hidden. Steps you complete appear below.</p>` +
      `<div class="phase"><h3>Completed <span>${done.length}/${items.length}</span></h3>` +
      done.map((d) => `<div class="citem ${G.items[d.id].ok ? "done" : "err"}"><span class="dot"></span><span>${esc(d.label)}</span></div>`).join("") + `</div>`;
    return;
  }
  pane.innerHTML = PHASES.map((ph) => {
    const list = items.filter((d) => d.phase === ph);
    const n = list.filter((d) => G.items[d.id] && G.items[d.id].ok).length;
    return `<div class="phase"><h3>${ph}<span>${n}/${list.length}</span></h3>` + list.map((d) => {
      const st = G.items[d.id];
      const cls = st ? (st.ok ? "done" : "err") : d.id === next ? "next" : "";
      return `<div class="citem ${cls}"><span class="dot"></span><span>${esc(d.label)}</span></div>`;
    }).join("") + `</div>`;
  }).join("");
}
function renderTray() {
  const pane = $("#pane-tray"); if (!pane || !G) return;
  const list = [...G.tray].map((k) => {
    const s = SUPPLIES.find((x) => x.key === k);
    if (s) return `<div class="tray-item">${iconSvg(s.icon, 30)}<span>${esc(s.label)}</span></div>`;
    const f = G.c.cart.find((x) => x.key === k);
    return f ? `<div class="tray-item">${iconSvg("formula", 30, FORMULA_COL[formulaKind(k)])}<span>${esc(f.label)}<br><small class="mono">${esc(f.sub.split("· ").pop())}</small></span></div>` : "";
  });
  pane.innerHTML = list.length ? `<div class="tray-grid">${list.join("")}</div>` : `<p class="hidden-list">Your tray is empty. Gather equipment at the supply cart.</p>`;
  $("#trayCount").textContent = G.tray.size;
}

/* ---------- modal plumbing ---------- */
let MODAL = null;
function modalOpen() { return !$("#modal").hidden || !!$("#ciPop"); }
function openModal(title, eyebrow, html, opts = {}) {
  MODAL = opts;
  $("#modalTitle").textContent = title; $("#modalEyebrow").textContent = eyebrow || "";
  $("#modalBody").innerHTML = html;
  $(".sheet").classList.toggle("wide", !!opts.wide);
  $("#modal").hidden = false; W.keys = {};
  $("#modal").scrollTop = 0;
  setTimeout(() => { const f = $("#modalBody button, #modalBody input, #modalBody select"); if (f && !opts.noFocus) f.focus({ preventScroll: true }); }, 30);
}
function setModalBody(html) { $("#modalBody").innerHTML = html; }
function closeModal() {
  if ($("#modal").hidden) return;
  const k = MODAL && MODAL.kind;
  $("#modal").hidden = true; W.keys = {};
  if (k === "bedside") { P.open = false; P.prepOpen = false; }
  if (MODAL && MODAL.onClose) MODAL.onClose();
  MODAL = null;
  W.cv && W.cv.focus && W.cv.focus({ preventScroll: true });
}
function ciInterject(msg, why) {
  if ($("#ciPop")) $("#ciPop").remove();
  const el = document.createElement("div"); el.id = "ciPop"; el.className = "modal"; el.style.zIndex = 40;
  el.innerHTML = `<div class="sheet" role="alertdialog" aria-modal="true" style="max-width:520px"><header class="sheet-head"><div><div class="eyebrow" style="color:var(--crit)">Clinical Instructor stops you</div><h2>Patient safety first</h2></div></header>
    <div class="sheet-body"><p><b>${esc(msg)}</b></p><p class="note crit">${esc(why)}</p><p class="muted">In practice mode the unsafe step did not happen. Points were deducted. In a return demonstration this ends the demo.</p><div class="row"><button class="btn primary" type="button" id="ciOk">I understand</button></div></div></div>`;
  document.body.appendChild(el);
  $("#ciOk").focus();
  $("#ciOk").onclick = () => el.remove();
}

/* ---------- interaction dispatcher ---------- */
function interact(id) {
  if (!G || G.over || W.paused) return;
  audioCtx();
  W.p.target = null;
  const s = SPOTS.find((x) => x.id === id);
  if (s) { const dx = s.x - W.p.x, dy = s.y - W.p.y; /* face the station */ if (id === "patient") W.p.dir = "left"; else if (Math.abs(dx) > Math.abs(dy)) W.p.dir = dx > 0 ? "right" : "left"; else W.p.dir = dy > 0 ? "down" : "up"; if (id === "chart" || id === "emr" || id === "sink" || id === "cart") W.p.dir = id === "chart" || id === "emr" ? "down" : "up"; }
  switch (id) {
    case "chart": return openChart();
    case "emr": return openEMR();
    case "cart": return openCart();
    case "sink": return openSink();
    case "bins": return openBins();
    case "patient": return openPatient();
    case "bedctl": return openBed();
    case "curtain": return toggleCurtain();
    case "ci": return openCI();
    case "neighbor": toast("Bed 4: Mr. Lim is asleep after dialysis. He is not your client today.", "info"); return;
  }
}

/* ---------- chart ---------- */
function openChart(tab = "orders") {
  const c = G.c;
  const tabs = [["orders", "Doctor's orders"], ["record", "Kardex & feeding record"], ["mar", "MAR"], ["allergy", "Allergies & history"], ["labs", "Vitals & labs"], ["policy", "Ward policy"]];
  if (!G.chartSeen.has(tab)) { G.chartSeen.add(tab); advance(.5); if (tab === "record" && G.planOk && G.planOk.tol) mark("a_tol"); if (tab === "allergy" && G.planOk && G.planOk.lac) mark("a_allergy"); }
  let body = "";
  if (tab === "orders") body = `<div class="order-sheet">DOCTOR'S ORDER SHEET · ${GAME_DATE}<br>Patient: <b>${esc(c.name)}</b>, ${c.age}/${c.sex} · Hosp. No. ${c.hosp} · Bed 3<br>Dx: ${esc(c.dx)}<br><br>
    1. NPO except tube feeding.<br>2. <b>${FORMULA_NAMES[c.formula]} ${c.amount} mL via NGT ${c.freq}</b> (02-06-10-14-18-22), open system by gravity syringe.<br>3. Flush with <b>${c.water} mL water</b> after each feeding.<br>4. Check tube placement (aspirate pH) and gastric residual before each feeding. Hold and refer per agency policy.<br>5. Head of bed at least 30° at all times.<br>6. Weigh daily. Strict intake and output.<br><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Dr. M. Aquino, Resident Physician</div>`;
  if (tab === "record") body = `<div class="scroll-x"><table class="tbl"><thead><tr><th>Time</th><th>Feeding</th><th>Residual</th><th>Water</th><th>Tolerance</th></tr></thead><tbody>
    <tr><td class="mono">02:00</td><td>${c.prev.time === "06:00" ? "200 mL" : c.amount + " mL"}</td><td class="num">${c.id === "c3" ? 40 : 20} mL</td><td class="num">60 mL</td><td>Tolerated</td></tr>
    <tr><td class="mono">06:00</td><td>${c.id === "c4" ? "200 mL" : c.amount + " mL"}${c.id === "c2" ? " (milk-based given in error)" : ""}</td><td class="num">${c.id === "c3" ? 50 : 15} mL</td><td class="num">60 mL</td><td>${c.id === "c2" ? "Bloating, cramps" : "Tolerated"}</td></tr>
    <tr><td class="mono">10:00</td><td>${c.id === "c4" ? "Not given" : c.prev.amount + " mL"}</td><td class="num">${c.id === "c4" ? "—" : c.prev.grv + " mL"}</td><td class="num">${c.id === "c4" ? "—" : "60 mL"}</td><td>${esc(c.prev.note)}</td></tr>
    <tr><td class="mono">14:00</td><td colspan="4"><b>Due now. You are assigned.</b></td></tr></tbody></table></div>
    <p class="muted" style="margin-top:10px">Kardex: ${esc(c.dx)}. Aspiration precautions. NGT Fr 14, left nostril, marked at 55 cm.</p>`;
  if (tab === "mar") body = `<div class="scroll-x"><table class="tbl"><thead><tr><th>Time</th><th>Medication</th><th>Status</th></tr></thead><tbody>${c.mar.map(([t, m, s]) => `<tr><td class="mono">${t}</td><td>${esc(m)}</td><td>${esc(s)}</td></tr>`).join("")}</tbody></table></div>`;
  if (tab === "allergy") body = `<div class="grid2"><div class="card"><h4>Allergy band</h4><p style="margin:0"><span style="display:inline-block;width:40px;height:12px;border-radius:6px;background:${/No known/.test(c.allergies) ? "#fff" : "#e0464b"};border:1px solid #aaa;vertical-align:middle"></span> ${esc(c.allergies)}</p></div>
    <div class="card"><h4>History</h4><p style="margin:0">${esc(c.dx)}.</p></div></div>`;
  if (tab === "labs") body = `<div class="grid2"><div class="card"><h4>Vital signs 13:30</h4><dl class="kv"><dt>HR</dt><dd>${c.vitals.hr} bpm</dd><dt>BP</dt><dd>${c.vitals.bp} mmHg</dd><dt>RR</dt><dd>${c.vitals.rr} cpm</dd><dt>Temp</dt><dd>${c.vitals.t} °C</dd><dt>SpO₂</dt><dd>${c.vitals.spo2}%</dd></dl></div>
    <div class="card"><h4>Nutrition labs</h4><dl class="kv"><dt>Albumin</dt><dd>${esc(c.find.albumin.replace("Serum albumin ", ""))}</dd><dt>Weight</dt><dd>${esc(c.find.weight)}</dd></dl></div></div>`;
  if (tab === "policy") body = `<div class="stack">${POLICY.map(([h, t]) => `<div class="card"><h4>${h}</h4><p style="margin:0">${esc(t)}</p></div>`).join("")}</div>`;
  const plan = G.planDone ? `<div class="note ok" style="margin-top:14px">Feeding plan confirmed.</div>` : planForm();
  openModal("Patient chart", c.name + " · Bed 3", `
    <div class="chart-tabs" role="tablist">${tabs.map(([k, l]) => `<button class="chart-tab ${k === tab ? "on" : ""}" type="button" data-chart="${k}">${l}${G.chartSeen.has(k) ? '<span class="seen"></span>' : ""}</button>`).join("")}</div>
    ${body}${plan}`, { wide: true });
}
function planForm() {
  const sel = (id, opts) => `<select id="${id}"><option value="">Choose…</option>${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select>`;
  return `<div class="card" style="margin-top:14px"><h4>Confirm the feeding plan</h4>
    <div class="grid3">
      <label class="field">Formula ${sel("pl_f", Object.entries(FORMULA_NAMES))}</label>
      <label class="field">Amount ${sel("pl_a", [180, 200, 240, 250, 300].map((v) => [v, v + " mL"]))}</label>
      <label class="field">Frequency ${sel("pl_q", [["q2h", "Every 2 hours"], ["q4h", "Every 4 hours"], ["q6h", "Every 6 hours"], ["cont", "Continuous"]])}</label>
      <label class="field">Previous feeding ${sel("pl_t", [["ok", "Tolerated"], ["poor", "Poorly tolerated (distention, belching)"], ["none", "Not given"]])}</label>
      <label class="field">Allergy check ${sel("pl_l", [["none", "No food intolerance; formula is fine"], ["lf", "Lactose intolerant: lactose-free only"], ["hold", "Formula allergy: hold and notify"]])}</label>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn primary" type="button" data-plan="1">Confirm plan</button><span class="muted" style="font-size:13px">Check the record and allergies first.</span></div></div>`;
}
function submitPlan() {
  const c = G.c, v = (id) => $("#" + id).value;
  if (!v("pl_f") || !v("pl_a") || !v("pl_q") || !v("pl_t") || !v("pl_l")) { toast("Fill in every field of the plan.", "info"); return; }
  const tolAns = c.id === "c3" ? "poor" : c.id === "c4" ? "none" : "ok";
  const ok = { order: v("pl_f") === c.formula && +v("pl_a") === c.amount && v("pl_q") === c.freq, tol: v("pl_t") === tolAns, lac: v("pl_l") === (c.lactose ? "lf" : "none") };
  G.planDone = true; G.planOk = ok; advance(1);
  if (ok.order && G.chartSeen.has("orders")) mark("a_order"); else fault("A", 1, "The feeding plan did not match the doctor's order.", "Read the order for the exact type, amount and frequency before preparing anything.", false, "a_order");
  if (ok.tol && G.chartSeen.has("record")) mark("a_tol"); else if (!ok.tol) fault("A", .5, "Misjudged the tolerance of the previous feeding.", "The feeding record shows how the last feeding went; it shapes what you watch for today.", false, "a_tol");
  if (ok.lac) { if (G.chartSeen.has("allergy") || G.allergyAsked) mark("a_allergy"); }
  else fault("A", 1, "Missed the client's food intolerance status.", "Check allergies and lactose intolerance against the formula; notify the provider if incompatible.", false, "a_allergy");
  logEv(ok.order && ok.tol && ok.lac ? "ok" : "warn", "Confirmed the feeding plan.");
  openChart("orders");
}

/* ---------- supply cart ---------- */
function openCart() {
  W.cartOpen = 1.5; sfx("click");
  const all = [...SUPPLIES.map((s) => ({ ...s, kind: "sup" })), ...G.c.cart.map((f) => ({ ...f, kind: "formula", icon: "formula", col: FORMULA_COL[formulaKind(f.key)] }))];
  // stable shuffle so required items are not all first
  const order = all.map((x, i) => [x, (i * 7919 + G.c.id.charCodeAt(1) * 31) % 97]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  const card = (x) => `<button type="button" class="item ${G.tray.has(x.key) ? "on" : ""}" data-cart="${x.key}">${iconSvg(x.icon, 44, x.col)}<span>${esc(x.label)}</span><small>${esc(x.sub)}</small></button>`;
  openModal("Supply cart", "Prepare the necessary equipment", `
    <p class="muted">Tap items to put them on your tray. Bring what NGT feeding needs, nothing more. One formula at a time.</p>
    <div class="items">${order.map(card).join("")}</div>
    <div class="row" style="margin-top:14px;justify-content:space-between"><span class="muted" id="cartCount">${G.tray.size} on tray</span><button class="btn primary" type="button" data-close="1">Done</button></div>`,
    { onClose: () => { G.cartTrips++; advance(G.cartTrips === 1 ? 1.5 : .6); logEv("info", `Gathered equipment (${G.tray.size} items).`); renderTray(); } });
}
function toggleCart(key) {
  const f = G.c.cart.find((x) => x.key === key);
  if (G.tray.has(key)) { G.tray.delete(key); if (G.formulaKey === key) { G.formulaKey = null; G.prep = { expiry: null, temp: null, swab: false, poured: false }; } sfx("drop"); }
  else {
    if (f) { if (G.prep.poured) { toast("You already prepared the feeding.", "info"); return; } if (G.formulaKey) G.tray.delete(G.formulaKey); G.formulaKey = key; G.prep = { expiry: null, temp: null, swab: false, poured: false }; }
    if (key === "water") G.waterCup = 100;
    G.tray.add(key); sfx("pick");
  }
  $$("[data-cart]").forEach((b) => b.classList.toggle("on", G.tray.has(b.dataset.cart)));
  $("#cartCount").textContent = G.tray.size + " on tray";
  renderTray();
}

/* ---------- sink: hand hygiene ---------- */
const HH_STEPS = [["wet", "Wet hands with water"], ["soap", "Apply soap"], ["rub", "Rub all surfaces, 20 seconds"], ["rinse", "Rinse thoroughly"], ["dry", "Dry with a paper towel"], ["tap", "Turn off the faucet with the towel"]];
let HH = null;
function openSink() {
  if (G.gloves) { toast("Remove your gloves first.", "info"); return; }
  HH = { seq: [], wrong: false, rubbing: false };
  renderSink();
}
function renderSink() {
  const shuffled = [HH_STEPS[2], HH_STEPS[4], HH_STEPS[0], HH_STEPS[5], HH_STEPS[1], HH_STEPS[3]];
  const done = HH.seq.map((k) => HH_STEPS.find((s) => s[0] === k)[1]);
  const html = `<p class="muted">Choose handwashing with soap and water, step by step, or an alcohol-based hand rub.</p>
    <div class="grid2"><div class="card"><h4>Soap and water</h4><div class="stack">${shuffled.map(([k, l]) => `<button class="btn ${HH.seq.includes(k) ? "picked" : ""}" type="button" data-hh="${k}" ${HH.seq.includes(k) || HH.rubbing ? "disabled" : ""}>${l}</button>`).join("")}</div>
    <div class="prog" style="margin-top:10px"><i id="hhProg" style="width:${HH.seq.length / 6 * 100}%"></i></div></div>
    <div class="card"><h4>Your sequence</h4><ol style="margin:0;padding-left:20px;font-size:14px">${done.map((d) => `<li>${d}</li>`).join("") || '<li class="muted" style="list-style:none;margin-left:-20px">No steps yet.</li>'}</ol>
    <h4 style="margin-top:14px">Alcohol-based hand rub</h4><button class="btn" type="button" data-hh="rubalc" ${HH.rubbing ? "disabled" : ""}>Rub hands with alcohol, 20 to 30 seconds</button></div></div>`;
  if ($("#modal").hidden || !MODAL || MODAL.kind !== "sink") openModal("Hand hygiene", "Sink", html, { kind: "sink" }); else setModalBody(html);
}
function hhStep(k) {
  if (k === "rubalc") { HH.rubbing = true; renderSink(); sfx("water"); busy(1.2); setTimeout(() => { HH.rubbing = false; if (MODAL && MODAL.kind === "sink") hhDone(); }, 1100); return; }
  const expect = HH_STEPS[HH.seq.length][0];
  if (k !== expect) HH.wrong = true;
  HH.seq.push(k); W.sinkRun = 2; if (k === "wet" || k === "rinse") sfx("water"); else sfx("click");
  if (k === "rub") { HH.rubbing = true; renderSink(); busy(1.6); let p = 0; const iv = setInterval(() => { p += .1; if (!MODAL || MODAL.kind !== "sink") { clearInterval(iv); HH.rubbing = false; return; } const el = $("#hhProg"); if (el) el.style.width = (HH.seq.length - 1 + Math.min(1, p)) / 6 * 100 + "%"; if (p >= 1) { clearInterval(iv); HH.rubbing = false; renderSink(); if (HH.seq.length === 6) hhDone(); } }, 150); return; }
  renderSink();
  if (HH.seq.length === 6) hhDone();
}
function hhDone() {
  if (HH.wrong) fault("N", .25, "Hand hygiene steps were out of order.", "Wet, soap, rub all surfaces for 20 seconds, rinse, dry, and close the faucet with the towel.", false);
  advance(1); G.hhCount++;
  if (!G.invasive && !G.hhBefore) { G.hhBefore = true; mark("p_hh"); logEv("ok", "Performed hand hygiene before the procedure."); }
  else if (G.glovesOff && !G.hhAfter) { G.hhAfter = true; mark("i_hh2"); logEv("ok", "Performed hand hygiene after the procedure."); }
  else logEv("info", "Performed hand hygiene.");
  toast("Hands clean.", "ok"); closeModal();
}

/* ---------- waste bins ---------- */
const WASTE = [["syr", "Used syringe and measuring container (gastric contents)", "y"], ["strip", "Used pH strip and alcohol swab", "y"], ["carton", "Empty formula carton", "b"], ["wrap", "Paper and plastic wrappers", "b"]];
let BIN = null;
function openBins() {
  W.binOpen = 1.5; sfx("click");
  if (!G.plugged) { toast("Finish at the bedside first: clamp and plug the tube.", "info"); return; }
  BIN = BIN || {};
  renderBins();
}
function renderBins() {
  const all = WASTE.every(([k]) => BIN[k]);
  const html = `<p class="muted">Sort the used items. Yellow: infectious waste. Black: general, non-infectious waste.</p>
    <div class="stack">${WASTE.map(([k, l]) => `<div class="card row" style="justify-content:space-between"><span>${l}</span><span class="row">
      <button class="btn ${BIN[k] === "y" ? "picked" : ""}" type="button" data-bin="${k}" data-val="y" style="border-color:#c49d2a">Yellow</button>
      <button class="btn ${BIN[k] === "b" ? "picked" : ""}" type="button" data-bin="${k}" data-val="b" style="border-color:#2b2f30">Black</button></span></div>`).join("")}</div>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" type="button" data-bin="done" ${all && !G.disposed ? "" : "disabled"}>${G.disposed ? "Equipment disposed ✓" : "Dispose"}</button>
      <button class="btn" type="button" data-bin="gloves" ${G.gloves ? "" : "disabled"}>Remove gloves into the yellow bin</button></div>`;
  if ($("#modal").hidden || !MODAL || MODAL.kind !== "bins") openModal("Waste disposal", "Infection prevention", html, { kind: "bins" }); else setModalBody(html);
}
function binAct(k, v) {
  if (k === "gloves") { procAct("gloves"); renderBins(); return; }
  if (k === "done") {
    const wrong = WASTE.filter(([key, , ans]) => BIN[key] !== ans);
    G.disposed = true; W.binOpen = 1.5; sfx("drop"); advance(1);
    if (G.glovesOff) fault("N", .5, "Disposed of equipment after removing gloves.", "Dispose of the equipment while gloved, then remove the gloves.");
    if (wrong.length) fault("N", .5, "Segregated waste incorrectly: " + wrong.map((w) => w[1].split(" (")[0].toLowerCase()).join(", ") + ".", "Items soiled with body fluids go to the yellow (infectious) bin; clean packaging goes to the black (general) bin.", false, "i_dispose");
    else mark("i_dispose");
    logEv("ok", "Disposed of used equipment."); renderBins(); return;
  }
  BIN[k] = v; sfx("click"); renderBins();
}

/* ---------- bed & curtain ---------- */
function bedSvg(angle, side) {
  const a = angle * Math.PI / 180, hx = 150, hy = 96, L = 92;
  const x2 = hx - Math.cos(a) * L, y2 = hy - Math.sin(a) * L;
  return `<svg viewBox="0 0 300 130" width="100%" style="max-width:380px;display:block;margin:0 auto" aria-hidden="true">
    <rect x="20" y="104" width="250" height="8" rx="3" fill="#93a3a8"/><circle cx="40" cy="120" r="7" fill="#53666b"/><circle cx="250" cy="120" r="7" fill="#53666b"/>
    <rect x="${hx}" y="${hy - 4}" width="120" height="12" rx="4" fill="#f4f7f7" stroke="#b9c7c7"/>
    <line x1="${hx}" y1="${hy + 2}" x2="${x2}" y2="${y2 + 2}" stroke="#d5dfdf" stroke-width="14" stroke-linecap="round"/>
    <circle cx="${x2 + Math.sin(a) * 18 + Math.cos(a) * 12}" cy="${y2 - Math.cos(a) * 18 + Math.sin(a) * 12}" r="13" fill="#e3b08a"/>
    <line x1="${hx}" y1="${hy - 8}" x2="${x2 + Math.cos(a) * 26 + Math.sin(a) * 8}" y2="${y2 + Math.sin(a) * 26 - Math.cos(a) * 8}" stroke="#7fa9d6" stroke-width="16" stroke-linecap="round" opacity=".0"/>
    <rect x="${hx - 6}" y="${hy - 22}" width="110" height="18" rx="9" fill="#7fa9d6"/>
    <path d="M${hx - 34} ${hy} A34 34 0 0 1 ${hx - Math.cos(a) * 34} ${hy - Math.sin(a) * 34}" fill="none" stroke="#7a4fd6" stroke-width="2.5"/>
    <text x="${hx - 60}" y="${hy + 4}" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="${angle >= 30 || side ? "#1f7a4a" : "#b52f33"}" text-anchor="end">${side ? "R side" : angle + "°"}</text>
  </svg>`;
}
function openBed() {
  const html = () => `<div class="card">${bedSvg(Math.round(BEDTMP.a), BEDTMP.side)}</div>
    <div class="height-ctl" style="margin-top:12px"><label for="hobR">Head of bed</label><input id="hobR" type="range" min="0" max="90" step="1" value="${BEDTMP.a}" data-bedr="1"><b class="mono" id="hobV">${Math.round(BEDTMP.a)}°</b></div>
    <div class="row" style="margin-top:10px">${[[0, "Flat"], [30, "Semi-Fowler's 30°"], [45, "Fowler's 45°"], [90, "High Fowler's 90°"]].map(([v, l]) => `<button class="btn" type="button" data-bedp="${v}">${l}</button>`).join("")}
    <button class="btn ${BEDTMP.side ? "picked" : ""}" type="button" data-bedp="side">Right side-lying, slightly elevated</button></div>
    <p class="muted" style="margin-top:10px;font-size:13px">Use right side-lying only when sitting up is contraindicated.</p>
    <div class="row"><button class="btn primary" type="button" data-bedp="apply">Apply</button></div>`;
  BEDTMP = { a: G.hob, side: G.sideLying, html };
  openModal("Bed controls", "Positioning", html(), { kind: "bed" });
}
let BEDTMP = null;
function bedAct(v) {
  if (v === "apply") {
    const was = G.hob;
    G.hob = BEDTMP.side ? 20 : BEDTMP.a; G.sideLying = BEDTMP.side; advance(.5); sfx("motor");
    const ok = G.hob >= 30 || G.sideLying;
    logEv(ok ? "ok" : "info", G.sideLying ? "Positioned right side-lying, slightly elevated." : `Head of bed set to ${Math.round(G.hob)}°.`);
    if (G.sideLying && !G.c.sideOk) fault("N", .25, "Used side-lying though sitting up was not contraindicated.", "Fowler's position is the normal position for eating; side-lying is the fallback when sitting is contraindicated.");
    if (!ok && (G.feedStart != null || G.placement === "hold" || G.grvDecision === "hold")) fault("N", 1.5, `Lowered the head of bed to ${Math.round(G.hob)}° after the feeding.`, "Keep the client upright for at least 30 minutes after a feeding to prevent regurgitation and aspiration.", false, "i_upright");
    if (ok && G.feedStart == null) mark("p_position");
    closeModal(); return;
  }
  if (v === "side") BEDTMP.side = !BEDTMP.side; else { BEDTMP.a = +v; BEDTMP.side = false; }
  setModalBody(BEDTMP.html());
}
function toggleCurtain() {
  G.curtainTarget = G.curtainTarget > .5 ? 0 : 1; sfx("curtain"); advance(.2);
  if (G.curtainTarget === 1) { logEv("ok", "Closed the privacy curtain."); if (!G.invasive) mark("p_privacy"); }
  else logEv("info", "Opened the privacy curtain.");
}
function openCI() {
  if (G.mode === "demo") { openModal("Clinical Instructor", "Return demonstration", `<div class="speech"><b>CI:</b> "This is your return demonstration. I'm only observing. Go ahead when you're ready."</div><div class="row"><button class="btn primary" type="button" data-close="1">Continue</button></div>`); return; }
  G.hintsUsed++;
  openModal("Clinical Instructor", "Practice mode", `<div class="speech"><b>CI:</b> "${esc(nextHint())}"</div><p class="muted">The CI bar at the top of the ward shows this tip too. Press H to hide it.</p><div class="row"><button class="btn primary" type="button" data-close="1">Thanks</button></div>`);
}

/* ---------- patient ---------- */
let PV = "menu";
function openPatient(view = "menu") {
  PV = view;
  const c = G.c;
  const band = `<div class="card row" style="gap:14px"><div style="width:10px;align-self:stretch;border-radius:4px;background:${/No known/.test(c.allergies) ? "#fff" : "#e0464b"};border:1px solid var(--paper-line)"></div>
    <dl class="kv" style="flex:1"><dt>ID band</dt><dd>${G.identified ? esc(c.name) + " · " + c.dob + " · " + c.hosp : "Not yet checked"}</dd><dt>Position</dt><dd>${G.sideLying ? "Right side-lying" : "HOB " + Math.round(G.hob) + "°"}</dd></dl></div>`;
  let html = "";
  const tick = (b) => b ? `<span class="tick">DONE</span>` : "";
  if (view === "menu") {
    html = `${band}<div class="menu-list" style="margin-top:12px">
      <button class="btn" type="button" data-pt="identify">Introduce self &amp; verify identity ${tick(G.identified)}</button>
      <button class="btn" type="button" data-pt="explain">Explain the procedure ${tick(G.explained)}</button>
      <button class="btn" type="button" data-pt="assess">Assess nutrition &amp; hydration ${tick(G.nutri.size >= 3)}</button>
      <button class="btn primary" type="button" data-pt="bedside">Bedside procedure: tube &amp; feeding</button>
      <button class="btn" type="button" data-pt="instruct">Give after-feeding instructions ${tick(G.instructed)}</button>
      <button class="btn" type="button" data-pt="evaluate">Evaluate the client's response ${tick(G.items.e_eval && G.items.e_eval.ok)}</button>
    </div>`;
  } else if (view === "identify") {
    html = `<p class="muted">First, what do you say?</p><div class="stack">
      <button class="btn" type="button" data-id="greet">"Good afternoon. I'm Student Nurse Reyes, Level 4. I'll be taking care of your feeding today."</button>
      <button class="btn" type="button" data-id="rush">"Hi, it's feeding time."</button></div>
      <div class="card" style="margin-top:12px"><h4>Then verify identity using</h4><div class="checks">
      ${[["name", "Full name, asked to state it"], ["dob", "Date of birth"], ["hosp", "Hospital number on ID band"], ["bed", "Bed number"], ["dx", "Diagnosis"], ["room", "Room number"]].map(([k, l]) => `<label><input type="checkbox" value="${k}" name="idk"> ${l}</label>`).join("")}
      </div><div class="row" style="margin-top:10px"><button class="btn primary" type="button" data-id="verify">Verify</button></div></div>`;
  } else if (view === "explain") {
    html = `<p class="muted">Choose your explanation.</p><div class="stack">
      <button class="btn" type="button" data-ex="good">"I'll give your 2 PM feeding through your nose tube. It gives you the nutrition you need while swallowing is hard. You might feel full, but it shouldn't hurt. Please stay sitting up and tell me right away if you feel cramps or nausea."</button>
      <button class="btn" type="button" data-ex="tech">"I'll verify NGT placement via aspirate pH, check GRV, then instill 240 mL by gravity and flush 60 mL."</button>
      <button class="btn" type="button" data-ex="pain">"This will hurt a little, but it's quick. Just relax."</button></div>`;
  } else if (view === "assess") {
    const opts = [["weight", "Review weight trend"], ["mucosa", "Inspect lips and oral mucosa"], ["turgor", "Check skin turgor"], ["albumin", "Review serum albumin"], ["io", "Review 24-hour intake and output"], ["allergy", "Ask about food allergies and milk intolerance"]];
    html = `<div class="grid2">${opts.map(([k, l]) => `<div class="card"><button class="btn ${G.nutri.has(k) || (k === "allergy" && G.allergyAsked) ? "picked" : ""}" type="button" data-as="${k}" style="width:100%">${l}</button>${G.nutri.has(k) || (k === "allergy" && G.allergyAsked) ? `<p style="margin:8px 0 0;font-size:14px">${esc(k === "allergy" ? c.find.allergyAnswer : c.find[k])}</p>` : ""}</div>`).join("")}</div>`;
  } else if (view === "instruct") {
    html = `<div class="stack">
      <button class="btn" type="button" data-in="good">"Please stay sitting up like this, or on your right side with your head raised, for at least 30 minutes. Call me if you feel full, crampy or nauseated."</button>
      <button class="btn" type="button" data-in="flat">"You can lie flat now and get some rest."</button>
      <button class="btn" type="button" data-in="walk">"Try to walk around the ward to help digestion."</button></div>`;
  } else if (view === "evaluate") {
    html = `<p class="muted">Pick the follow-up checks that belong to tube feeding. Each check takes a moment.</p><div class="grid2">${EVAL_OPTS.map((o) => {
      const done = G.evals.has(o.key) || G.evalWrong.has(o.key);
      const res = G.evals.has(o.key) ? c.find[o.key] || "" : G.evalWrong.has(o.key) ? o.why : "";
      return `<div class="card"><button class="btn ${done ? "picked" : ""}" type="button" data-ev="${o.key}" style="width:100%" ${done ? "disabled" : ""}>${o.label}</button>${res ? `<p style="margin:8px 0 0;font-size:14px">${esc(o.key === "weight" ? c.find.weight : res)}</p>` : ""}</div>`;
    }).join("")}</div><div class="row" style="margin-top:12px"><button class="btn primary" type="button" data-ev="finish">Finish evaluation</button></div>`;
  }
  const back = view !== "menu" ? `<div class="row" style="margin-top:14px"><button class="btn ghost" type="button" data-pt="menu">← Back</button></div>` : "";
  const speech = view === "menu" ? `<div class="speech"><b>${esc(c.short)}:</b> ${c.id === "c4" ? "She looks at you and smiles, then looks at the window." : G.feedEnd ? "\"I feel a bit full, but okay.\"" : "\"Good afternoon, nurse.\""}</div>` : "";
  openModal(c.name, `Bed 3 · ${c.age}/${c.sex}`, speech + html + back, { kind: "patient" });
}
function patientAct(kind, v) {
  const c = G.c;
  if (kind === "pt") {
    if (v === "bedside") { closeModal(); openBedside(); return; }
    if (v === "instruct" && !G.plugged) { toast("Give this instruction after the feeding is done.", "info"); return; }
    if (v === "evaluate" && !G.plugged) { toast("Evaluate the client's response after the feeding (or after holding it).", "info"); return; }
    openPatient(v); return;
  }
  if (kind === "id") {
    if (v === "greet") { G.greeted = true; toast("You introduced yourself.", "ok"); sfx("click"); return; }
    if (v === "rush") { G.greeted = false; fault("N", .25, "Did not introduce yourself.", "State your name and role so the client knows who is caring for them.", false); return; }
    if (v === "verify") {
      const picked = $$("input[name=idk]:checked").map((i) => i.value);
      const good = picked.filter((k) => ["name", "dob", "hosp"].includes(k));
      if (good.length < 2) { fault("N", .5, "Verified identity with fewer than two valid identifiers.", "Use two identifiers such as full name and date of birth or hospital number. Bed and room numbers are not identifiers.", false, "p_identify"); }
      else if (picked.some((k) => ["bed", "room", "dx"].includes(k))) fault("N", .25, "Used bed number, room or diagnosis as an identifier.", "Those can change or be shared. Stick to name, date of birth and hospital number.");
      if (good.length >= 2) { G.identified = true; if (G.greeted !== false) mark("p_identify"); else mark("p_identify", false, "No introduction"); logEv("ok", "Verified identity: " + good.join(" + ") + "."); say(c.id === "c4" ? "(She nods. Her ID band matches the chart.)" : `"Yes, I'm ${c.name}. Born ${c.dob}."`); }
      advance(1); openPatient("menu"); return;
    }
  }
  if (kind === "ex") {
    G.explained = true; advance(1);
    if (v === "good") { mark("p_explain"); logEv("ok", "Explained the procedure."); say(c.id === "c4" ? "(She relaxes and holds your hand.)" : "\"Okay, nurse. I'll tell you if I feel anything.\""); }
    else if (v === "tech") fault("N", .5, "Explained in jargon without inviting participation.", "Explain what, why and how the client can participate in plain words; mention fullness but no pain.", false, "p_explain");
    else fault("N", .5, "Told the client the feeding will hurt.", "The feeding should not cause discomfort; it may cause a feeling of fullness.", false, "p_explain");
    openPatient("menu"); return;
  }
  if (kind === "as") {
    if (v === "allergy") { G.allergyAsked = true; if (G.planOk && G.planOk.lac) mark("a_allergy"); }
    else G.nutri.add(v);
    advance(.5); sfx("click");
    if (G.nutri.size >= 3 && !G.items.a_nutri) { mark("a_nutri"); logEv("ok", "Assessed for signs of malnutrition and dehydration."); }
    openPatient("assess"); return;
  }
  if (kind === "in") {
    if (v === "good") { G.instructed = true; mark("i_upright"); logEv("ok", "Instructed to remain upright for 30 minutes."); say(c.id === "c4" ? "(She nods.)" : "\"Okay, I'll stay up.\""); }
    else fault("N", 1, v === "flat" ? "Told the client to lie flat after feeding." : "Told the client to walk around after feeding.", "The client should remain in Fowler's or slightly elevated right side-lying for at least 30 minutes to prevent regurgitation and aspiration.", false, "i_upright");
    G.instructed = true; advance(.5); openPatient("menu"); return;
  }
  if (kind === "ev") {
    if (v === "finish") {
      const rel = [...G.evals].length;
      const core = ["tolerance", "bowel", "regurg"].every((k) => G.evals.has(k));
      if (rel >= 5 && core) { mark("e_eval"); logEv("ok", `Evaluated the client (${rel} follow-up checks).`); }
      else fault("N", 1, `Follow-up evaluation was incomplete (${rel} checks${core ? "" : ", missing tolerance, bowel sounds or fullness"}).`, "Follow up on tolerance, bowel sounds, regurgitation and fullness, weight, elimination, skin turgor, urine output and specific gravity, urine glucose and acetone.", false, "e_eval");
      openPatient("menu"); return;
    }
    const o = EVAL_OPTS.find((x) => x.key === v);
    if (o.needs && !G.tray.has(o.needs)) { toast("You need a stethoscope. Get one from the supply cart.", "info"); return; }
    if (o.rel) { G.evals.add(v); if (v === "bowel") { sfx("gurgle"); busy(1.2); } else sfx("click"); }
    else { G.evalWrong.add(v); fault("N", .25, "Chose an unrelated follow-up: " + o.label.toLowerCase() + ".", o.why); }
    advance(.5); openPatient("evaluate"); return;
  }
}

/* ---------- documentation ---------- */
function docStatements() {
  const c = G.c, fed = G.fedFeed > 5;
  const cramp = G.crampState >= 1;
  return [
    { k: "tol", text: "Tolerated the feeding; mild fullness, no nausea", truth: fed && G.discomfort < .8 },
    { k: "cramp", text: "Mild cramping midway, eased after pausing the flow", truth: cramp && G.crampState >= 2 },
    { k: "bs", text: `Bowel sounds ${c.find.bowel.split(",")[0].toLowerCase()}`, truth: G.evals.has("bowel") },
    { k: "soft", text: "No regurgitation; abdomen soft", truth: G.evals.has("regurg") && c.id !== "c3" },
    { k: "dist", text: "Belching; abdomen slightly distended", truth: c.id === "c3" && (G.evals.has("regurg") || G.evals.has("tolerance")) },
    { k: "hob", text: "Head of bed kept at 30° or higher", truth: G.hob >= 30 || G.sideLying },
    { k: "held", text: c.outcome === "hold_ph" ? `Feeding held: aspirate pH ${c.ph}; X-ray requested` : `Feeding held: residual ${G.grvValue || c.grv} mL re-instilled`, truth: c.outcome !== "feed" && G.notified },
    { k: "vomit", text: "Vomited during the feeding", truth: false },
    { k: "absent", text: "Bowel sounds absent", truth: false },
    { k: "flat", text: "Client lying flat after feeding", truth: false },
  ];
}
function openEMR() {
  const c = G.c;
  const notes = [];
  if (G.phRead != null) notes.push(`pH strip read ${G.phRead}`);
  if (G.grvValue != null) notes.push(`Residual ${G.grvValue} mL (${G.reinstilled ? "re-instilled" : G.discarded ? "discarded" : "in container"})`);
  if (G.feedStart != null) notes.push(`Feeding started ${fmtClock(G.feedStart)}${G.feedEnd ? ", tube clamped " + fmtClock(G.feedEnd) : ""}`);
  const st = docStatements();
  openModal("Nurse's notes", "EMR · " + c.name, `
    <div class="note" style="margin-bottom:12px"><b>Your bedside notes:</b> ${notes.length ? esc(notes.join(" · ")) : "none yet"}. Amounts are in the Log tab.</div>
    <div class="grid3">
      <label class="field">Feeding given <select id="dc_f"><option value="">Choose…</option><option value="none">None: feeding held</option>${Object.entries(FORMULA_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <label class="field">Feeding amount (mL)<input id="dc_a" class="mono" inputmode="numeric" type="number" min="0" max="1000" placeholder="0"></label>
      <label class="field">Water flush (mL)<input id="dc_w" class="mono" inputmode="numeric" type="number" min="0" max="500" placeholder="0"></label>
      <label class="field">Duration (min)<input id="dc_d" class="mono" inputmode="numeric" type="number" min="0" max="240" placeholder="0"></label>
      <label class="field">I&amp;O: total intake (mL)<input id="dc_io" class="mono" inputmode="numeric" type="number" min="0" max="2000" placeholder="0"></label>
      <label class="field">Report <select id="dc_r"><option value="">Choose…</option><option value="none">No significant deviation</option><option value="grv">Reported high residual to primary care provider</option><option value="ph">Reported unconfirmed placement (pH 6+) to primary care provider</option><option value="intol">Reported feeding intolerance to primary care provider</option></select></label>
    </div>
    <div class="card" style="margin-top:12px"><h4>Client assessment</h4><div class="checks">${st.map((s) => `<label><input type="checkbox" name="dcs" value="${s.k}"> ${esc(s.text)}</label>`).join("")}</div></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" type="button" data-doc="confirm">Submit notes and end the case</button><span class="muted" id="docMsg" style="font-size:13px">Submitting ends the case and opens your evaluation.</span></div>`, { wide: true });
}
function submitDocs(step) {
  if (step === "confirm") {
    $("#docMsg").innerHTML = `<b>Submit now?</b> Anything not done yet counts as missed. <button class="btn danger" type="button" data-doc="go">Yes, submit</button>`;
    return;
  }
  const c = G.c, num = (id) => { const v = $("#" + id).value; return v === "" ? null : +v; };
  const f = $("#dc_f").value, a = num("dc_a"), w = num("dc_w"), d = num("dc_d"), io = num("dc_io"), r = $("#dc_r").value;
  const fed = Math.round(G.fedFeed), water = Math.round(G.fedWater), dur = G.feedStart != null ? Math.round((G.feedEnd || G.clock) - G.feedStart) : 0;
  const kind = G.formulaKey ? formulaKind(G.formulaKey) : c.formula;
  const near = (x, y, tol) => x != null && Math.abs(x - y) <= tol;
  const docOk = {
    d_feed: (fed > 5 ? f === kind : f === "none") && near(a ?? 0, fed, 5),
    d_water: near(w ?? 0, water, 5),
    d_dur: near(d ?? 0, dur, 3),
    d_io: near(io, fed + water, 5),
    d_report: r === (c.outcome === "hold_grv" ? "grv" : c.outcome === "hold_ph" ? "ph" : "none"),
  };
  const checked = new Set($$("input[name=dcs]:checked").map((i) => i.value));
  const st = docStatements();
  const trueHits = st.filter((s) => s.truth && checked.has(s.k)).length, falseHits = st.filter((s) => !s.truth && checked.has(s.k)).length;
  docOk.d_assess = trueHits >= 2 && falseHits === 0;
  const expect = { d_feed: `${fed > 5 ? FORMULA_NAMES[kind] + " " + fed + " mL" : "None (held)"}`, d_water: water + " mL", d_dur: dur + " min", d_io: fed + water + " mL intake", d_report: c.outcome === "feed" ? "No significant deviation" : "Report to the primary care provider" };
  for (const [id, ok] of Object.entries(docOk)) {
    if (ok) mark(id); else fault("R", .5, `Documentation: ${CHECK.find((x) => x.id === id).label.toLowerCase()}${expect[id] ? " (expected " + expect[id] + ")" : ""}.`, WHY[id] + (id === "d_assess" ? " Chart only what you actually assessed." : ""), false, id);
  }
  advance(3); G.docs = { f, a, w, d, io, r };
  closeModal(); finishCase();
}

/* ---------- scoring ---------- */
function computeScore() {
  const c = G.c, cats = { A: { e: 0, t: 0 }, N: { e: 0, t: 0 }, R: { e: 0, t: 0 } };
  const items = CHECK.filter(needs);
  for (const d of items) { cats[d.cat].t += d.w; const st = G.items[d.id]; if (st && st.ok) cats[d.cat].e += d.w; }
  for (const e of G.errors) if (cats[e.cat]) cats[e.cat].e -= e.pts * 0.5;
  const res = {};
  for (const k of ["A", "N", "R"]) { const pct = clamp(cats[k].e / cats[k].t, 0, 1); res[k] = { pct, v: toScale(pct) }; }
  if (G.stopped) res.N = { pct: 0, v: 3 };
  const target = c.outcome === "feed" ? 80 : 55, used = activeMin();
  const ratio = used / target;
  res.T = { pct: ratio, v: G.stopped ? 3 : ratio <= 1 ? 5 : ratio <= 1.15 ? 4.5 : ratio <= 1.3 ? 4 : ratio <= 1.5 ? 3.5 : 3, used, target };
  const total = (res.A.v * 20 + res.N.v * 30 + res.R.v * 30 + res.T.v * 20) / 100;
  const label = total >= 4.75 ? "Exemplary" : total >= 4.25 ? "Proficient" : total >= 3.75 ? "Good" : total >= 3.25 ? "Poor" : "Very Poor";
  return { res, total, label, items };
}
function finishCase() {
  if (!G || G.over) return;
  G.over = true; W.paused = true; P.open = false;
  $("#modal").hidden = true; MODAL = null; if ($("#ciPop")) $("#ciPop").remove();
  const sc = computeScore();
  const best = store.get("best", {});
  const key = G.c.id + ":" + G.mode;
  if (!best[key] || best[key] < sc.total) { best[key] = Math.round(sc.total * 100) / 100; store.set("best", best); }
  if (!G.stopped) sfx("win"); else sfx("crit");
  showResults(sc);
}

/* ---------- screens ---------- */
let MODE = store.get("mode", "practice");
function showTitle() {
  G = null; W.title = true; W.paused = true;
  const best = store.get("best", {});
  const scr = $("#screen"); scr.hidden = false;
  scr.innerHTML = `<div class="title-wrap">
    <div class="hero">
      <div>
        <div class="kicker">Skills Enhancement #7 · Level 4 RLE</div>
        <h1>NGT <em>Feeding</em> Ward</h1>
        <p>Work a real 14:00 feeding as a Level 4 student nurse. Read the chart, gather the equipment, check placement and residual, run a gravity syringe feeding, and document it. Your Clinical Instructor rates you on the Skills Enhancement Checklist.</p>
        <div class="mode-pick" role="radiogroup" aria-label="Mode">
          <button type="button" class="mode-card ${MODE === "practice" ? "on" : ""}" data-mode="practice" role="radio" aria-checked="${MODE === "practice"}"><b>Practice</b><span>CI tips on screen. Unsafe steps are stopped and explained.</span></button>
          <button type="button" class="mode-card demo ${MODE === "demo" ? "on" : ""}" data-mode="demo" role="radio" aria-checked="${MODE === "demo"}"><b>Return demo</b><span>No hints, hidden checklist. One unsafe step ends the demo.</span></button>
        </div>
      </div>
      <div class="hero-art"><canvas id="heroCv" width="640" height="440" aria-label="Animated close-up of a gravity syringe feeding"></canvas></div>
    </div>
    <h2 class="section-h">Choose your client</h2>
    <div class="cases">${CASES.map((c) => `<button type="button" class="case-card" data-case="${c.id}">
      <span class="wrist ${/No known/.test(c.allergies) ? "" : "allergy"}" title="ID band"></span>
      <span class="bed">Bed 3 · ${c.age}/${c.sex} · ${c.hosp}</span>
      <h3>${esc(c.name)}</h3>
      <span class="tag t${c.tier}">${esc(c.tag)}</span>
      <p>${esc(c.blurb)}</p>
      <span class="best">Best: practice ${best[c.id + ":practice"] != null ? best[c.id + ":practice"].toFixed(2) : "—"} · demo ${best[c.id + ":demo"] != null ? best[c.id + ":demo"].toFixed(2) : "—"}</span>
    </button>`).join("")}</div>
    <div class="howto">
      <div><b>Move</b>WASD or arrow keys. On a phone, use the stick, or tap the floor or any object to walk there.</div>
      <div><b>Act</b>Walk up to a station and press E, Space, or USE. Patient, bed, curtain, cart, sink, bins, chart and computer all respond.</div>
      <div><b>Score</b>Patient Assessment 20%, Nursing Care Performance 30%, Records Management 30%, Timeliness 20%. Rated 5 (Exemplary) to 3 (Very Poor).</div>
    </div>
    <p class="foot">Based on the Level 4 Skills Enhancement Checklist, Nasogastric Tube (NGT) Feeding. A study simulation; always follow your agency's policy and your Clinical Instructor.</p>
  </div>`;
  scr.scrollTop = 0;
}
function startCase(id) {
  const c = CASES.find((x) => x.id === id);
  G = newRun(c, MODE); store.set("mode", MODE);
  BIN = null; P.say = null; P.anim = null; P.pour = null; P.phT = 0; P.prepOpen = false;
  W.p.x = 560; W.p.y = 530; W.p.dir = "up"; W.p.target = null; W.hobShown = G.hob; W.dist = 0; W.title = false; W.camX = 0; W.camY = 0;
  $("#screen").hidden = true;
  $("#hudPatient").textContent = c.name + " · Bed 3";
  $("#hudMode").textContent = MODE === "demo" ? "Return demo" : "Practice"; $("#hudMode").classList.toggle("demo", MODE === "demo");
  $("#btnHint").disabled = MODE === "demo";
  renderChecklist(); renderTray(); renderLog(); updateHud(); resizeWorld();
  const target = c.outcome === "feed" ? 80 : 55;
  openModal("Shift endorsement", "13:45 · Ward 7", `
    <div class="speech"><b>Charge nurse:</b> "Bed 3, ${esc(c.name)}, ${c.age}, ${esc(c.dx.toLowerCase())}. NGT feeding due at 14:00. The chart is at the nurses' station. ${MODE === "demo" ? "Your CI is here for your return demonstration." : "Your CI will coach you."}"</div>
    <div class="grid2"><div class="card"><h4>Your goal</h4><p style="margin:0">Carry out the NGT feeding from assessment to documentation. Finish by submitting nurse's notes at the computer.</p></div>
    <div class="card"><h4>Time frame</h4><p style="margin:0">About <b>${target} ward minutes</b> of active care. Walking and every action cost time. Required waiting does not count.</p></div></div>
    <div class="row" style="margin-top:14px"><button class="btn primary" type="button" data-close="1">Start shift</button></div>`,
    { onClose: () => { W.paused = false; logEv("info", "Shift started. Feeding due at 14:00."); } });
}
function showResults(sc) {
  const c = G.c, r = sc.res, scr = $("#screen");
  const row = (k) => `<tr><td>${CATS[k].name} <span class="muted">(${CATS[k].weight}%)</span></td>${SCALE.map((s) => `<td class="${r[k].v === s.v ? "hit" : ""}">${r[k].v === s.v ? "●" : ""}</td>`).join("")}<td class="num">${(r[k].v * CATS[k].weight / 100).toFixed(2)}</td></tr>`;
  const okItems = sc.items.filter((d) => G.items[d.id] && G.items[d.id].ok);
  const missed = sc.items.filter((d) => !G.items[d.id]);
  scr.hidden = false;
  scr.innerHTML = `<div class="results">
    <div class="res-head"><div><div class="kicker" style="font-family:var(--f-display);letter-spacing:.16em;color:var(--muted);text-transform:uppercase">${G.mode === "demo" ? "Return demonstration" : "Practice"} · ${esc(c.name)}</div>
      <h1>${G.stopped ? "Demo stopped" : "Case complete"}</h1></div>
      <div class="grade"><div class="big">${sc.total.toFixed(2)}</div><div class="lab">${sc.label}</div><div class="mono" style="font-size:12px;color:var(--ink-2)">${Math.round(sc.total / 5 * 100)}% weighted</div></div></div>
    ${G.stopped ? `<div class="stopped"><b>Your CI stopped the demonstration:</b> ${esc(G.stopped.msg)}<br><span style="color:#f3c6c8">${esc(G.stopped.why)}</span></div>` : ""}
    <div class="rubric"><table><thead><tr><th>Criteria</th>${SCALE.map((s) => `<th>${s.label}<br><span class="mono">${s.v}</span></th>`).join("")}<th>Weighted</th></tr></thead>
      <tbody>${row("A")}${row("N")}${row("R")}${row("T")}<tr><td colspan="6" style="text-align:right"><b>Total</b></td><td class="num"><b>${sc.total.toFixed(2)}</b></td></tr></tbody></table>
      <p class="mono" style="font-size:12px;margin:8px 0 0;color:var(--ink-2)">Active time ${Math.round(r.T.used)} of ${r.T.target} min · walked ${Math.round(W.dist / 48)} floor tiles · ${G.errors.length} deduction${G.errors.length === 1 ? "" : "s"} · CI hints ${G.hintsUsed}</p></div>
    <div class="debrief">
      <div class="card"><h4>Fix next time</h4><ul>${G.errors.map((e) => `<li><b>${esc(e.msg)}</b><small>${esc(e.why)}</small></li>`).join("")}${missed.map((d) => `<li><b>Missed: ${esc(d.label)}</b><small>${esc(WHY[d.id] || "")}</small></li>`).join("") || ""}${!G.errors.length && !missed.length ? "<li>Nothing. A clean run.</li>" : ""}</ul></div>
      <div class="card"><h4>Done well</h4><ul>${okItems.map((d) => `<li>${esc(d.label)}</li>`).join("") || "<li>Keep practicing. Start with the chart.</li>"}</ul></div>
    </div>
    <div class="row"><button class="btn primary" type="button" data-res="retry">Retry this client</button>${CASES.indexOf(c) < CASES.length - 1 ? `<button class="btn" type="button" data-res="next">Next client</button>` : ""}<button class="btn" type="button" data-res="menu">All clients</button></div>
  </div>`;
  scr.scrollTop = 0;
}

/* ---------- wiring ---------- */
function wire() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-tab]"); if (!t) return;
    audioCtx();
    const d = t.dataset;
    if (t.id === "modalClose" || d.close) return closeModal();
    if (d.tab) { $$(".tab").forEach((x) => x.classList.toggle("on", x === t)); ["check", "tray", "log"].forEach((k) => { $("#pane-" + k).hidden = k !== d.tab; }); return; }
    if (d.mode) { MODE = d.mode; store.set("mode", MODE); $$(".mode-card").forEach((x) => { x.classList.toggle("on", x.dataset.mode === MODE); x.setAttribute("aria-checked", x.dataset.mode === MODE); }); sfx("click"); return; }
    if (d.case) return startCase(d.case);
    if (d.res) { const c = G.c; if (d.res === "retry") return startCase(c.id); if (d.res === "next") return startCase(CASES[CASES.indexOf(c) + 1].id); return showTitle(); }
    if (d.chart) return openChart(d.chart);
    if (d.plan) return submitPlan();
    if (d.cart) return toggleCart(d.cart);
    if (d.hh) return hhStep(d.hh);
    if (d.bin) return binAct(d.bin, d.val);
    if (d.bedp != null) return bedAct(d.bedp);
    if (d.pt) return patientAct("pt", d.pt);
    if (d.id && t.closest("#modalBody")) return patientAct("id", d.id);
    if (d.ex) return patientAct("ex", d.ex);
    if (d.as) return patientAct("as", d.as);
    if (d.in) return patientAct("in", d.in);
    if (d.ev) return patientAct("ev", d.ev);
    if (d.proc) return procAct(d.proc, d.arg);
    if (d.dec) return decide(d.dec, d.val);
    if (d.prep) return prepAct(d.prep, d.val);
    if (d.doc) return submitDocs(d.doc);
    if (d.leave) { closeModal(); return showTitle(); }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.procRange) { procAct("height", t.value); updateReadouts(); }
    if (t.dataset.bedr) { BEDTMP.a = +t.value; BEDTMP.side = false; $("#hobV").textContent = t.value + "°"; const card = t.closest(".sheet-body").querySelector(".card"); card.innerHTML = bedSvg(BEDTMP.a, false); }
  });
  $("#btnMute").onclick = () => { AUD.on = !AUD.on; store.set("sound", AUD.on); $("#btnMute").classList.toggle("off", !AUD.on); if (AUD.on) sfx("tick"); };
  $("#btnMute").classList.toggle("off", !AUD.on);
  $("#btnHint").onclick = () => { if (!G) return; if (G.mode === "demo") { toast("No hints during a return demonstration.", "info"); return; } G.ciHidden = !G.ciHidden; if (!G.ciHidden) G.hintsUsed++; hudTick = 0; updateHud(); };
  $("#btnMenu").onclick = () => {
    if (!G || G.over) return showTitle();
    openModal("Leave this case?", "Menu", `<p>Your progress on ${esc(G.c.name)} will be lost.</p><div class="row"><button class="btn danger" type="button" data-leave="1">Leave to client list</button><button class="btn" type="button" data-close="1">Keep playing</button></div>`);
  };
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") { if (e.key === "Escape") closeModal(); return; }
    if (e.key === "Escape") { if ($("#ciPop")) $("#ciPop").remove(); else closeModal(); }
    if (e.key.toLowerCase() === "h" && !modalOpen()) $("#btnHint").click();
    if (e.key.toLowerCase() === "m") $("#btnMute").click();
  });
  $("#modal").addEventListener("pointerdown", (e) => { if (e.target.id === "modal" && MODAL && MODAL.kind !== "bedside") closeModal(); });
  // touch controls
  const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (coarse) {
    $("#touch").hidden = false;
    const stick = $("#stick"), knob = $("#knob");
    let id = null;
    const move = (e) => { const r = stick.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), max = r.width / 2 - 10; if (m > max) { dx = dx / m * max; dy = dy / m * max; } knob.style.transform = `translate(${dx}px,${dy}px)`; W.joy = { x: dx / max, y: dy / max, on: true }; };
    stick.addEventListener("pointerdown", (e) => { id = e.pointerId; stick.setPointerCapture(id); move(e); audioCtx(); });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId === id) move(e); });
    const end = () => { id = null; knob.style.transform = ""; W.joy = { x: 0, y: 0, on: false }; };
    stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
    $("#useBtn").addEventListener("click", () => interactNearest());
  }
}

/* ---------- main loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  updateWorld(dt);
  if (G && !G.over) updateProc(dt);
  drawWorld();
  if (P.open && P.ctx && G) drawProc(P.ctx, procState(), W.t, P.dpr);
  const hero = $("#heroCv");
  if (hero && !$("#screen").hidden) { if (hero.width !== 960) { hero.width = 960; hero.height = 600; } drawProc(hero.getContext("2d"), demoState(W.t), W.t, 1.5); }
  requestAnimationFrame(frame);
}
function boot() {
  initWorld($("#world"));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { W.floor = buildFloor(); });
  wire();
  showTitle();
  requestAnimationFrame(frame);
}
boot();
// Read-only handle for the automated playtest (tools/playtest.mjs).
window.__ngt = { interact, state: () => G, world: W };
