import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { Scenario, VitalSigns, NursingAction, ChatMessage, ADPIEPhase, ScoreBreakdown, VitalSignsAlert } from '../types';

export interface SimState {
  sessionId: string | null;
  scenario: Scenario | null;
  currentVitals: VitalSigns | null;
  elapsedTime: number;
  phase: ADPIEPhase;
  actions: NursingAction[];
  messages: ChatMessage[];
  alerts: VitalSignsAlert[];
  score: ScoreBreakdown | null;
  isActive: boolean;
  isLoading: boolean;
}

type SimAction =
  | { type: 'START_SIMULATION'; sessionId: string; scenario: Scenario; vitals: VitalSigns; messages: ChatMessage[] }
  | { type: 'UPDATE_VITALS'; vitals: VitalSigns; elapsed: number }
  | { type: 'ADD_ALERT'; alert: VitalSignsAlert }
  | { type: 'CLEAR_ALERTS' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'ADD_ACTION'; action: NursingAction }
  | { type: 'CHANGE_PHASE'; phase: ADPIEPhase }
  | { type: 'END_SIMULATION'; score: ScoreBreakdown }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'RESET' };

const initialState: SimState = {
  sessionId: null,
  scenario: null,
  currentVitals: null,
  elapsedTime: 0,
  phase: 'assessment',
  actions: [],
  messages: [],
  alerts: [],
  score: null,
  isActive: false,
  isLoading: false,
};

function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case 'START_SIMULATION':
      return {
        ...initialState,
        sessionId: action.sessionId,
        scenario: action.scenario,
        currentVitals: action.vitals,
        messages: action.messages,
        isActive: true,
      };
    case 'UPDATE_VITALS':
      return { ...state, currentVitals: action.vitals, elapsedTime: action.elapsed };
    case 'ADD_ALERT':
      return { ...state, alerts: [...state.alerts.slice(-4), action.alert] };
    case 'CLEAR_ALERTS':
      return { ...state, alerts: [] };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'ADD_ACTION':
      return { ...state, actions: [...state.actions, action.action] };
    case 'CHANGE_PHASE':
      return { ...state, phase: action.phase };
    case 'END_SIMULATION':
      return { ...state, isActive: false, score: action.score };
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const SimulationContext = createContext<{
  state: SimState;
  dispatch: React.Dispatch<SimAction>;
} | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simReducer, initialState);
  return (
    <SimulationContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulationContext() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulationContext must be used within SimulationProvider');
  return context;
}
