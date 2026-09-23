import type { Server } from 'node:http';
import WebSocket, { WebSocketServer as WsServer } from 'ws';
import { appConfig } from '../core/config/AppConfig.js';
import { hashSessionToken, sessionCookieName } from '../core/security/AuthMiddleware.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { database } from '../core/database/Database.js';
import { ApiError } from '../core/errors/ApiError.js';
import { connectionManager } from './ConnectionManager.js';
import { ChatHandler } from './handlers/ChatHandler.js';
import { chatService } from '../controllers/ChatController.js';

const sessions = new SessionRepository(database);
const chatHandler = new ChatHandler(chatService, connectionManager);

function requestToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key !== sessionCookieName) continue;
    try { return decodeURIComponent(value.join('=')) || null; } catch { return null; }
  }
  return null;
}

export function attachWebSocketServer(server: Server): WsServer {
  const wss = new WsServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/ws') { socket.destroy(); return; }
    const origin = request.headers.origin;
    if (origin && !appConfig.frontendOrigins.includes(origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, (ws) => { wss.emit('connection', ws, request); });
  });
  wss.on('connection', async (socket: WebSocket, request) => {
    try {
      const token = requestToken(request.headers.cookie);
      if (!token) { socket.close(4401, 'Authentication required'); return; }
      const identity = await sessions.findSessionIdentity(hashSessionToken(token));
      if (!identity) { socket.close(4401, 'Authentication required'); return; }
      if (socket.readyState !== WebSocket.OPEN) return;
      const connection = { socket, sessionId: identity.id, user: identity.user };
      if (connectionManager.add(connection)) connectionManager.broadcast({ type: 'presence.online', payload: { userId: identity.user.id } }, identity.user.id);
      socket.on('message', (raw) => { void chatHandler.handle(socket, identity.user.id, raw); });
      socket.on('close', () => {
        if (connectionManager.remove(connection)) connectionManager.broadcast({ type: 'presence.offline', payload: { userId: identity.user.id } }, identity.user.id);
      });
      socket.on('error', (error) => console.warn('WebSocket connection error:', error.message));
    } catch (error) {
      console.error('WebSocket authentication failed:', error instanceof Error ? error.message : 'Unknown error');
      socket.close(error instanceof ApiError ? 4401 : 1011, 'Connection could not be authenticated');
    }
  });
  return wss;
}
