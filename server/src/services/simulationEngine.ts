import { v4 as uuidv4 } from 'uuid';
import type { Scenario, SimulationState, NursingAction, ChatMessage, ADPIEPhase, VitalSigns, VitalSignsAlert } from '../../../shared/types.js';
import { VitalSignsEngine } from './vitalSignsEngine.js';
import { getPatientResponse } from './patientAI.js';
import { getDatabase } from '../db/database.js';

interface ActiveSimulation {
  state: SimulationState;
  vitalsEngine: VitalSignsEngine;
  interval: ReturnType<typeof setInterval> | null;
  onVitalsUpdate?: (vitals: VitalSigns, elapsed: number, alerts: VitalSignsAlert[]) => void;
}

const activeSessions = new Map<string, ActiveSimulation>();

export function startSimulation(
  scenario: Scenario,
  onVitalsUpdate?: (vitals: VitalSigns, elapsed: number, alerts: VitalSignsAlert[]) => void,
): SimulationState {
  const sessionId = uuidv4();
  const vitalsEngine = new VitalSignsEngine(scenario.baselineVitals, scenario.patient.diagnosis);

  const state: SimulationState = {
    sessionId,
    scenario,
    currentVitals: { ...scenario.baselineVitals, bloodPressure: { ...scenario.baselineVitals.bloodPressure } },
    elapsedTime: 0,
    phase: 'assessment',
    actionsPerformed: [],
    conversationHistory: [{
      id: uuidv4(),
      role: 'system',
      content: `You enter the room. ${scenario.patient.name}, a ${scenario.patient.age}-year-old ${scenario.patient.gender.toLowerCase()}, is in the hospital bed. Chief complaint: ${scenario.patient.chiefComplaint}.`,
      timestamp: Date.now(),
    }],
    score: 0,
    isActive: true,
  };

  const simulation: ActiveSimulation = {
    state,
    vitalsEngine,
    interval: null,
    onVitalsUpdate,
  };

  // Start vitals tick loop (every 3 seconds)
  simulation.interval = setInterval(() => {
    if (!simulation.state.isActive) return;

    const { vitals, alerts } = vitalsEngine.tick();
    simulation.state.currentVitals = vitals;
    simulation.state.elapsedTime += 3;

    if (simulation.onVitalsUpdate) {
      simulation.onVitalsUpdate(vitals, simulation.state.elapsedTime, alerts);
    }
  }, 3000);

  activeSessions.set(sessionId, simulation);

  // Save session to database
  const db = getDatabase();
  db.prepare(`
    INSERT INTO simulation_sessions (id, scenario_id, actions_log, conversation_log)
    VALUES (?, ?, '[]', '[]')
  `).run(sessionId, scenario.id);

  return state;
}

export function performAction(sessionId: string, action: Omit<NursingAction, 'id' | 'timestamp'>): { success: boolean; message: string; actionId: string } {
  const simulation = activeSessions.get(sessionId);
  if (!simulation || !simulation.state.isActive) {
    return { success: false, message: 'No active simulation found', actionId: '' };
  }

  const fullAction: NursingAction = {
    ...action,
    id: uuidv4(),
    timestamp: Date.now(),
  };

  simulation.state.actionsPerformed.push(fullAction);
  simulation.vitalsEngine.applyAction(fullAction);

  let message = `Action performed: ${action.description}`;

  if (action.type === 'medication') {
    const allergies = simulation.state.scenario.patient.allergies.map(a => a.toLowerCase());
    const medName = (action.details?.medication || action.description).toLowerCase();
    if (allergies.some(a => medName.includes(a.toLowerCase()))) {
      message = `WARNING: Patient has a documented allergy related to this medication! Check allergies before administering.`;
    }
  }

  return { success: true, message, actionId: fullAction.id };
}

export async function handleChat(sessionId: string, studentMessage: string): Promise<ChatMessage> {
  const simulation = activeSessions.get(sessionId);
  if (!simulation || !simulation.state.isActive) {
    throw new Error('No active simulation found');
  }

  const studentMsg: ChatMessage = {
    id: uuidv4(),
    role: 'student',
    content: studentMessage,
    timestamp: Date.now(),
  };
  simulation.state.conversationHistory.push(studentMsg);

  const responseText = await getPatientResponse(
    simulation.state.scenario.patient,
    simulation.state.currentVitals,
    simulation.state.conversationHistory,
    studentMessage,
  );

  const patientMsg: ChatMessage = {
    id: uuidv4(),
    role: 'patient',
    content: responseText,
    timestamp: Date.now(),
  };
  simulation.state.conversationHistory.push(patientMsg);

  return patientMsg;
}

export function changePhase(sessionId: string, phase: ADPIEPhase): boolean {
  const simulation = activeSessions.get(sessionId);
  if (!simulation || !simulation.state.isActive) return false;
  simulation.state.phase = phase;
  return true;
}

export function endSimulation(sessionId: string): SimulationState | null {
  const simulation = activeSessions.get(sessionId);
  if (!simulation) return null;

  simulation.state.isActive = false;
  if (simulation.interval) {
    clearInterval(simulation.interval);
    simulation.interval = null;
  }

  // Update database
  const db = getDatabase();
  db.prepare(`
    UPDATE simulation_sessions
    SET end_time = datetime('now'),
        actions_log = ?,
        conversation_log = ?
    WHERE id = ?
  `).run(
    JSON.stringify(simulation.state.actionsPerformed),
    JSON.stringify(simulation.state.conversationHistory),
    sessionId,
  );

  return simulation.state;
}

export function getSimulation(sessionId: string): SimulationState | null {
  const simulation = activeSessions.get(sessionId);
  return simulation?.state || null;
}

export function setVitalsCallback(
  sessionId: string,
  callback: (vitals: VitalSigns, elapsed: number, alerts: VitalSignsAlert[]) => void,
): void {
  const simulation = activeSessions.get(sessionId);
  if (simulation) {
    simulation.onVitalsUpdate = callback;
  }
}
