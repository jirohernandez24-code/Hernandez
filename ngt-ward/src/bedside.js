/* ================= BEDSIDE: close-up procedure with animated equipment ================= */
const PW = 640, PH = 400;
const P = { cv: null, ctx: null, open: false, anim: null, pour: null, say: null, phT: 0, lastFlowMsg: 0, demo: null };
const PH_COLORS = ["#e0464b", "#e8643e", "#f08a3a", "#f2b23c", "#e9c83a", "#c5cf47", "#8cc152", "#5aae6a", "#3a9d8f", "#3a8fbf", "#4a6fc0"];
const phColor = (v) => PH_COLORS[clamp(Math.round(v) - 1, 0, 10)];
const barrelTotal = () => G.layers.reduce((s, l) => s + l.ml, 0);
const rate = () => 3 + 15 * G.height; // mL per real second (1 s = 1 ward minute while feeding)

/* ---------- simulation ---------- */
function updateProc(dt) {
  if (!G || G.over) return;
  P.phT = Math.min(1.5, P.phT + (G.phStage >= 1 ? dt : 0));
  if (G.phStage === 1 && P.phT >= 1.4) { G.phStage = 2; renderBedside(); }
  const canFlow = G.syrOn && !G.plunger && !G.clampOn;
  G.flowing = false;
  if (canFlow && G.layers.length) {
    G.flowing = true;
    let need = rate() * dt;
    const r = rate();
    while (need > 0 && G.layers.length) {
      const l = G.layers[0], take = Math.min(l.ml, need);
      l.ml -= take; need -= take;
      if (l.t === "feed") { G.fedFeed += take; if (G.feedStart == null) G.feedStart = G.clock; }
      else G.fedWater += take;
      if (l.ml <= 0.001) G.layers.shift();
    }
    G.clock += dt; // ward time runs at a minute per second during gravity flow
    // discomfort from a fast flow
    if (r > 13.5) G.discomfort = Math.min(1.4, G.discomfort + (r - 13.5) * 0.06 * dt);
    else G.discomfort = Math.max(0, G.discomfort - 0.05 * dt);
    if (G.discomfort > 1 && !G.items.i_flow) {
      fault("N", 1.5, "Feeding ran too fast: the client is cramping and nauseated.", "Raise the syringe less. Gravity feedings must flow in slowly to prevent cramping, nausea and regurgitation.", false, "i_flow");
      P.say = { text: "Ugh... my stomach hurts.", until: W.t + 3 };
    }
    // cramp event midway
    if (G.crampState === 0 && G.fedFeed >= G.c.amount * 0.45) {
      G.crampState = 1; G.crampAt = W.t; P.say = { text: "Nurse... I feel a little crampy.", until: W.t + 4 };
      logEv("info", "Client reports mild cramping during the feeding.");
      sfx("warn"); renderBedside();
    }
    if (G.crampState === 1 && W.t - G.crampAt > 6) {
      G.crampState = 3; G.discomfort = Math.min(1.4, G.discomfort + .5);
      fault("N", 1, "Kept the feeding running while the client had cramps.", "Pinch or clamp the tube to stop the flow for a minute when the client feels discomfort, then resume.", false, "i_flow");
    }
    if (!G.layers.length) { // barrel ran dry with the tube open
      const feedingDone = G.fedFeed >= G.c.amount - 1;
      if (!feedingDone || G.fedWater < 1) {
        G.airIn++;
        fault("N", 1.5, "The barrel ran dry: air entered the tube.", "Add the next portion (or the water flush) before the feeding drains from the neck of the syringe. Air causes gastric distention.", false, feedingDone ? "i_flush" : "i_flow");
      } else {
        G.airIn++;
        fault("N", 1, "All the water drained before you clamped.", "Clamp the feeding tube before all of the water is instilled so air does not enter the stomach.", false, "i_clamp");
      }
      G.feedEnd = G.feedEnd || G.clock;
      renderBedside();
    }
  } else if (G.crampState === 2) {
    G.crampPausedFor += dt;
    if (G.crampPausedFor >= 2.2) { G.crampState = 3; G.discomfort = Math.max(0, G.discomfort - .4); P.say = { text: "That's better. You can continue.", until: W.t + 3 }; logEv("ok", "Paused the feeding; cramping eased."); renderBedside(); }
  }
  if (P.open && W.t - (P.roT || 0) > .1) { P.roT = W.t; updateReadouts(); }
}

/* ---------- actions ---------- */
function startInvasive() {
  if (G.invasive) return;
  G.invasive = true;
  if (!G.identified) fault("N", 1, "Started before verifying the client's identity.", "Introduce yourself and verify identity with two identifiers before any procedure.", false, "p_identify");
  if (!G.explained) fault("N", 1, "Started without explaining the procedure.", "Explain what you will do, why, and how the client can participate. It reduces anxiety and gains cooperation.", false, "p_explain");
  if (G.curtainTarget < 1) fault("N", .5, "No privacy provided before starting.", "Tube feedings are embarrassing to some people. Close the curtain.", false, "p_privacy");
  else mark("p_privacy");
  const missing = SUPPLIES.filter((s) => s.req && !G.tray.has(s.key));
  if (missing.length) fault("N", .5, "Equipment incomplete at the bedside: " + missing.map((m) => m.label).join(", ") + ".", "Prepare all the necessary equipment before you start so the procedure is not interrupted.", false, "p_equip");
  else mark("p_equip");
}
function procAct(act, arg) {
  if (!G || G.over) return;
  const c = G.c;
  const no = (msg) => { toast(msg, "info"); sfx("drop"); };
  switch (act) {
    case "gloves": {
      if (G.gloves) { // removing
        if (G.syrOn) return no("Detach the syringe before removing your gloves.");
        G.gloves = false;
        if (G.plugged && G.invasiveDone) {
          if (!G.disposed) fault("N", .5, "Removed gloves before disposing of the equipment.", "Dispose of the equipment first, then remove and discard the gloves, then perform hand hygiene.", false);
          G.glovesOff = true; mark("i_glovesoff"); logEv("ok", "Removed and discarded gloves.");
        } else logEv("info", "Removed gloves.");
        advance(.3); sfx("pick"); break;
      }
      if (!G.tray.has("gloves")) return no("You have no clean gloves. Get them from the supply cart.");
      if (G.glovesOff) return no("The procedure is finished. Perform hand hygiene.");
      if (!G.hhBefore) fault("N", 1, "Put on gloves without hand hygiene.", "Perform hand hygiene before applying clean gloves to prevent transmitting microorganisms.", false, "p_hh");
      G.gloves = true; G.glovesEver = true; mark("p_gloves"); logEv("ok", "Applied clean gloves."); advance(.4); sfx("pick");
      break;
    }
    case "plug": {
      if (G.syrOn) return no("Detach the syringe first.");
      if (!G.gloves && G.plug) { fault("N", 1, "Handled the tube without gloves.", "Apply clean gloves before touching the tube end; gastric contents are body fluids.", false, "p_gloves"); }
      G.plug = !G.plug;
      if (G.plug) {
        if (G.invasive && (G.fedWater > 0 || G.placement === "hold" || G.grvDecision === "hold")) {
          G.plugged = true; G.invasiveDone = true;
          if (!G.clampOn) fault("N", .5, "Plugged the tube without clamping it first.", "Clamp the feeding tube, then cover the end with the plug.", false, "i_clamp");
          else if (!G.items.i_clamp) mark("i_clamp");
          if (c.outcome === "feed" && G.fedWater >= 45 && G.fedWater <= 105 && !G.items.i_flush) mark("i_flush");
          else if (c.outcome === "feed" && G.fedWater < 45) fault("N", 1, `Flushed only ${Math.round(G.fedWater)} mL of water.`, "Instill 50 to 100 mL of water to clear the tube and keep it patent.", false, "i_flush");
          if (c.outcome === "feed" && !G.items.i_flow) mark("i_flow");
          G.feedEnd = G.feedEnd || G.clock;
          logEv("ok", "Tube clamped and plugged.");
        }
      } else { startInvasive(); logEv("info", "Removed the plug from the tube."); }
      advance(.2); sfx("click"); break;
    }
    case "clamp": {
      G.clampOn = !G.clampOn; sfx("click"); advance(.1);
      if (G.clampOn) {
        if (G.crampState === 1) { G.crampState = 2; G.crampPausedFor = 0; logEv("info", "Clamped the tube to pause the feeding."); }
        if (G.layers.length && G.layers[0].t === "water" && G.fedFeed >= c.amount - 1 && G.fedWater >= 1) {
          G.clampedEnd = true; G.feedEnd = G.clock;
          // what remains in the barrel is discarded
          logEv("ok", `Clamped with ${Math.round(barrelTotal())} mL water left in the neck.`);
        }
      } else if (G.crampState === 2 && G.crampPausedFor < 2.2) {
        G.crampState = 1; G.crampAt = W.t;
        toast("Too soon. Let the client rest a moment before resuming.", "info");
      }
      break;
    }
    case "attach": {
      if (!G.tray.has("syringe")) return no("You need a 60 mL catheter-tip syringe from the supply cart.");
      if (G.syrOn) { // detach
        if (!G.plunger && G.layers.length && !G.clampOn) return no("Clamp the tube first or the barrel contents will spill.");
        if (!G.plunger && G.layers.length) { logEv("info", `Discarded ${Math.round(barrelTotal())} mL left in the barrel.`); G.layers = []; }
        G.syrOn = false; sfx("click"); advance(.2); break;
      }
      if (G.plug) return no("Remove the plug from the tube end first.");
      if (!G.gloves) fault("N", 1, "Connected the syringe without gloves.", "Apply clean gloves before handling the tube.", false, "p_gloves");
      if (!G.plunger) {
        if (!G.clampOn) fault("N", .5, "Connected the barrel to an open tube.", "Pinching or clamping the tube before connecting prevents excess air from entering the stomach and causing distention.", false, "i_connect");
        else if (G.placement === "ok" && !G.items.i_connect) mark("i_connect");
      }
      G.syrOn = true; startInvasive(); sfx("click"); advance(.2);
      break;
    }
    case "plunger": {
      if (G.plunger) {
        if (G.syrAsp > 0) return no("Empty the syringe before removing the plunger.");
        if (G.syrOn && !G.clampOn) fault("N", .5, "Removed the plunger with the tube open.", "Clamp or pinch the tube first so air does not enter the stomach.", false, "i_connect");
        G.plunger = false; logEv("info", "Removed the plunger: the syringe is now a feeding barrel.");
        if (G.syrOn && G.clampOn && G.placement === "ok" && !G.items.i_connect) mark("i_connect");
      } else {
        if (G.layers.length) return no("Let the barrel empty or clamp and detach before inserting the plunger.");
        G.plunger = true;
      }
      sfx("pick"); advance(.1); break;
    }
    case "aspirate": {
      if (!G.syrOn) return no("Attach the syringe to the tube first.");
      if (!G.plunger) return no("Insert the plunger to aspirate.");
      if (G.clampOn) return no("The tube is clamped. Release the clamp to aspirate.");
      if (G.syrAsp >= 59) return no("The syringe is full. Detach it and empty it into the measuring container.");
      if (P.anim) return;
      const take = Math.min(60 - G.syrAsp, G.stomachGrv);
      if (take <= 0) { toast("Nothing more returns: the stomach is empty of residual.", "info"); G.grvAllOut = true; checkGrv(); return; }
      P.anim = { type: "asp", t0: W.t, dur: .9, from: G.syrAsp, to: G.syrAsp + take };
      G.syrAsp += take; G.stomachGrv -= take; G.aspirations++;
      advance(.5); sfx("squelch");
      logEv("info", `Aspirated ${take} mL of gastric contents.`);
      if (G.stomachGrv <= 0) setTimeout(() => toast("Plunger resistance: no more contents return.", "info"), 900);
      break;
    }
    case "empty": {
      if (G.syrAsp <= 0) return no("The syringe is empty.");
      if (G.syrOn) return no("Clamp and detach the syringe first.");
      if (!G.tray.has("measure")) return no("You need the measuring container from the cart.");
      G.cupGastric += G.syrAsp; logEv("info", `Emptied ${G.syrAsp} mL into the measuring container (total ${G.cupGastric} mL).`);
      G.syrAsp = 0; P.pour = { from: "syr", t0: W.t }; sfx("pour"); advance(.3);
      checkGrv(); break;
    }
    case "phtest": {
      if (!G.tray.has("ph")) return no("You need pH test strips from the supply cart.");
      if (G.syrAsp <= 0 && G.cupGastric <= 0) return no("Aspirate a sample first.");
      if (G.phStage > 0) return no("You already tested this sample.");
      if (c.medAt != null && G.clock < c.medAt + 60) {
        fault("N", 1, `Tested pH at ${fmtClock(G.clock)}, less than an hour after the ${fmtClock(c.medAt)} medication.`, "Medication in the stomach can change the pH. Allow 1 hour to elapse before testing.", false, "i_medwait");
        if (G.mode === "practice") return;
      } else if (c.medAt != null) mark("i_medwait");
      G.phStage = 1; P.phT = 0; advance(1); sfx("pick"); logEv("info", "Placed aspirate on a pH strip.");
      break;
    }
    case "wait": {
      const until = c.medAt + 60; if (G.clock >= until) return;
      const m = until - G.clock; waitClock(m); logEv("info", `Waited ${Math.round(m)} min for the medication window.`); toast(`Ward time is now ${fmtClock(G.clock)}.`, "info"); break;
    }
    case "reinstill": {
      if (G.cupGastric <= 0) return no("There is nothing in the measuring container.");
      if (!G.syrOn || !G.plunger) return no("Attach the syringe with its plunger to push the contents back.");
      if (G.clampOn) return no("Release the clamp first.");
      P.anim = { type: "push", t0: W.t, dur: 1.2 };
      logEv("ok", `Re-instilled ${G.cupGastric} mL of gastric contents.`);
      G.cupGastric = 0; G.reinstilled = true; advance(1); sfx("squelch");
      if (G.grvDecision) mark("i_residual", G.grvDecisionOk);
      break;
    }
    case "discard": {
      if (G.cupGastric <= 0) return no("There is nothing to discard.");
      if (!G.tray.has("emesis")) return no("You need the emesis basin.");
      logEv("warn", `Discarded ${G.cupGastric} mL of gastric contents into the emesis basin.`);
      G.cupGastric = 0; G.discarded = true; advance(.3); sfx("pour");
      fault("N", .5, "Discarded the gastric residual.", "Agency policy: re-instill gastric contents to prevent loss of fluid and electrolytes.", false, "i_residual");
      break;
    }
    case "pourFeed": {
      if (!G.prep.poured || G.feedCup <= 0) return no(G.prep.poured ? "The ordered amount has all been poured." : "Prepare the formula first.");
      if (!G.syrOn || G.plunger) return no("Remove the plunger and connect the barrel to the tube first.");
      if (barrelTotal() >= 59) return no("The barrel is full.");
      if (!feedingAllowed()) return;
      const add = Math.min(60 - barrelTotal(), G.feedCup);
      const last = G.layers[G.layers.length - 1];
      if (last && last.t === "feed") last.ml += add; else G.layers.push({ t: "feed", ml: add });
      G.feedCup -= add; P.pour = { from: "feed", t0: W.t }; sfx("pour"); advance(.2);
      break;
    }
    case "pourWater": {
      if (!G.tray.has("water")) return no("You need room-temperature water from the cart.");
      if (G.waterCup <= 0) return no("The water cup is empty.");
      if (!G.syrOn || G.plunger) return no("Remove the plunger and connect the barrel to the tube first.");
      if (barrelTotal() >= 59) return no("The barrel is full.");
      if (G.fedFeed + feedInBarrel() < c.amount - 1 && c.outcome === "feed") return no("Finish the ordered feeding first; the flush follows it.");
      const add = Math.min(60 - barrelTotal(), G.waterCup);
      const last = G.layers[G.layers.length - 1];
      if (last && last.t === "water") last.ml += add; else G.layers.push({ t: "water", ml: add });
      G.waterCup -= add; P.pour = { from: "water", t0: W.t }; sfx("pour"); advance(.2);
      break;
    }
    case "height": G.height = clamp(+arg, 0, 1); return;
    case "secure": {
      if (!G.plugged) return no("Clamp and plug the tube first.");
      if (G.secured) return;
      G.secured = true; mark("i_secure"); logEv("ok", "Secured the tubing to the client's gown."); advance(.4); sfx("tick");
      P.say = { text: "Thank you. It doesn't pull now.", until: W.t + 3 };
      break;
    }
    case "prep": openPrep(); return;
  }
  renderBedside();
}
function feedInBarrel() { return G.layers.filter((l) => l.t === "feed").reduce((s, l) => s + l.ml, 0); }
function feedingAllowed() {
  const c = G.c;
  if (G.placement !== "ok") return !blockCrit("Started a feeding without confirming tube placement.", "Always aspirate and check pH before a feeding. A misplaced tube can deliver feeding into the lungs.", "i_placement");
  if (c.outcome !== "hold_ph" && !G.grvDecision) return !blockCrit("Started a feeding without checking the residual.", "Aspirate and measure the residual before each feeding to detect delayed gastric emptying.", "i_residual");
  if (G.grvDecision === "hold") return no2("You decided to hold this feeding.");
  if (G.hob < 30 && !G.sideLying) return !blockCrit(`Started a feeding with the head of bed at ${Math.round(G.hob)}°.`, "Fowler's position (at least 30°) uses gravity and prevents aspiration of fluid into the lungs.", "p_position");
  if (!G.items.p_position) mark("p_position");
  return true;
}
function no2(msg) { toast(msg, "info"); return false; }
/* In practice, the CI stops an unsafe action; in a return demonstration it ends the run. Returns true when blocked. */
function blockCrit(msg, why, itemId) {
  fault("N", 3, msg, why, true, itemId);
  return true;
}
function checkGrv() {
  if (G.grvMeasured || G.placement !== "ok") return;
  if (G.stomachGrv <= 0 && G.syrAsp <= 0) {
    G.grvMeasured = true; G.grvValue = G.cupGastric;
    logEv("info", `Residual measured: ${G.cupGastric} mL.`);
    renderBedside();
  }
}

/* ---------- decisions ---------- */
function decide(kind, val) {
  const c = G.c;
  if (kind === "phread") {
    G.phRead = +val;
    if (G.phRead !== c.ph) fault("N", 1, `Read the strip as pH ${G.phRead}; it showed pH ${c.ph}.`, "Compare the strip with the color chart in good light before deciding.", false, "i_placement");
    advance(.3);
  } else if (kind === "phint") {
    if (c.ph <= 5.5) {
      if (val === "ok") { G.placement = "ok"; if (!G.items.i_placement) mark("i_placement"); logEv("ok", `pH ${c.ph}: gastric placement confirmed.`); checkGrv(); }
      else { fault("N", .5, "Held a feeding even though pH confirmed gastric placement.", "pH 1 to 5.5 is consistent with gastric placement; proceed and assess residual."); renderBedside(); return; }
    } else {
      if (val === "ok") { if (blockCrit(`Treated pH ${c.ph} as gastric placement.`, "pH 6 or higher does not confirm gastric placement (possible intestinal or respiratory placement). Do not use the tube; follow agency policy.", "i_placement")) { renderBedside(); return; } }
      else { G.placement = "hold"; G.notified = true; mark("i_placement"); mark("i_hold"); logEv("ok", `pH ${c.ph}: placement not confirmed. Feeding held; nurse in charge notified; X-ray requested.`); P.say = { text: "Nurse in charge: \"Good catch. I'll call the resident for an X-ray.\"", until: W.t + 5 }; }
    }
    advance(.5);
  } else if (kind === "grv") {
    const high = G.grvValue >= 100 || G.grvValue > c.prev.amount / 2;
    if (val === "hold") {
      G.grvDecision = "hold"; G.grvDecisionOk = high;
      if (high) { G.notified = true; mark("i_hold"); logEv("ok", `Residual ${G.grvValue} mL: feeding held, nurse in charge notified.`); P.say = { text: "Nurse in charge: \"Hold it. I'll inform the doctor and we'll recheck in an hour.\"", until: W.t + 5 }; }
      else { fault("N", 1, `Held the feeding for a residual of only ${G.grvValue} mL.`, "Below 100 mL and under half of the last feeding, the policy is to re-instill and proceed.", false, "i_residual"); G.grvDecision = null; renderBedside(); return; }
    } else {
      if (high) { if (blockCrit(`Planned to feed despite a residual of ${G.grvValue} mL.`, "A residual of 100 mL or more, or more than half the last feeding, means delayed emptying. Hold and notify to prevent vomiting and aspiration.", "i_hold")) { renderBedside(); return; } }
      G.grvDecision = "feed"; G.grvDecisionOk = val === "reinstill";
      if (val === "discard") fault("N", .5, "Discarded the gastric residual.", "Agency policy: re-instill gastric contents to prevent loss of fluid and electrolytes.", false, "i_residual");
      logEv("ok", `Residual ${G.grvValue} mL: within policy. Proceed with feeding.`);
    }
    advance(.5);
  }
  renderBedside();
}

/* ---------- formula preparation sub-panel ---------- */
function openPrep() {
  if (!G.formulaKey) { toast("You have no formula on your tray. Get the ordered formula from the cart.", "info"); return; }
  P.prepOpen = true; renderBedside();
}
function prepAct(step, val) {
  const c = G.c, item = c.cart.find((x) => x.key === G.formulaKey), kind = formulaKind(G.formulaKey);
  if (step === "label") {
    G.prep.expiry = item.expired ? "expired" : "ok";
    G.prep.labelRead = true;
    if (!item.expired && kind === c.formula) mark("i_expiry");
    advance(.3);
  } else if (step === "return") {
    G.tray.delete(G.formulaKey); G.formulaKey = null; G.prep = { expiry: null, temp: null, swab: false, poured: false };
    P.prepOpen = false; logEv("info", "Set the formula aside. Get the correct one from the supply cart.");
    if (item.expired) mark("i_expiry");
    renderTray(); toast("Go back to the supply cart for the correct formula.", "info");
  } else if (step === "temp") {
    G.prep.temp = val; advance(.5);
    if (val === "room") mark("i_temp");
    else fault("N", .5, val === "micro" ? "Microwaved the formula." : "Used formula straight from the refrigerator.", val === "micro" ? "Microwaving creates hot spots that can burn the mucosa. Use room temperature." : "Cold formula can cause cramping. Warm it to room temperature.", false, "i_temp");
  } else if (step === "swab") {
    if (!G.tray.has("alcohol")) { toast("You have no alcohol swabs. Get them from the cart.", "info"); return; }
    G.prep.swab = true; mark("i_swab"); advance(.3); sfx("tick");
  } else if (step === "pour") {
    if (G.cupGastric > 0) { toast("The measuring container still holds gastric contents. Re-instill or discard them first.", "info"); return; }
    if (!G.prep.labelRead) fault("N", 1, "Poured the feeding without checking its label and expiration date.", "Check the expiration date and the formula against the order before administering.", false, "i_expiry");
    if (item.expired) fault("N", 2, "Prepared an expired feeding.", "Expired formula may be contaminated or degraded. Replace it.", false, "i_expiry");
    if (kind === "milk" && c.lactose) { if (blockCrit("Prepared a milk-based formula for a lactose-intolerant client.", "Check the formula against allergies and intolerances; notify the primary care provider if incompatible.", "a_allergy")) return; }
    else if (kind !== c.formula) { if (blockCrit(`Prepared ${FORMULA_NAMES[kind]} instead of the ordered ${FORMULA_NAMES[c.formula]}.`, "Give exactly the type of feeding the order specifies.", "a_order")) return; }
    if (!G.prep.swab) fault("N", .5, "Opened the container without cleaning the top.", "Clean the top of the feeding container with alcohol before opening it (open system).", false, "i_swab");
    if (!G.prep.temp) fault("N", .5, "Did not check the feeding temperature.", "Warm the feeding to room temperature to prevent cramping.", false, "i_temp");
    if (!G.tray.has("measure")) { toast("You need the measuring container from the cart.", "info"); return; }
    G.prep.poured = true; G.feedCup = c.amount; P.prepOpen = false; advance(.8); sfx("pour");
    logEv("ok", `Poured ${c.amount} mL ${FORMULA_NAMES[kind]} into the measuring container.`);
  } else if (step === "close") P.prepOpen = false;
  renderBedside();
}

/* ---------- UI ---------- */
function openBedside() {
  openModal("Bedside procedure", G.c.name + " · Bed 3", `
    <div class="bedside">
      <div style="min-width:0">
        <div class="proc-canvas-wrap"><canvas id="proc" width="${PW}" height="${PH}" aria-label="Close-up of the client, nasogastric tube, syringe and equipment"></canvas></div>
        <div class="readouts" id="readouts"></div>
        <div id="decision" style="margin-top:10px"></div>
      </div>
      <div class="controls" id="controls"></div>
    </div>`, { wide: true, kind: "bedside" });
  P.cv = $("#proc"); P.ctx = P.cv.getContext("2d"); P.open = true;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); P.cv.width = PW * dpr; P.cv.height = PH * dpr; P.dpr = dpr;
  renderBedside();
}
function renderBedside() {
  if (!P.open || !$("#controls")) return;
  const c = G.c, b = (act, label, opts = {}) => `<button class="btn ${opts.on ? "on-state" : ""}" type="button" data-proc="${act}" ${opts.dis ? "disabled" : ""} ${opts.arg != null ? `data-arg="${opts.arg}"` : ""}>${label}</button>`;
  let html = `<div class="cgroup"><h4>Hands &amp; tube</h4><div class="row">
    ${b("gloves", G.gloves ? "Remove gloves" : "Apply clean gloves", { on: G.gloves })}
    ${b("plug", G.plug ? "Remove plug" : "Insert plug")}
    ${b("clamp", G.clampOn ? "Release clamp" : "Clamp / pinch tube", { on: G.clampOn })}
  </div></div>
  <div class="cgroup"><h4>60 mL syringe</h4><div class="row">
    ${b("attach", G.syrOn ? "Detach syringe" : "Attach syringe", { on: G.syrOn })}
    ${b("plunger", G.plunger ? "Remove plunger" : "Insert plunger")}
    ${b("aspirate", "Aspirate (pull plunger)")}
    ${b("empty", "Empty into container")}
    ${b("phtest", "Test pH")}
    ${G.grvMeasured && G.cupGastric > 0 ? b("reinstill", "Re-instill contents") + b("discard", "Discard into basin") : ""}
  </div></div>`;
  if (c.medAt != null && G.clock < c.medAt + 60 && G.placement == null)
    html += `<div class="cgroup"><h4>Medication given at ${fmtClock(c.medAt)}</h4><div class="row">${b("wait", "Wait until " + fmtClock(c.medAt + 60))}</div></div>`;
  if (c.outcome === "feed" || G.prep.poured) {
    html += `<div class="cgroup"><h4>Feeding</h4><div class="row">
      ${b("prep", G.prep.poured ? "Formula ready ✓" : "Prepare formula", { dis: G.prep.poured })}
      ${b("pourFeed", `Pour feeding (${Math.round(G.feedCup)} mL left)`, { dis: !G.prep.poured })}
      ${b("pourWater", `Pour water (${Math.round(G.waterCup)} mL)`)}
    </div>
    <div class="height-ctl" style="margin-top:10px"><label for="hctl">Syringe height</label><input id="hctl" type="range" min="0" max="1" step="0.01" value="${G.height}" data-proc-range="height"><span class="mono" id="hval"></span></div></div>`;
  }
  html += `<div class="cgroup"><h4>Finish</h4><div class="row">${b("secure", G.secured ? "Tube secured ✓" : "Secure tubing to gown", { dis: G.secured })}</div></div>`;
  $("#controls").innerHTML = html;
  // decisions
  let d = "";
  if (P.prepOpen) d = prepHtml();
  else if (G.phStage === 2 && G.phRead == null) {
    d = `<div class="decision"><h4>Read the strip</h4><p class="muted" style="margin:0 0 8px">Match the strip to the color chart.</p><div class="ph-chart">${PH_COLORS.slice(0, 9).map((col, i) => `<button type="button" class="ph-chip" style="background:${col}" data-dec="phread" data-val="${i + 1}">${i + 1}</button>`).join("")}</div></div>`;
  } else if (G.phRead != null && G.placement == null) {
    d = `<div class="decision"><h4>pH ${G.phRead}. What next?</h4><div class="stack">
      <button class="btn" type="button" data-dec="phint" data-val="ok">Gastric placement confirmed (pH 5.5 or lower). Continue.</button>
      <button class="btn" type="button" data-dec="phint" data-val="hold">Placement not confirmed (pH 6 or higher). Follow agency policy: hold, notify the nurse in charge, request X-ray.</button></div></div>`;
  } else if (G.grvMeasured && !G.grvDecision && G.placement === "ok") {
    d = `<div class="decision"><h4>Residual ${G.grvValue} mL · last feeding ${c.prev.amount} mL</h4><div class="stack">
      <button class="btn" type="button" data-dec="grv" data-val="reinstill">Re-instill the contents and proceed with the feeding.</button>
      <button class="btn" type="button" data-dec="grv" data-val="discard">Discard the contents and proceed with the feeding.</button>
      <button class="btn" type="button" data-dec="grv" data-val="hold">Re-instill, hold the feeding, and notify the nurse in charge.</button></div></div>`;
  } else if (G.crampState === 1) {
    d = `<div class="note warn"><b>The client reports cramping.</b> Stop the flow for a minute.</div>`;
  }
  $("#decision").innerHTML = d;
  updateReadouts();
}
function prepHtml() {
  const c = G.c, item = c.cart.find((x) => x.key === G.formulaKey), kind = formulaKind(G.formulaKey);
  const p = G.prep;
  let label = `<div class="card" style="display:flex;gap:12px;align-items:center">${iconSvg("formula", 56, FORMULA_COL[kind])}<div><b>${esc(item.label)}</b><br><span class="muted">${esc(item.sub)}</span></div></div>`;
  let verdict = "";
  if (p.labelRead) {
    if (item.expired) verdict = `<div class="note crit">Expired: ${esc(item.sub.split("EXP ")[1])}. Today is ${GAME_DATE}.</div>`;
    else if (kind === "milk" && c.lactose) verdict = `<div class="note crit">Contains milk (lactose). Check this against the client's intolerance.</div>`;
    else if (kind !== c.formula) verdict = `<div class="note crit">Label says ${FORMULA_NAMES[kind]}. Order says ${FORMULA_NAMES[c.formula]}.</div>`;
    else verdict = `<div class="note ok">Matches the order. Not expired.</div>`;
  }
  const t = (v, txt) => `<button class="btn ${p.temp === v ? "picked" : ""}" type="button" data-prep="temp" data-val="${v}">${txt}</button>`;
  return `<div class="decision"><h4>Prepare the formula (open system)</h4><div class="stack">${label}
    <div class="row"><button class="btn" type="button" data-prep="label">Check label &amp; expiry</button><button class="btn" type="button" data-prep="return">Set aside, get another</button></div>${verdict}
    <div><b style="font-size:13px">Temperature</b><div class="row" style="margin-top:4px">${t("room", "Room temperature")}${t("micro", "Warm in microwave")}${t("cold", "Straight from the fridge")}</div></div>
    <div class="row"><button class="btn ${p.swab ? "picked" : ""}" type="button" data-prep="swab">Clean top with alcohol swab</button>
    <button class="btn primary" type="button" data-prep="pour">Pour ${c.amount} mL into container</button>
    <button class="btn ghost" type="button" data-prep="close">Close</button></div></div></div>`;
}
function updateReadouts() {
  const el = $("#readouts"); if (!el) return;
  const comfort = clamp(1 - G.discomfort, 0, 1);
  const dur = G.feedStart != null ? Math.round((G.feedEnd || G.clock) - G.feedStart) : 0;
  el.innerHTML = `
    <div class="ro"><span>Barrel</span><b style="${G.flowing && barrelTotal() < 15 ? "color:var(--crit)" : ""}">${G.plunger ? Math.round(G.syrAsp) : Math.round(barrelTotal())} mL</b></div>
    <div class="ro"><span>Feeding in</span><b>${Math.round(G.fedFeed)}/${G.c.amount}</b></div>
    <div class="ro"><span>Water in</span><b>${Math.round(G.fedWater)} mL</b></div>
    <div class="ro"><span>Flow</span><b>${G.flowing ? Math.round(rate()) + "/min" : "—"}</b></div>
    <div class="ro"><span>Container</span><b>${Math.round(G.cupGastric)} mL</b></div>
    <div class="ro"><span>Ward time</span><b>${fmtClock(G.clock)}</b></div>
    <div class="ro"><span>Feed time</span><b>${dur} min</b></div>
    <div class="ro"><span>Comfort</span><div class="meter"><i style="width:${comfort * 100}%;background:${comfort > .6 ? "var(--ok)" : comfort > .3 ? "var(--warn)" : "var(--crit)"}"></i></div></div>`;
  const hv = $("#hval"); if (hv) hv.textContent = Math.round(rate()) + " mL/min";
}

/* ---------- drawing the close-up ---------- */
function drawProc(ctx, S, t, dpr) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // room
  const g = ctx.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, "#bfd9d2"); g.addColorStop(.62, "#d4e6e1"); g.addColorStop(.62, "#c8b49a"); g.addColorStop(1, "#b39d82");
  ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(0, 246, PW, 3);
  const a = (S.sideLying ? 20 : S.hob) * Math.PI / 180, Hx = 330, Hy = 300;
  // bed base
  ctx.fillStyle = "#93a3a8"; ctx.fillRect(0, Hy + 12, Hx + 20, 22);
  ctx.fillStyle = "#f4f7f7"; ctx.fillRect(0, Hy - 4, Hx + 10, 18);
  ctx.save(); ctx.translate(Hx, Hy); ctx.rotate(a);
  // backrest mattress
  ctx.fillStyle = "#eef3f3"; rr(ctx, -240, -6, 244, 20, 6); ctx.fill();
  ctx.fillStyle = "#93a3a8"; ctx.fillRect(-240, 14, 244, 6);
  // pillow
  ctx.fillStyle = "#fff"; rr(ctx, -238, -30, 76, 28, 12); ctx.fill(); ctx.strokeStyle = "#d5dfdf"; ctx.lineWidth = 1; ctx.stroke();
  // torso in gown
  ctx.fillStyle = "#dfeaf2"; rr(ctx, -160, -50, 170, 48, 20); ctx.fill();
  ctx.fillStyle = "#a9c3d8"; for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(-145 + i * 22 + j * 11, -38 + j * 18, 1.8, 0, Math.PI * 2); ctx.fill(); }
  // stomach window
  const full = clamp((S.stomach || 0) / 400, 0, 1);
  ctx.save(); ctx.globalAlpha = .9;
  ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.strokeStyle = "#b5838d"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-55, -26, 26, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.ellipse(-55, -26, 25, 14, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = S.stomachTint || "#d9cf8a"; ctx.fillRect(-81, -12 - 28 * full, 52, 28 * full + 2);
  ctx.restore(); ctx.restore();
  ctx.fillStyle = "#6b4d55"; ctx.font = "700 8px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center"; ctx.fillText("STOMACH", -55, -2);
  // arm
  ctx.fillStyle = "#dfeaf2"; rr(ctx, -120, -28, 70, 18, 9); ctx.fill();
  ctx.fillStyle = S.skin; rr(ctx, -56, -27, 38, 15, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillRect(-44, -27, 6, 15); // ID band
  // head (profile, face up toward local -y)
  const hx = -190, hy = -42;
  ctx.fillStyle = S.skin; ctx.beginPath(); ctx.arc(hx, hy, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = S.skin; ctx.beginPath(); ctx.ellipse(hx + 26, hy - 6, 14, 11, 0, 0, Math.PI * 2); ctx.fill(); // jaw/chin
  // neck
  ctx.fillStyle = S.skin; ctx.fillRect(hx + 22, hy - 8, 26, 22);
  // nose
  ctx.beginPath(); ctx.moveTo(hx - 4, hy - 30); ctx.quadraticCurveTo(hx - 2, hy - 48, hx + 8, hy - 32); ctx.closePath(); ctx.fill();
  // hair
  ctx.fillStyle = S.hair; ctx.beginPath(); ctx.arc(hx - 4, hy + 2, 32, Math.PI * .55, Math.PI * 1.35); ctx.closePath(); ctx.fill();
  if (S.sex === "F") { ctx.beginPath(); ctx.ellipse(hx - 26, hy + 18, 12, 16, .4, 0, Math.PI * 2); ctx.fill(); }
  // ear
  ctx.fillStyle = "#d39b78"; ctx.beginPath(); ctx.ellipse(hx + 2, hy + 4, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
  // eye
  const blink = (t % 4.1) < .14 || S.eyesClosed;
  ctx.strokeStyle = "#3b2a22"; ctx.fillStyle = "#3b2a22"; ctx.lineWidth = 2;
  if (blink) { ctx.beginPath(); ctx.moveTo(hx - 16, hy - 20); ctx.lineTo(hx - 8, hy - 22); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(hx - 12, hy - 21, 2.6, 0, Math.PI * 2); ctx.fill(); }
  // brow + mouth by comfort
  const pain = S.discomfort > .5;
  ctx.beginPath(); ctx.moveTo(hx - 20, hy - 26 - (pain ? 2 : 0)); ctx.lineTo(hx - 7, hy - 28 + (pain ? 3 : 0)); ctx.stroke();
  ctx.beginPath();
  if (pain) { ctx.moveTo(hx + 12, hy - 25); ctx.quadraticCurveTo(hx + 17, hy - 28, hx + 21, hy - 24); }
  else { ctx.moveTo(hx + 12, hy - 27); ctx.quadraticCurveTo(hx + 16, hy - 24, hx + 21, hy - 27); }
  ctx.stroke();
  if (pain) { ctx.fillStyle = "#7cc1ea"; ctx.beginPath(); ctx.arc(hx - 28, hy - 22, 3, 0, Math.PI * 2); ctx.fill(); }
  // nose tape
  ctx.fillStyle = "#fff"; ctx.save(); ctx.translate(hx + 1, hy - 38); ctx.rotate(.3); ctx.fillRect(-5, -4, 10, 8); ctx.restore();
  const m = ctx.getTransform(); ctx.restore();
  const toW = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); return [p.x / dpr, p.y / dpr]; };
  const nostril = toW(hx + 4, hy - 34), cheek = toW(hx + 34, hy - 30), shoulder = toW(hx + 70, hy - 54);
  // blanket over legs
  ctx.fillStyle = "#7fa9d6"; rr(ctx, Hx - 40, Hy - 30, PW - Hx + 60, 42, 14); ctx.fill();
  ctx.fillStyle = "#6a95c4"; for (let i = 0; i < 6; i++) ctx.fillRect(Hx - 20 + i * 50, Hy - 30, 4, 42);
  // ---- overbed table + equipment ----
  ctx.fillStyle = "#c8b49a"; ctx.fillRect(380, 350, 260, 14); ctx.fillStyle = "#a58d70"; ctx.fillRect(380, 364, 260, 6);
  // emesis basin
  ctx.fillStyle = "#c9d6dc"; ctx.beginPath(); ctx.ellipse(420, 344, 34, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#7d9aa3"; ctx.lineWidth = 1.5; ctx.stroke();
  // pH strip
  ctx.fillStyle = "#fff"; ctx.fillRect(458, 340, 56, 8); ctx.strokeStyle = "#9aa"; ctx.lineWidth = 1; ctx.strokeRect(458, 340, 56, 8);
  const phk = clamp(S.phT / 1.4, 0, 1), base = [242, 231, 160];
  const tgt = hexRgb(phColor(S.ph));
  ctx.fillStyle = S.phStage ? `rgb(${base.map((v, i) => Math.round(lerp(v, tgt[i], phk))).join(",")})` : "rgb(242,231,160)";
  ctx.fillRect(459, 341, 16, 6);
  if (S.phStage) { ctx.fillStyle = "rgba(201,196,106,.8)"; ctx.beginPath(); ctx.arc(467, 344, 3 * phk + 1, 0, Math.PI * 2); ctx.fill(); }
  // measuring container
  drawCup(ctx, 532, 286, 38, 64, S.cup, S.cupTint, "mL");
  // formula carton
  if (S.formulaCol) { ctx.fillStyle = "#fff"; rr(ctx, 580, 300, 26, 50, 4); ctx.fill(); ctx.fillStyle = S.formulaCol; ctx.fillRect(580, 316, 26, 16); ctx.fillStyle = "#7a4fd6"; ctx.fillRect(586, 294, 14, 7); if (S.swab) { ctx.fillStyle = "rgba(122,79,214,.25)"; ctx.fillRect(584, 300, 18, 3); } }
  // water cup
  drawCup(ctx, 610, 312, 24, 38, S.water, "#8fd0ef", "");
  // ---- tube + syringe ----
  const tipY = 300 - S.height * 170, sx = 470;
  const endX = S.syrOn ? sx : 430, endY = S.syrOn ? tipY + 18 : 330;
  // tube path: nostril -> over cheek -> taped at shoulder -> to end
  ctx.strokeStyle = "#e9dcae"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(nostril[0], nostril[1]); ctx.quadraticCurveTo(cheek[0], cheek[1] - 8, shoulder[0], shoulder[1]);
  const c1x = shoulder[0] + 60, c1y = shoulder[1] + 90;
  ctx.bezierCurveTo(c1x, c1y, endX - 40, endY + 60, endX, endY); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.lineCap = "butt";
  // tape on gown
  ctx.fillStyle = S.secured ? "#fff" : "rgba(255,255,255,.0)"; ctx.fillRect(shoulder[0] - 6, shoulder[1] - 4, 12, 9);
  // flow particles along the bezier
  if (S.flow) {
    const col = S.flow === "asp" ? "#c9c46a" : S.flowTint || "#efe3c3";
    for (let i = 0; i < 9; i++) {
      let k = ((t * .8 + i / 9) % 1); if (S.flow === "asp") k = 1 - k;
      const p = bez(shoulder, [c1x, c1y], [endX - 40, endY + 60], [endX, endY], 1 - k);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // clamp near end
  const cp = bez(shoulder, [c1x, c1y], [endX - 40, endY + 60], [endX, endY], .88);
  ctx.fillStyle = S.clampOn ? "#7a4fd6" : "#c9b8f5"; rr(ctx, cp[0] - 9, cp[1] - 6, 18, 12, 3); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "700 8px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(S.clampOn ? "SHUT" : "OPEN", cp[0], cp[1] + 3);
  if (!S.syrOn) {
    // tube end with plug
    ctx.fillStyle = "#e9dcae"; rr(ctx, endX - 5, endY - 4, 14, 10, 3); ctx.fill();
    if (S.plug) { ctx.fillStyle = "#7a4fd6"; rr(ctx, endX + 7, endY - 5, 10, 12, 3); ctx.fill(); }
    // syringe lying on table
    if (S.hasSyringe) drawSyringeFlat(ctx, 450, 330, S);
  } else {
    drawSyringeUp(ctx, sx, tipY, S, t);
  }
  // pour stream
  if (S.pour && S.syrOn && t - S.pour.t0 < .7) {
    const k = (t - S.pour.t0) / .7, src = S.pour.from === "water" ? [618, 306] : S.pour.from === "feed" ? [548, 280] : [548, 280];
    ctx.strokeStyle = S.pour.from === "water" ? "rgba(143,208,239,.9)" : S.pour.from === "syr" ? "rgba(201,196,106,.9)" : "rgba(239,227,195,.95)";
    ctx.lineWidth = 5 * (1 - k * .6); ctx.beginPath(); ctx.moveTo(src[0], src[1]); ctx.quadraticCurveTo(src[0] - 30, tipY - 160, sx, tipY - 120); ctx.stroke();
  }
  // speech
  if (S.say) drawProcBubble(ctx, toW(hx - 10, hy - 70), S.say);
  // HOB label
  ctx.fillStyle = "rgba(15,31,30,.8)"; rr(ctx, 12, 12, 108, 24, 6); ctx.fill();
  ctx.fillStyle = (S.hob >= 30 || S.sideLying) ? "#7ef0b0" : "#ffb4b4"; ctx.font = "700 12px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
  ctx.fillText(S.sideLying ? "R side-lying" : "HOB " + Math.round(S.hob) + "°", 22, 29);
  if (S.gloves) { ctx.fillStyle = "rgba(122,79,214,.9)"; rr(ctx, 126, 12, 74, 24, 6); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText("GLOVED", 137, 29); }
}
function drawCup(ctx, x, y, w, h, ml, tint, unit) {
  ctx.fillStyle = "rgba(238,246,248,.85)"; ctx.strokeStyle = "#7d9aa3"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 3, y + h); ctx.lineTo(x + 3, y + h); ctx.closePath(); ctx.fill();
  const max = w > 30 ? 300 : 100, k = clamp(ml / max, 0, 1);
  if (k > 0) { ctx.fillStyle = tint; ctx.fillRect(x + 3, y + h - (h - 4) * k, w - 6, (h - 4) * k); }
  ctx.stroke();
  ctx.strokeStyle = "#3a8fbf"; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 3, y + h - i * h / 5); ctx.lineTo(x + 10, y + h - i * h / 5); ctx.stroke(); }
  if (unit) { ctx.fillStyle = "#10201f"; ctx.font = "700 9px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText(Math.round(ml) + " " + unit, x + w / 2, y - 4); }
}
function drawSyringeFlat(ctx, x, y, S) {
  ctx.fillStyle = "rgba(244,248,251,.95)"; ctx.strokeStyle = "#5a6b6b"; ctx.lineWidth = 1.5;
  rr(ctx, x, y - 7, 64, 14, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#5a6b6b"; ctx.fillRect(x + 64, y - 2, 10, 4);
  if (S.syrAsp > 0) { ctx.fillStyle = "#c9c46a"; ctx.fillRect(x + 64 - 60 * S.syrAsp / 60, y - 5, 60 * S.syrAsp / 60, 10); }
  if (S.plunger) { ctx.fillStyle = "#7a4fd6"; ctx.fillRect(x - 26, y - 2, 28, 4); ctx.fillRect(x - 30, y - 8, 4, 16); }
  else { ctx.fillStyle = "#7a4fd6"; ctx.fillRect(x + 2, y + 14, 50, 4); }
}
function drawSyringeUp(ctx, x, tipY, S, t) {
  const top = tipY - 120, bw = 34;
  // barrel
  ctx.fillStyle = "rgba(244,248,251,.92)"; ctx.strokeStyle = "#5a6b6b"; ctx.lineWidth = 1.8;
  rr(ctx, x - bw / 2, top, bw, 104, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#5a6b6b"; ctx.fillRect(x - 3, tipY - 16, 6, 16); // catheter tip
  ctx.fillRect(x - bw / 2 - 8, top - 2, bw + 16, 4); // flange
  // contents
  const pxPerMl = 100 / 60;
  if (S.plunger) {
    let ml = S.syrAsp;
    if (S.anim && S.anim.type === "asp") { const k = clamp((t - S.anim.t0) / S.anim.dur, 0, 1); ml = lerp(S.anim.from, S.anim.to, k); }
    if (S.anim && S.anim.type === "push") { const k = clamp((t - S.anim.t0) / S.anim.dur, 0, 1); ml = 40 * (1 - k); }
    const h = ml * pxPerMl;
    ctx.fillStyle = S.anim && S.anim.type === "push" ? "#c9c46a" : "#c9c46a"; ctx.fillRect(x - bw / 2 + 2, tipY - 18 - h, bw - 4, h);
    // plunger seal + rod
    const sealY = tipY - 18 - h - 6;
    ctx.fillStyle = "#3c3c46"; ctx.fillRect(x - bw / 2 + 2, sealY, bw - 4, 6);
    ctx.fillStyle = "#7a4fd6"; ctx.fillRect(x - 3, sealY - 70, 6, 70); ctx.fillRect(x - 14, sealY - 74, 28, 5);
  } else {
    let y = tipY - 18;
    for (const l of S.layers) {
      const h = l.ml * pxPerMl;
      ctx.fillStyle = l.t === "water" ? "rgba(143,208,239,.95)" : "#efe3c3";
      ctx.fillRect(x - bw / 2 + 2, y - h, bw - 4, h); y -= h;
    }
    if (S.layers.length && S.flowing) { ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(x - bw / 2 + 2, y, bw - 4, 2 + Math.sin(t * 20)); }
  }
  // graduations
  ctx.strokeStyle = "#5a6b6b"; ctx.lineWidth = 1; ctx.fillStyle = "#3a4a4a"; ctx.font = "700 7px 'JetBrains Mono', monospace"; ctx.textAlign = "left";
  for (let ml = 10; ml <= 60; ml += 10) { const yy = tipY - 18 - ml * pxPerMl; ctx.beginPath(); ctx.moveTo(x + bw / 2 - 8, yy); ctx.lineTo(x + bw / 2, yy); ctx.stroke(); ctx.fillText(ml, x + bw / 2 + 3, yy + 3); }
  // gloved hand holding barrel
  ctx.fillStyle = S.gloves ? "#8a63e0" : "#e0ae88";
  rr(ctx, x - bw / 2 - 16, tipY - 70, 18, 34, 8); ctx.fill();
  for (let i = 0; i < 3; i++) { rr(ctx, x - bw / 2 - 4, tipY - 66 + i * 9, 14, 7, 3); ctx.fill(); }
  ctx.fillStyle = S.gloves ? "#6a45c0" : "#c7916b"; rr(ctx, x - bw / 2 - 40, tipY - 64, 30, 22, 8); ctx.fill();
}
function drawProcBubble(ctx, pos, text) {
  ctx.font = "700 13px 'Atkinson Hyperlegible', sans-serif";
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { if (ctx.measureText(cur + " " + w).width > 220 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
  lines.push(cur);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20, h = lines.length * 17 + 12;
  const bx = clamp(pos[0] - 20, 8, PW - w - 8), by = clamp(pos[1] - h, 44, PH - h - 8);
  ctx.fillStyle = "#fff"; rr(ctx, bx, by, w, h, 10); ctx.fill(); ctx.strokeStyle = "#7a4fd6"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#10201f"; ctx.textAlign = "left"; lines.forEach((l, i) => ctx.fillText(l, bx + 10, by + 19 + i * 17));
}
function bez(p0, p1, p2, p3, k) {
  const u = 1 - k;
  return [u * u * u * p0[0] + 3 * u * u * k * p1[0] + 3 * u * k * k * p2[0] + k * k * k * p3[0], u * u * u * p0[1] + 3 * u * u * k * p1[1] + 3 * u * k * k * p2[1] + k * k * k * p3[1]];
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/* Snapshot of game state for the close-up renderer */
function procState() {
  const c = G.c, kind = G.formulaKey ? formulaKind(G.formulaKey) : null;
  let flow = null;
  if (G.flowing) flow = "in";
  if (P.anim && W.t - P.anim.t0 < P.anim.dur) flow = P.anim.type === "asp" ? "asp" : "in"; else P.anim = null;
  const lead = G.layers[0];
  return {
    hob: W.hobShown, sideLying: G.sideLying, sex: c.sex, skin: "#e3b08a", hair: c.sex === "F" ? "#bdbdbd" : "#8f8f8f",
    discomfort: G.discomfort, eyesClosed: c.id === "c4" && Math.sin(W.t * .3) > .7,
    stomach: G.stomachGrv + G.fedFeed + G.fedWater, stomachTint: G.fedFeed > 20 ? "#e9dcb4" : "#d9cf8a",
    ph: c.ph, phStage: G.phStage, phT: P.phT,
    cup: G.cupGastric > 0 ? G.cupGastric : G.feedCup, cupTint: G.cupGastric > 0 ? "#c9c46a" : "#efe3c3",
    formulaCol: kind ? FORMULA_COL[kind] : null, swab: G.prep.swab, water: G.tray.has("water") ? G.waterCup : 0,
    height: G.height, syrOn: G.syrOn, plug: G.plug, clampOn: G.clampOn, plunger: G.plunger, syrAsp: G.syrAsp, layers: G.layers,
    hasSyringe: G.tray.has("syringe"), flow, flowTint: lead && lead.t === "water" ? "#8fd0ef" : "#efe3c3", flowing: G.flowing,
    anim: P.anim, pour: P.pour, say: P.say && P.say.until > W.t ? P.say.text : null, secured: G.secured, gloves: G.gloves,
  };
}

/* Looping demo for the title screen */
function demoState(t) {
  const k = (t % 14) / 14;
  const layers = k < .8 ? [{ t: k > .55 ? "water" : "feed", ml: 50 - ((k * 300) % 45) }] : [];
  return {
    hob: 45, sideLying: false, sex: "M", skin: "#e3b08a", hair: "#8f8f8f", discomfort: 0, stomach: 80 + k * 200, stomachTint: "#e9dcb4",
    ph: 4, phStage: 1, phT: 1.4, cup: 240 * (1 - k), cupTint: "#efe3c3", formulaCol: FORMULA_COL.std, swab: true, water: k > .55 ? 10 : 60,
    height: .5 + Math.sin(t * .6) * .08, syrOn: true, plug: false, clampOn: k >= .8, plunger: false, syrAsp: 0, layers,
    hasSyringe: true, flow: k < .8 ? "in" : null, flowTint: k > .55 ? "#8fd0ef" : "#efe3c3", flowing: k < .8, anim: null,
    pour: (k % .2) < .03 && k < .8 ? { from: k > .55 ? "water" : "feed", t0: t - (k % .2) * 14 } : null,
    say: k > .82 ? "That was easy. Thank you, nurse." : null, secured: k > .9, gloves: true,
  };
}
