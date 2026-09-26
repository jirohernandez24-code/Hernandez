import { ACTIONS_BY_ID, REPEATABLE } from './actions';
import type { ActionOutcome, LogEntry, Requirement, Scenario, Vitals } from './types';

export type SimStatus = 'running' | 'stabilized' | 'coded' | 'finished';

export interface ActionResult {
  label: string;
  kind: LogEntry['kind'];
  points: number;
  feedback: string;
  /** True if the action was blocked (prerequisite missing) or already done. */
  noop?: boolean;
}

const RECOVERY_RATE = -1 / 60;

export class SimulationEngine {
  readonly scenario: Scenario;
  severity: number;
  drift: number;
  elapsed = 0;
  score = 0;
  status: SimStatus = 'running';
  done = new Set<string>();
  log: LogEntry[] = [];
  monitorAttached = false;
  hygieneDone = false;
  idVerified = false;
  private contactPenaltyGiven = false;
  private idPenaltyGiven = false;
  stabilizedAt: number | null = null;
  private noise = { hr: 0, sbp: 0, rr: 0, spo2: 0 };
  private noiseTimer = 0;

  constructor(scenario: Scenario) {
    this.scenario = scenario;
    this.severity = scenario.startSeverity;
    this.drift = scenario.drift;
  }

  get criticalRemaining(): Requirement[] {
    return this.scenario.criticalPath.filter((r) => !this.satisfied(r));
  }

  get criticalTotal(): number {
    return this.scenario.criticalPath.length;
  }

  satisfied(r: Requirement): boolean {
    return Array.isArray(r) ? r.some((id) => this.done.has(id)) : this.done.has(r);
  }

  /** Human-friendly band used for patient dialogue and visuals. */
  get band(): 'mild' | 'severe' | 'recovered' {
    if (this.status === 'stabilized' || (this.criticalRemaining.length === 0 && this.severity < 0.2)) return 'recovered';
    return this.severity > 0.7 ? 'severe' : 'mild';
  }

  get vitals(): Vitals {
    const { stableVitals: a, crashVitals: b } = this.scenario;
    const s = Math.max(0, Math.min(1, this.severity));
    const lerp = (x: number, y: number) => x + (y - x) * s;
    return {
      hr: Math.round(lerp(a.hr, b.hr) + this.noise.hr),
      sbp: Math.round(lerp(a.sbp, b.sbp) + this.noise.sbp),
      dbp: Math.round(lerp(a.dbp, b.dbp) + this.noise.sbp * 0.6),
      rr: Math.max(4, Math.round(lerp(a.rr, b.rr) + this.noise.rr)),
      spo2: Math.min(100, Math.round(lerp(a.spo2, b.spo2) + this.noise.spo2)),
      temp: Math.round(lerp(a.temp, b.temp) * 10) / 10,
    };
  }

  get glucose(): number {
    const bg = this.scenario.bloodGlucose;
    if (!bg) return 118;
    if (this.done.has('recheck_glucose') || this.done.has('give_snack')) return bg.afterTreatment;
    if (this.done.has('med_insulin')) return Math.max(22, bg.start - 20);
    if (['oral_glucose', 'med_dextrose', 'med_glucagon'].some((id) => this.done.has(id))) return Math.round((bg.start + bg.afterTreatment) / 2);
    return Math.round(bg.start - this.severity * 10);
  }

  tick(dt: number) {
    if (this.status === 'coded' || this.status === 'finished') return;
    this.elapsed += dt;

    this.noiseTimer -= dt;
    if (this.noiseTimer <= 0) {
      this.noiseTimer = 1.5;
      const r = () => Math.random() * 2 - 1;
      this.noise = { hr: r() * 2, sbp: r() * 2, rr: r(), spo2: r() * 0.6 };
    }

    const allCritical = this.criticalRemaining.length === 0;
    const rate = allCritical ? RECOVERY_RATE : this.drift;
    this.severity = Math.max(0, Math.min(1, this.severity + rate * dt));

    if (allCritical && this.severity <= 0.08 && this.status === 'running') {
      this.status = 'stabilized';
      this.stabilizedAt = this.elapsed;
      this.push('info', 'Patient stabilized', 0, 'All priority interventions are complete and the patient is stable. Finish documentation, then end the scenario at the door.', '');
    }
    if (this.severity >= 1 && this.status === 'running') {
      this.status = 'coded';
      this.push('info', 'CODE BLUE', 0, 'The patient deteriorated into cardiopulmonary arrest. A code blue was called.', '');
    }
  }

  outcomeFor(actionId: string): ActionOutcome {
    const def = ACTIONS_BY_ID[actionId];
    const o = this.scenario.outcomes[actionId];
    if (o) return o;
    return { kind: def.fallback.kind ?? 'neutral', points: def.fallback.points ?? 0, ...def.fallback };
  }

  perform(actionId: string): ActionResult {
    const def = ACTIONS_BY_ID[actionId];
    if (this.status === 'coded' || this.status === 'finished') {
      return { label: def.label, kind: 'info', points: 0, feedback: 'The scenario has ended.', noop: true };
    }
    if (actionId === 'finish') {
      this.status = 'finished';
      return { label: def.label, kind: 'info', points: 0, feedback: 'Handoff given. Scenario complete.' };
    }

    if (this.done.has(actionId) && !REPEATABLE.has(actionId)) {
      return { label: def.label, kind: 'info', points: 0, feedback: 'Already done.', noop: true };
    }

    const outcome = this.outcomeFor(actionId);

    if (outcome.requires && !outcome.requires.every((r) => this.satisfied(r))) {
      const fb = outcome.blockedFeedback ?? 'Something needs to happen first.';
      this.push('info', def.label, 0, fb, outcome.rationale, actionId);
      return { label: def.label, kind: 'info', points: 0, feedback: fb, noop: true };
    }

    const firstTime = !this.done.has(actionId);
    this.done.add(actionId);

    // Universal safety rules
    if (def.patientContact && !this.hygieneDone && !this.contactPenaltyGiven && actionId !== 'hand_hygiene') {
      this.contactPenaltyGiven = true;
      this.push('harmful', 'Missed hand hygiene', -5, 'You touched the patient without performing hand hygiene first.', 'Perform hand hygiene before every patient contact (WHO "5 Moments").');
    }
    if (def.medication && !this.idVerified && !this.idPenaltyGiven) {
      this.idPenaltyGiven = true;
      this.push('harmful', 'Medication given without ID check', -10, 'You gave a medication without verifying two patient identifiers.', 'Rights of medication administration: right patient comes first. Check two identifiers and the allergy band.');
    }

    if (actionId === 'hand_hygiene') this.hygieneDone = true;
    if (actionId === 'verify_id') this.idVerified = true;
    if (actionId === 'attach_monitor') this.monitorAttached = true;

    const points = firstTime ? outcome.points : 0;
    const feedback = this.describe(actionId, outcome);
    if (outcome.severityDelta) this.severity = Math.max(0, Math.min(1, this.severity + outcome.severityDelta));
    if (outcome.driftMultiplier !== undefined && firstTime) this.drift *= outcome.driftMultiplier;

    this.push(outcome.kind, def.label, points, feedback, outcome.rationale, actionId);
    return { label: def.label, kind: outcome.kind, points, feedback };
  }

  /** Dynamic feedback for assessment actions. */
  private describe(actionId: string, o: ActionOutcome): string {
    const v = this.vitals;
    switch (actionId) {
      case 'talk':
        return this.scenario.patientLines[this.band];
      case 'read_vitals':
        return `HR ${v.hr} · BP ${v.sbp}/${v.dbp} · RR ${v.rr} · SpO₂ ${v.spo2}% · T ${v.temp.toFixed(1)}°C`;
      case 'assess_lungs':
        return this.band === 'recovered' ? 'Lung sounds improving. Air movement is better bilaterally.' : this.scenario.lungSounds;
      case 'check_glucose': {
        const bg = this.glucose;
        return `Fingerstick glucose: ${bg} mg/dL${bg < 70 ? ' (critical LOW)' : bg > 180 ? ' (HIGH)' : ''}.`;
      }
      default:
        return o.feedback || 'Done.';
    }
  }

  penalize(label: string, points: number, feedback: string) {
    this.push('info', label, points, feedback, '');
  }

  private push(kind: LogEntry['kind'], label: string, points: number, feedback: string, rationale: string, actionId = '') {
    this.score += points;
    this.log.push({ time: this.elapsed, actionId, label, kind, points, feedback, rationale });
  }

  /** Final result for the debrief screen. */
  summary() {
    const missed = this.criticalRemaining.map((r) =>
      (Array.isArray(r) ? r : [r]).map((id) => ACTIONS_BY_ID[id].label).join(' OR '),
    );
    const maxCritical = this.scenario.criticalPath.reduce((sum, r) => {
      const ids = Array.isArray(r) ? r : [r];
      return sum + Math.max(...ids.map((id) => this.outcomeFor(id).points));
    }, 0);
    const good = Object.entries(this.scenario.outcomes)
      .filter(([, o]) => o.kind === 'good' && o.points > 0)
      .reduce((s, [, o]) => s + o.points, 0);
    let bonus = 0;
    if (this.status !== 'coded' && missed.length === 0) {
      bonus = Math.max(0, Math.round(30 - this.elapsed / 10));
    }
    const total = Math.max(0, this.score + bonus);
    const possible = maxCritical + Math.round(good * 0.6) + 30;
    const pct = Math.min(100, Math.round((total / possible) * 100));
    const coded = this.status === 'coded';
    const grade = coded ? 'F' : missed.length ? (pct >= 60 ? 'C' : 'D') : pct >= 90 ? 'A' : pct >= 78 ? 'B' : 'C';
    return { total, bonus, pct, grade, missed, coded, time: this.elapsed, log: this.log };
  }
}
