import type { ActionDef, StationId } from './types';

export const STATION_NAMES: Record<StationId, string> = {
  sink: 'Hand Hygiene Station',
  patient: 'Patient',
  monitor: 'Bedside Monitor',
  bedside: 'Bedside Table (Glucometer)',
  oxygen: 'Wall Oxygen',
  iv: 'IV Pole & Pump',
  medcart: 'Medication Cart',
  computer: 'Charting Computer',
  phone: 'Unit Phone',
  door: 'Room Door',
};

const notIndicated = (why: string) => ({
  feedback: why,
  rationale: why,
});

export const ACTIONS: ActionDef[] = [
  // Sink
  {
    id: 'hand_hygiene',
    label: 'Perform hand hygiene (alcohol rub, 20 s)',
    station: 'sink',
    fallback: {
      kind: 'good',
      points: 5,
      feedback: 'Hands sanitized. Ready for patient contact.',
      rationale: 'Hand hygiene before patient contact is the single most effective way to prevent healthcare-associated infections.',
    },
  },

  // Patient
  {
    id: 'verify_id',
    label: 'Verify identity (name + DOB vs. wristband)',
    station: 'patient',
    patientContact: true,
    fallback: {
      kind: 'good',
      points: 5,
      feedback: 'Two identifiers confirmed against the wristband and chart.',
      rationale: 'Always use at least two patient identifiers (never the room number) before care or medications.',
    },
  },
  {
    id: 'talk',
    label: 'Talk to patient / assess LOC',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, feedback: '', rationale: 'Talking to the patient assesses airway, LOC and orientation at the same time.' },
  },
  {
    id: 'assess_lungs',
    label: 'Auscultate lung sounds',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'good', points: 3, feedback: '', rationale: 'A focused respiratory assessment guides your priority interventions.' },
  },
  {
    id: 'hob_high',
    label: "Raise head of bed (High Fowler's)",
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated("Head of bed raised. Not a priority intervention for this patient's problem.") },
  },
  {
    id: 'position_flat',
    label: 'Lay patient flat (supine)',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Patient is now supine. This does not address the priority problem.') },
  },
  {
    id: 'legs_up',
    label: 'Lay flat & elevate legs',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Legs elevated. Not indicated for this patient right now.') },
  },
  {
    id: 'oral_glucose',
    label: 'Give 15 g fast-acting carbs (4 oz juice)',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Juice given. There was no hypoglycemia to treat, so this was not indicated.') },
  },
  {
    id: 'give_snack',
    label: 'Give snack (crackers + peanut butter)',
    station: 'patient',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Snack given. Not a priority right now.') },
  },

  // Monitor
  {
    id: 'attach_monitor',
    label: 'Apply cardiac leads & pulse oximeter',
    station: 'monitor',
    patientContact: true,
    fallback: {
      kind: 'good',
      points: 5,
      feedback: 'Continuous monitoring is on. Vitals now display on the bedside monitor.',
      rationale: 'Continuous monitoring lets you detect deterioration and evaluate the response to interventions.',
    },
  },
  {
    id: 'read_vitals',
    label: 'Take a full set of vital signs',
    station: 'monitor',
    patientContact: true,
    fallback: { kind: 'good', points: 3, feedback: '', rationale: 'Baseline vitals are needed to judge trends and the response to treatment.' },
  },

  // Bedside table
  {
    id: 'check_glucose',
    label: 'Check capillary blood glucose',
    station: 'bedside',
    patientContact: true,
    fallback: { kind: 'good', points: 2, feedback: '', rationale: 'A fingerstick glucose rules hypoglycemia in or out in any patient with altered mental status.' },
  },
  {
    id: 'recheck_glucose',
    label: 'Wait 15 min & recheck glucose',
    station: 'bedside',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Glucose rechecked. There was no reason to repeat it right now.') },
  },

  // Oxygen
  {
    id: 'o2_nc',
    label: 'Nasal cannula 2 L/min',
    station: 'oxygen',
    patientContact: true,
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Nasal cannula applied. SpO₂ was already adequate, so oxygen was not required.') },
  },
  {
    id: 'o2_nrb',
    label: 'Non-rebreather mask 15 L/min',
    station: 'oxygen',
    patientContact: true,
    fallback: { kind: 'neutral', points: -2, ...notIndicated('High-flow oxygen applied without hypoxemia. Titrate oxygen to the SpO₂ target.') },
  },

  // IV
  {
    id: 'stop_infusion',
    label: 'Stop the running IV infusion',
    station: 'iv',
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Infusion paused. There was no indication to stop it.') },
  },
  {
    id: 'resume_infusion',
    label: 'Resume / increase the infusion',
    station: 'iv',
    fallback: { kind: 'neutral', points: 0, ...notIndicated('Infusion running as ordered.') },
  },
  {
    id: 'ns_bolus',
    label: 'Give 0.9% NaCl 1 L bolus',
    station: 'iv',
    fallback: { kind: 'neutral', points: -3, ...notIndicated('A fluid bolus was given without hemodynamic indication.') },
  },

  // Med cart
  {
    id: 'med_epi_im',
    label: 'Epinephrine 0.5 mg IM (1 mg/mL), lateral thigh',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -15, ...notIndicated('Epinephrine given without anaphylaxis: tachycardia and hypertension follow. Not indicated.') },
  },
  {
    id: 'med_epi_iv',
    label: 'Epinephrine 1 mg IV push (0.1 mg/mL)',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -20, ...notIndicated('1 mg IV epinephrine is a cardiac-arrest dose. Dangerous in a patient with a pulse.') },
  },
  {
    id: 'med_diphen',
    label: 'Diphenhydramine 50 mg IV',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'neutral', points: -3, ...notIndicated('Diphenhydramine given. No allergic reaction was present, and it causes sedation.') },
  },
  {
    id: 'med_furosemide',
    label: 'Furosemide 40 mg IV push',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -10, ...notIndicated('Furosemide given without fluid overload risks hypovolemia and hypokalemia.') },
  },
  {
    id: 'med_insulin',
    label: 'Insulin lispro per sliding scale (SubQ)',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -10, ...notIndicated('Insulin given without checking glucose is unsafe.') },
  },
  {
    id: 'med_dextrose',
    label: 'Dextrose 50% 25 mL IV push',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -10, ...notIndicated('Dextrose 50% given without hypoglycemia causes hyperglycemia and vein irritation.') },
  },
  {
    id: 'med_glucagon',
    label: 'Glucagon 1 mg IM',
    station: 'medcart',
    medication: true,
    fallback: { kind: 'harmful', points: -8, ...notIndicated('Glucagon given without hypoglycemia. Not indicated.') },
  },

  // Computer
  {
    id: 'review_chart',
    label: 'Review chart, orders & allergies',
    station: 'computer',
    fallback: { kind: 'good', points: 3, feedback: 'Chart opened.', rationale: 'Reviewing orders, allergies and history keeps your care safe and within scope.' },
  },
  {
    id: 'document',
    label: 'Document assessment & interventions',
    station: 'computer',
    fallback: {
      kind: 'good',
      points: 5,
      feedback: 'Assessment, interventions and patient response documented.',
      rationale: "If it wasn't documented, it wasn't done. Document the patient's response, not just the interventions.",
    },
  },

  // Phone
  {
    id: 'call_provider',
    label: 'Notify provider (SBAR)',
    station: 'phone',
    fallback: { kind: 'good', points: 3, feedback: 'Provider updated via SBAR.', rationale: 'Use SBAR to communicate changes in condition clearly and concisely.' },
  },
  {
    id: 'call_rrt',
    label: 'Call Rapid Response Team',
    station: 'phone',
    fallback: { kind: 'neutral', points: 0, ...notIndicated('The rapid response team arrives but finds the patient does not meet activation criteria.') },
  },

  // Door
  {
    id: 'leave_room',
    label: 'Step out to get supplies',
    station: 'door',
    fallback: { kind: 'harmful', points: -10, ...notIndicated('You left an unstable patient alone. Call for help and have supplies brought to you.') },
  },
  {
    id: 'finish',
    label: 'End scenario & give handoff report',
    station: 'door',
    fallback: { kind: 'neutral', points: 0, feedback: '', rationale: '' },
  },
];

export const ACTIONS_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

/** Actions that can be repeated for fresh information. */
export const REPEATABLE = new Set(['talk', 'read_vitals', 'check_glucose', 'assess_lungs', 'review_chart', 'finish']);

export function actionsForStation(station: StationId): ActionDef[] {
  return ACTIONS.filter((a) => a.station === station);
}
