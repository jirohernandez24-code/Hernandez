import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WSClientMessage, WSServerMessage } from '../../../shared/types.js';
import { handleChat, performAction, changePhase, setVitalsCallback } from '../services/simulationEngine.js';

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    let boundSessionId: string | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSClientMessage = JSON.parse(data.toString());

        // Bind vitals callback on first message
        if (!boundSessionId && message.sessionId) {
          boundSessionId = message.sessionId;
          setVitalsCallback(message.sessionId, (vitals, elapsed, alerts) => {
            if (ws.readyState === WebSocket.OPEN) {
              const vitalsUpdate: WSServerMessage = { type: 'vitals:update', vitals, elapsed };
              ws.send(JSON.stringify(vitalsUpdate));

              for (const alert of alerts) {
                const alertMsg: WSServerMessage = { type: 'vitals:alert', alert };
                ws.send(JSON.stringify(alertMsg));
              }
            }
          });
        }

        switch (message.type) {
          case 'chat:message': {
            const response = await handleChat(message.sessionId, message.content);
            const chatResponse: WSServerMessage = { type: 'chat:response', message: response };
            ws.send(JSON.stringify(chatResponse));
            break;
          }

          case 'action:perform': {
            const result = performAction(message.sessionId, message.action);
            const actionResult: WSServerMessage = {
              type: 'action:result',
              actionId: result.actionId,
              success: result.success,
              message: result.message,
            };
            ws.send(JSON.stringify(actionResult));
            break;
          }

          case 'phase:change': {
            const changed = changePhase(message.sessionId, message.phase);
            if (changed) {
              const phaseMsg: WSServerMessage = { type: 'phase:changed', phase: message.phase };
              ws.send(JSON.stringify(phaseMsg));
            }
            break;
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process message' }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
}
