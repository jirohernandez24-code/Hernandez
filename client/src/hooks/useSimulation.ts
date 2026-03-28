import { useCallback } from 'react';
import { useSimulationContext } from '../context/SimulationContext';
import { useWebSocket } from './useWebSocket';
import * as api from '../utils/api';
import type { ADPIEPhase } from '../types';

export function useSimulation() {
  const { state, dispatch } = useSimulationContext();
  const { sendMessage } = useWebSocket(state.sessionId);

  const startSimulation = useCallback(async (scenarioId: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await api.startSimulation(scenarioId);
      dispatch({
        type: 'START_SIMULATION',
        sessionId: result.sessionId,
        scenario: result.scenario,
        vitals: result.currentVitals,
        messages: result.conversationHistory,
      });
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [dispatch]);

  const sendChatMessage = useCallback((content: string) => {
    if (!state.sessionId) return;
    const message = {
      id: crypto.randomUUID(),
      role: 'student' as const,
      content,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD_MESSAGE', message });
    sendMessage({ type: 'chat:message', sessionId: state.sessionId, content });
  }, [state.sessionId, dispatch, sendMessage]);

  const performAction = useCallback(async (action: { type: string; description: string; details?: Record<string, string> }) => {
    if (!state.sessionId) return;
    const result = await api.performAction(state.sessionId, {
      ...action,
      phase: state.phase,
    });
    if (result.success) {
      dispatch({
        type: 'ADD_ACTION',
        action: {
          id: result.actionId,
          ...action,
          type: action.type as 'assessment' | 'intervention' | 'medication' | 'communication' | 'documentation',
          phase: state.phase,
          timestamp: Date.now(),
        },
      });
    }
    return result;
  }, [state.sessionId, state.phase, dispatch]);

  const changePhase = useCallback((phase: ADPIEPhase) => {
    if (!state.sessionId) return;
    sendMessage({ type: 'phase:change', sessionId: state.sessionId, phase });
    dispatch({ type: 'CHANGE_PHASE', phase });
  }, [state.sessionId, sendMessage, dispatch]);

  const endSimulation = useCallback(async () => {
    if (!state.sessionId) return null;
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const result = await api.endSimulation(state.sessionId);
      dispatch({ type: 'END_SIMULATION', score: result.score });
      return result.score;
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [state.sessionId, dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return {
    state,
    startSimulation,
    sendChatMessage,
    performAction,
    changePhase,
    endSimulation,
    reset,
  };
}
