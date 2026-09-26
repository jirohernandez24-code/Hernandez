export interface Vitals {
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  spo2: number;
  temp: number;
}

export type StationId =
  | 'sink'
  | 'patient'
  | 'monitor'
  | 'bedside'
  | 'oxygen'
  | 'iv'
  | 'medcart'
  | 'computer'
  | 'phone'
  | 'door';

/** An action id, or a list of alternative action ids where any one satisfies it. */
export type Requirement = string | string[];

export type ActionKind = 'critical' | 'good' | 'neutral' | 'harmful';

/** What happens when an action is performed in a given scenario. */
export interface ActionOutcome {
  kind: ActionKind;
  points: number;
  /** Feedback shown immediately (what the nurse observes / what happens). */
  feedback: string;
  /** Teaching point shown in the debrief. */
  rationale: string;
  /** Change in severity (negative = patient improves). */
  severityDelta?: number;
  /** Multiplies the deterioration rate (e.g. 0.5 halves how fast the patient worsens). */
  driftMultiplier?: number;
  /** Actions that must be done first (an inner array means "any of"); if missing, `blockedFeedback` is shown instead. */
  requires?: Requirement[];
  blockedFeedback?: string;
}

export interface ActionDef {
  id: string;
  label: string;
  station: StationId;
  /** Whether this action counts as touching the patient (hand hygiene + ID check expected first). */
  patientContact?: boolean;
  /** Medication administration: ID verification and allergy check matter. */
  medication?: boolean;
  /** Default outcome used when a scenario does not override it. */
  fallback: Omit<ActionOutcome, 'kind' | 'points'> & { kind?: ActionKind; points?: number };
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  patient: {
    name: string;
    age: number;
    sex: 'F' | 'M';
    dob: string;
    mrn: string;
    room: string;
    diagnosis: string;
    allergies: string;
    history: string[];
    orders: string[];
    handoff: string;
  };
  /** Vitals at severity 0 (stable) and severity 1 (arrest). */
  stableVitals: Vitals;
  crashVitals: Vitals;
  startSeverity: number;
  /** Severity increase per second while untreated. */
  drift: number;
  skinTone: 'pale' | 'flushed' | 'cyanotic';
  /** What the patient says when you talk to them, keyed by severity band. */
  patientLines: { mild: string; severe: string; recovered: string };
  bloodGlucose?: { start: number; afterTreatment: number };
  lungSounds: string;
  outcomes: Record<string, ActionOutcome>;
  /** Critical actions that must all be completed to stabilize the patient (an inner array means "any of"). */
  criticalPath: Requirement[];
  debriefPearls: string[];
}

export interface LogEntry {
  time: number;
  actionId: string;
  label: string;
  kind: ActionKind | 'info';
  points: number;
  feedback: string;
  rationale: string;
}
