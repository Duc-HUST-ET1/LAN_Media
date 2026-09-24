import WebSocket from 'ws';
import { ApiError } from '../../core/errors/ApiError.js';
import type { ChatService } from '../../services/ChatService.js';
import type { ConnectionManager } from '../ConnectionManager.js';

interface ClientEvent { type?: string; requestId?: string; payload?: { conversationId?: string; content?: string }; }
export class ChatHandler {
  constructor(private readonly chat: ChatService, private readonly connections: ConnectionManager) {}
  async handle(socket: WebSocket, userId: string, raw: WebSocket.RawData): Promise<void> {
    let event: ClientEvent;
    try { event = JSON.parse(raw.toString()) as ClientEvent; }
    catch { this.error(socket, undefined, 'INVALID_JSON', 'Message must be valid JSON.'); return; }
    const requestId = typeof event.requestId === 'string' ? event.requestId : undefined;
    try {
      const conversationId = event.payload?.conversationId;
      if (event.type === 'chat.send') {
        if (!conversationId || typeof event.payload?.content !== 'string') throw new ApiError(400, 'conversationId and content are required.');
        console.info('[ws] chat.send received', { userId, conversationId, contentLength: event.payload.content.length });
        const message = await this.chat.send(userId, conversationId, event.payload.content);
        const conversation = (await this.chat.listConversations(userId)).find(item => item.id === conversationId);
        this.connections.sendToUsers(conversation?.members.map(member => member.userId) ?? [userId], { type: 'chat.message', requestId, payload: { message } });
        console.info('[ws] chat.send persisted and broadcast', { messageId: message.id, recipientCount: conversation?.members.length ?? 1 });
      } else if (event.type === 'chat.typing.start' || event.type === 'chat.typing.stop') {
        if (!conversationId) throw new ApiError(400, 'conversationId is required.');
        await this.chat.assertMember(userId, conversationId);
        const conversation = (await this.chat.listConversations(userId)).find(item => item.id === conversationId);
        this.connections.sendToUsers(conversation?.members.map(member => member.userId).filter(id => id !== userId) ?? [], { type: event.type, payload: { conversationId, userId } });
      } else throw new ApiError(400, 'Unsupported event type.');
    } catch (error) {
      if (error instanceof ApiError) { console.warn('[ws] client event rejected', { userId, requestId, code: error.statusCode, message: error.message }); this.error(socket, requestId, `HTTP_${error.statusCode}`, error.message); }
      else {
        console.error('WebSocket event failed:', error instanceof Error ? error.message : 'Unknown error');
        this.error(socket, requestId, 'SERVER_ERROR', 'Request failed.');
      }
    }
  }
  private error(socket: WebSocket, requestId: string | undefined, code: string, message: string): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'error', requestId, error: { code, message } }));
  }
}
