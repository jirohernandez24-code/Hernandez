/* ================= DATA: cases, supplies, checklist ================= */
const GAME_DATE = "02 Oct 2026";
const START_MIN = 13 * 60 + 45;

const CASES = [
  {
    id: "c1", tag: "Standard", tier: 1, sex: "M",
    name: "Ramon Dela Cruz", short: "Mr. Dela Cruz", age: 68, dob: "14 Mar 1958", hosp: "24-0193",
    dx: "Dysphagia secondary to left MCA infarct (hospital day 6)",
    blurb: "Routine q4h syringe feeding. Do every step right, in order, on time.",
    formula: "std", amount: 240, freq: "q4h", water: 60,
    allergies: "No known food or drug allergies", lactose: false,
    prev: { time: "10:00", amount: 240, grv: 30, note: "Tolerated well. No nausea, no vomiting. Bowel sounds present." },
    mar: [["08:00", "Citicoline 1 g IV", "Given"], ["08:00", "Atorvastatin 40 mg via NGT", "Given"], ["20:00", "Atorvastatin 40 mg via NGT", "Due"]],
    medAt: null, grv: 40, ph: 4, outcome: "feed",
    vitals: { hr: 78, bp: "132/84", rr: 18, t: "36.8", spo2: 97 },
    find: {
      weight: "58.2 kg (61.0 kg two weeks ago: down 2.8 kg)",
      mucosa: "Lips and oral mucosa slightly dry",
      turgor: "Skin recoils in 2 seconds",
      albumin: "Serum albumin 3.2 g/dL (low)",
      io: "Last 24 h: intake 1,650 mL, output 1,400 mL",
      allergyAnswer: "\"No allergies, nurse. Milk never bothered me.\"",
      bowel: "Normoactive, 12 per minute in all quadrants",
      tolerance: "\"I feel a little full, but no nausea.\"",
      regurg: "No regurgitation or belching. Abdomen soft.",
      urine: "Urine output 50 mL/h, specific gravity 1.018",
      glucose: "Urine glucose and acetone negative",
      stool: "Soft formed stool this morning",
    },
    cart: [
      { key: "f_std", label: "Standard Polymeric Formula", sub: "1 kcal/mL · 250 mL · EXP 01/2027", ok: true },
      { key: "f_dm", label: "Diabetes-Specific Formula", sub: "1 kcal/mL · 250 mL · EXP 11/2026", wrong: "Not the ordered formula." },
    ],
  },
  {
    id: "c2", tag: "Med timing · Lactose", tier: 2, sex: "F",
    name: "Lourdes Santos", short: "Mrs. Santos", age: 74, dob: "02 Jul 1952", hosp: "24-0217",
    dx: "Parkinson's disease with severe dysphagia; resolving aspiration pneumonia",
    blurb: "A medication went down the tube recently, she is lactose intolerant, and one can on the cart is past its date.",
    formula: "lf", amount: 200, freq: "q4h", water: 60,
    allergies: "Penicillin (rash). LACTOSE INTOLERANCE: lactose-free feeds only", lactose: true,
    prev: { time: "10:00", amount: 200, grv: 20, note: "Tolerated. Mild bloating after the 06:00 feed when milk-based formula was used." },
    mar: [["08:00", "Levodopa/Carbidopa 250/25 mg via NGT", "Given"], ["13:15", "Paracetamol 500 mg via NGT (T 38.0 °C)", "Given"], ["14:00", "Levodopa/Carbidopa 250/25 mg via NGT", "Due"]],
    medAt: 13 * 60 + 15, grv: 60, ph: 3, outcome: "feed",
    vitals: { hr: 84, bp: "118/72", rr: 20, t: "37.6", spo2: 95 },
    find: {
      weight: "44.0 kg (45.5 kg on admission)",
      mucosa: "Oral mucosa dry, tongue furrowed",
      turgor: "Skin tenting, recoils in 3 seconds",
      albumin: "Serum albumin 2.9 g/dL (low)",
      io: "Last 24 h: intake 1,300 mL, output 1,250 mL",
      allergyAnswer: "\"Milk makes my stomach swell and cramp. And penicillin gives me a rash.\"",
      bowel: "Hypoactive, 6 per minute",
      tolerance: "\"No cramps this time. Just a little full.\"",
      regurg: "No regurgitation. Abdomen soft, not distended.",
      urine: "Urine output 40 mL/h, specific gravity 1.024",
      glucose: "Urine glucose and acetone negative",
      stool: "No bowel movement for 2 days",
    },
    cart: [
      { key: "f_lf_exp", label: "Lactose-Free Formula", sub: "1 kcal/mL · 250 mL · EXP 08/2026", ok: true, expired: true },
      { key: "f_lf", label: "Lactose-Free Formula", sub: "1 kcal/mL · 250 mL · EXP 04/2027", ok: true },
      { key: "f_milk", label: "Milk-Based Formula", sub: "Contains milk (lactose) · EXP 05/2027", wrong: "Contains lactose. The client is lactose intolerant." },
    ],
  },
  {
    id: "c3", tag: "Residual volume", tier: 3, sex: "M",
    name: "Jun Reyes", short: "Mr. Reyes", age: 45, dob: "19 Nov 1980", hosp: "24-0231",
    dx: "Traumatic brain injury, post-op day 3 craniotomy (GCS 13)",
    blurb: "Previous feed did not sit well. Check what is still in the stomach before you give anything.",
    formula: "std", amount: 250, freq: "q4h", water: 60,
    allergies: "No known food or drug allergies", lactose: false,
    prev: { time: "10:00", amount: 250, grv: 70, note: "Belching, abdomen slightly distended 1 h after feed. No vomiting." },
    mar: [["08:00", "Levetiracetam 500 mg IV", "Given"], ["08:00", "Omeprazole 40 mg IV", "Given"], ["20:00", "Levetiracetam 500 mg IV", "Due"]],
    medAt: null, grv: 150, ph: 4, outcome: "hold_grv",
    vitals: { hr: 88, bp: "128/80", rr: 18, t: "37.2", spo2: 98 },
    find: {
      weight: "70.5 kg (72.0 kg on admission)",
      mucosa: "Oral mucosa moist",
      turgor: "Skin recoils in under 2 seconds",
      albumin: "Serum albumin 3.4 g/dL",
      io: "Last 24 h: intake 2,000 mL, output 1,700 mL",
      allergyAnswer: "\"None that I know of.\"",
      bowel: "Hypoactive, 4 per minute",
      tolerance: "\"My stomach feels heavy and bloated.\"",
      regurg: "Belching; abdomen slightly distended, soft",
      urine: "Urine output 70 mL/h, specific gravity 1.015",
      glucose: "Urine glucose and acetone negative",
      stool: "No bowel movement since admission (3 days)",
    },
    cart: [
      { key: "f_std", label: "Standard Polymeric Formula", sub: "1 kcal/mL · 250 mL · EXP 02/2027", ok: true },
      { key: "f_pep", label: "Peptide-Based Formula", sub: "1 kcal/mL · 250 mL · EXP 12/2026", wrong: "Not the ordered formula." },
    ],
  },
  {
    id: "c4", tag: "Tube placement", tier: 4, sex: "F",
    name: "Elena Bautista", short: "Mrs. Bautista", age: 81, dob: "08 May 1945", hosp: "24-0244",
    dx: "Advanced dementia with poor oral intake. NGT re-inserted 11:30 today after she pulled it out",
    blurb: "The tube went back in this morning and she coughed during insertion. Trust the test, not the habit.",
    formula: "pep", amount: 200, freq: "q4h", water: 60,
    allergies: "No known food allergies. Sulfa drugs (hives)", lactose: false,
    prev: { time: "06:00", amount: 200, grv: 10, note: "10:00 feed not given: tube found pulled out. Re-inserted 11:30 (coughed during insertion)." },
    mar: [["08:00", "Donepezil 10 mg", "Held: no access"], ["20:00", "Donepezil 10 mg via NGT", "Due"]],
    medAt: null, grv: 15, ph: 7, outcome: "hold_ph",
    vitals: { hr: 92, bp: "110/68", rr: 22, t: "37.0", spo2: 94 },
    find: {
      weight: "39.8 kg (41.0 kg one month ago)",
      mucosa: "Lips cracked, oral mucosa dry",
      turgor: "Skin tenting, recoils in 3 seconds",
      albumin: "Serum albumin 2.7 g/dL (low)",
      io: "Last 24 h: intake 900 mL, output 850 mL",
      allergyAnswer: "She smiles and does not answer. Her daughter's note: \"No food allergies.\"",
      bowel: "Normoactive, 8 per minute",
      tolerance: "She is calm, no coughing now, no signs of distress.",
      regurg: "No regurgitation. Abdomen soft.",
      urine: "Urine output 35 mL/h, specific gravity 1.026",
      glucose: "Urine glucose and acetone negative",
      stool: "Small soft stool yesterday",
    },
    cart: [
      { key: "f_pep", label: "Peptide-Based Formula", sub: "1 kcal/mL · 250 mL · EXP 03/2027", ok: true },
      { key: "f_std", label: "Standard Polymeric Formula", sub: "1 kcal/mL · 250 mL · EXP 01/2027", wrong: "Not the ordered formula." },
    ],
  },
];
const FORMULA_NAMES = { std: "Standard Polymeric Formula", lf: "Lactose-Free Formula", pep: "Peptide-Based Formula", dm: "Diabetes-Specific Formula", milk: "Milk-Based Formula" };
const formulaKind = (key) => key.startsWith("f_lf") ? "lf" : key === "f_milk" ? "milk" : key === "f_dm" ? "dm" : key === "f_pep" ? "pep" : "std";

/* Supplies on the cart. req: needed for every NGT feeding. */
const SUPPLIES = [
  { key: "gloves", label: "Clean gloves", sub: "Non-sterile, nitrile", req: true, icon: "gloves" },
  { key: "syringe", label: "60 mL catheter-tip syringe", sub: "Enteral, purple plunger", req: true, icon: "syringe" },
  { key: "ph", label: "pH test strips", sub: "Range 1 to 11", req: true, icon: "ph" },
  { key: "emesis", label: "Emesis basin", sub: "Kidney basin", req: true, icon: "emesis" },
  { key: "measure", label: "Measuring container", sub: "Graduated, 500 mL", req: true, icon: "measure" },
  { key: "water", label: "Water, 60 mL", sub: "Room temperature", req: true, icon: "water" },
  { key: "steth", label: "Stethoscope", sub: "For bowel sounds", req: true, icon: "steth" },
  { key: "alcohol", label: "Alcohol swabs", sub: "70% isopropyl", req: true, icon: "alcohol" },
  { key: "bag", label: "Calibrated feeding bag", sub: "With label, tubing and clamp (closed system)", optional: true, icon: "bag" },
  { key: "pump", label: "Enteral feeding pump", sub: "As required (continuous feeds)", optional: true, icon: "pump" },
];

/* Checklist, worded from Skills Enhancement #7. cat: A=Patient Assessment, N=Nursing Care Performance, R=Records Management */
const CHECK = [
  { id: "a_order", phase: "Assessment", cat: "A", w: 2, label: "Review the order: type, amount and frequency of feeding" },
  { id: "a_tol", phase: "Assessment", cat: "A", w: 1, label: "Review tolerance of the previous feeding" },
  { id: "a_nutri", phase: "Assessment", cat: "A", w: 2, label: "Assess for signs of malnutrition or dehydration" },
  { id: "a_allergy", phase: "Assessment", cat: "A", w: 2, label: "Check food allergies and lactose intolerance against the formula" },

  { id: "p_equip", phase: "Planning", cat: "N", w: 1, label: "Prepare the necessary equipment" },
  { id: "p_position", phase: "Planning", cat: "N", w: 2, label: "Fowler's position, at least 30° (or slightly elevated right side-lying)" },
  { id: "p_identify", phase: "Planning", cat: "N", w: 1, label: "Introduce self and verify identity with two identifiers" },
  { id: "p_explain", phase: "Planning", cat: "N", w: 1, label: "Explain what, why, and how the client can participate" },
  { id: "p_hh", phase: "Planning", cat: "N", w: 1, label: "Perform hand hygiene before the procedure" },
  { id: "p_gloves", phase: "Planning", cat: "N", w: 1, label: "Apply clean gloves" },
  { id: "p_privacy", phase: "Planning", cat: "N", w: 1, label: "Provide privacy" },

  { id: "i_placement", phase: "Implementation", cat: "N", w: 3, label: "Assess tube placement: aspirate and check the pH" },
  { id: "i_medwait", phase: "Implementation", cat: "N", w: 1, label: "Allow 1 hour after a medication before testing pH", when: (c) => c.medAt != null },
  { id: "i_residual", phase: "Implementation", cat: "N", w: 2, label: "Aspirate and measure residual; act on the amount", when: (c) => c.outcome !== "hold_ph" },
  { id: "i_hold", phase: "Implementation", cat: "N", w: 3, label: "Hold the feeding and notify the nurse in charge per agency policy", when: (c) => c.outcome !== "feed" },
  { id: "i_expiry", phase: "Implementation", cat: "N", w: 1, label: "Check the expiration date of the feeding", when: (c) => c.outcome === "feed" },
  { id: "i_temp", phase: "Implementation", cat: "N", w: 1, label: "Warm the feeding to room temperature", when: (c) => c.outcome === "feed" },
  { id: "i_swab", phase: "Implementation", cat: "N", w: 1, label: "Clean the top of the container with alcohol", when: (c) => c.outcome === "feed" },
  { id: "i_connect", phase: "Implementation", cat: "N", w: 1, label: "Remove plunger; connect syringe to a clamped tube", when: (c) => c.outcome === "feed" },
  { id: "i_flow", phase: "Implementation", cat: "N", w: 2, label: "Let feeding flow slowly; adjust height; pause for discomfort", when: (c) => c.outcome === "feed" },
  { id: "i_flush", phase: "Implementation", cat: "N", w: 2, label: "Instill 50 to 100 mL water before the feeding drains from the neck", when: (c) => c.outcome === "feed" },
  { id: "i_clamp", phase: "Implementation", cat: "N", w: 1, label: "Clamp before all the water is instilled; plug the tube" },
  { id: "i_secure", phase: "Implementation", cat: "N", w: 1, label: "Secure the tubing to the client's gown" },
  { id: "i_upright", phase: "Implementation", cat: "N", w: 1, label: "Ask client to stay upright for at least 30 minutes" },
  { id: "i_dispose", phase: "Implementation", cat: "N", w: 1, label: "Dispose of equipment appropriately" },
  { id: "i_glovesoff", phase: "Implementation", cat: "N", w: 1, label: "Remove and discard gloves" },
  { id: "i_hh2", phase: "Implementation", cat: "N", w: 1, label: "Perform hand hygiene" },

  { id: "e_eval", phase: "Evaluation", cat: "N", w: 2, label: "Follow-up: tolerance, bowel sounds, fullness, and more" },

  { id: "d_feed", phase: "Documentation", cat: "R", w: 2, label: "Document the kind and amount of feeding" },
  { id: "d_water", phase: "Documentation", cat: "R", w: 1, label: "Document the water used to flush" },
  { id: "d_dur", phase: "Documentation", cat: "R", w: 1, label: "Document the duration of the feeding" },
  { id: "d_assess", phase: "Documentation", cat: "R", w: 2, label: "Document assessments of the client" },
  { id: "d_io", phase: "Documentation", cat: "R", w: 2, label: "Record volumes on the intake and output record" },
  { id: "d_report", phase: "Documentation", cat: "R", w: 2, label: "Report significant deviations to the primary care provider" },
];
const PHASES = ["Assessment", "Planning", "Implementation", "Evaluation", "Documentation"];
const CATS = {
  A: { name: "Patient Assessment", weight: 20 },
  N: { name: "Nursing Care Performance", weight: 30 },
  R: { name: "Records Management", weight: 30 },
  T: { name: "Timeliness of Performance", weight: 20 },
};
const SCALE = [
  { v: 5, label: "Exemplary" }, { v: 4.5, label: "Proficient" }, { v: 4, label: "Good" }, { v: 3.5, label: "Poor" }, { v: 3, label: "Very Poor" },
];
const toScale = (pct) => pct >= 0.95 ? 5 : pct >= 0.85 ? 4.5 : pct >= 0.72 ? 4 : pct >= 0.55 ? 3.5 : 3;
const scaleLabel = (v) => (SCALE.find((s) => s.v === v) || SCALE[4]).label;

/* Evaluation options; rel: belongs to NGT follow-up per the checklist. */
const EVAL_OPTS = [
  { key: "tolerance", label: "Ask about tolerance (nausea, cramping)", rel: true },
  { key: "bowel", label: "Auscultate bowel sounds", rel: true, needs: "steth" },
  { key: "regurg", label: "Check regurgitation and fullness", rel: true },
  { key: "weight", label: "Review weight gain or loss", rel: true },
  { key: "stool", label: "Ask about fecal elimination pattern", rel: true },
  { key: "turgor", label: "Check skin turgor", rel: true },
  { key: "urine", label: "Review urine output and specific gravity", rel: true },
  { key: "glucose", label: "Check urine glucose and acetone", rel: true },
];

const POLICY = [
  ["Placement", "Confirm placement before every feeding: aspirate and test pH. pH 1 to 5.5 suggests gastric placement. pH 6 or higher: do not use the tube; hold, notify the nurse in charge, and request X-ray confirmation."],
  ["Medication", "Allow 1 hour to elapse after a medication through the tube before testing pH."],
  ["Residual", "Re-instill aspirated gastric contents. Hold the feeding and notify the nurse in charge if the residual is 100 mL or more, or more than half of the last feeding."],
  ["Flush", "Flush with 60 mL water (50 to 100 mL) unless otherwise ordered."],
  ["Position", "Keep the head of bed at 30° or higher during the feeding and for at least 30 minutes after."],
];
