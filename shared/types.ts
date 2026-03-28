export interface Medication {
  name: string;
  dosage: string;
  route: 'oral' | 'IV' | 'IM' | 'subcutaneous' | 'topical' | 'inhalation' | 'sublingual' | 'rectal';
  frequency: string;
  purpose: string;
}

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
}

export interface Patient {
  name: string;
  age: number;
  gender: string;
  weight: number;
  height: number;
  chiefComplaint: string;
  medicalHistory: string[];
  allergies: string[];
  currentMedications: Medication[];
  diagnosis: string;
  backgroundStory: string;
}

export interface VitalSigns {
  heartRate: number;
  bloodPressure: { systolic: number; diastolic: number };
  respiratoryRate: number;
  temperature: number;
  oxygenSaturation: number;
  painLevel: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  patient: Patient;
  baselineVitals: VitalSigns;
  labResults: LabResult[];
  nursingGoals: string[];
  difficulty: 'easy' | 'moderate' | 'hard' | 'critical';
  expectedActions: string[];
  sourcePdf?: string;
  createdAt?: string;
}

export type ADPIEPhase = 'assessment' | 'diagnosis' | 'planning' | 'implementation' | 'evaluation';

export interface NursingAction {
  id: string;
  type: 'assessment' | 'intervention' | 'medication' | 'communication' | 'documentation';
  description: string;
  phase: ADPIEPhase;
  timestamp: number;
  details?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'student' | 'patient' | 'system';
  content: string;
  timestamp: number;
}

export interface SimulationState {
  sessionId: string;
  scenario: Scenario;
  currentVitals: VitalSigns;
  elapsedTime: number;
  phase: ADPIEPhase;
  actionsPerformed: NursingAction[];
  conversationHistory: ChatMessage[];
  score: number;
  isActive: boolean;
}

export interface ScoreBreakdown {
  assessment: number;
  diagnosis: number;
  planning: number;
  implementation: number;
  evaluation: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  criticalMisses: string[];
}

export interface VitalSignsAlert {
  vital: keyof VitalSigns;
  value: number;
  severity: 'warning' | 'critical';
  message: string;
}

// WebSocket message types
export type WSClientMessage =
  | { type: 'chat:message'; sessionId: string; content: string }
  | { type: 'action:perform'; sessionId: string; action: Omit<NursingAction, 'id' | 'timestamp'> }
  | { type: 'phase:change'; sessionId: string; phase: ADPIEPhase };

export type WSServerMessage =
  | { type: 'chat:response'; message: ChatMessage }
  | { type: 'vitals:update'; vitals: VitalSigns; elapsed: number }
  | { type: 'vitals:alert'; alert: VitalSignsAlert }
  | { type: 'action:result'; actionId: string; success: boolean; message: string }
  | { type: 'phase:changed'; phase: ADPIEPhase }
  | { type: 'simulation:ended'; score: ScoreBreakdown };
