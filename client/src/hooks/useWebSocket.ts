import { useEffect, useRef, useCallback } from 'react';
import type { WSClientMessage, WSServerMessage } from '../types';
import { useSimulationContext } from '../context/SimulationContext';

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { dispatch } = useSimulationContext();

  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: WSServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'vitals:update':
          dispatch({ type: 'UPDATE_VITALS', vitals: msg.vitals, elapsed: msg.elapsed });
          break;
        case 'vitals:alert':
          dispatch({ type: 'ADD_ALERT', alert: msg.alert });
          break;
        case 'chat:response':
          dispatch({ type: 'ADD_MESSAGE', message: msg.message });
          break;
        case 'phase:changed':
          dispatch({ type: 'CHANGE_PHASE', phase: msg.phase });
          break;
        case 'simulation:ended':
          dispatch({ type: 'END_SIMULATION', score: msg.score });
          break;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, dispatch]);

  const sendMessage = useCallback((msg: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendMessage };
}
