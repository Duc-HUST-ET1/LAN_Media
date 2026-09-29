import WebSocket from 'ws';
import { ApiError } from '../../core/errors/ApiError.js';
import type { UserRepository } from '../../repositories/UserRepository.js';
import type { ConnectionManager } from '../ConnectionManager.js';
import { callService } from '../../services/CallService.js';

interface Event { type?: string; requestId?: string; payload?: Record<string, unknown>; }
const signalTypes = new Set(['webrtc_offer', 'webrtc_answer', 'ice_candidate']);
export class CallHandler {
  constructor(private readonly users: UserRepository, private readonly connections: ConnectionManager) {}
  async handle(socket: WebSocket, userId: string, raw: WebSocket.RawData): Promise<void> {
    let event: Event;
    try { event = JSON.parse(raw.toString()) as Event; } catch { this.error(socket, undefined, 'INVALID_JSON', 'Message must be valid JSON.'); return; }
    const p = event.payload ?? {}; const req = event.requestId;
    try {
      if (event.type === 'call_user') {
        const targetId = p.targetId; const type = p.callType;
        if (typeof targetId !== 'string' || (type !== 'voice' && type !== 'video')) throw new ApiError(400, 'targetId and callType are required.');
        if (!(await this.users.findById(targetId))) throw new ApiError(404, 'User not found.');
        if (!this.connections.isOnline(targetId)) throw new ApiError(409, 'User is currently unavailable.');
        const call = callService.start(userId, targetId, type);
        const caller = await this.users.findById(userId);
        this.connections.sendToUser(targetId, { type: 'incoming_call', payload: { callId: call.callId, callerId: userId, callerName: caller?.displayName ?? 'Contact', callType: type } });
        this.connections.sendToUser(userId, { type: 'call_ringing', payload: { callId: call.callId, targetId } });
      } else {
        const callId = p.callId;
        if (typeof callId !== 'string') throw new ApiError(400, 'callId is required.');
        const call = callService.get(callId, userId); const target = call.callerId === userId ? call.calleeId : call.callerId;
        if (event.type === 'call_accept') { callService.accept(callId, userId); this.connections.sendToUser(target, { type: 'call_accepted', payload: { callId } }); }
        else if (event.type === 'call_reject') { callService.finish(callId); this.connections.sendToUsers([call.callerId, call.calleeId], { type: 'call_rejected', payload: { callId } }); }
        else if (event.type === 'end_call') { callService.finish(callId); this.connections.sendToUsers([call.callerId, call.calleeId], { type: 'call_ended', payload: { callId } }); }
        else if (signalTypes.has(event.type ?? '')) {
          if (call.status !== 'accepted') throw new ApiError(409, 'Call signaling is not available before acceptance.');
          const field = event.type === 'webrtc_offer' || event.type === 'webrtc_answer' ? 'description' : 'candidate';
          if (!p[field] || typeof p[field] !== 'object') throw new ApiError(400, `${field} is required.`);
          this.connections.sendToUser(target, { type: event.type, payload: { callId, [field]: p[field] } });
        } else throw new ApiError(400, 'Unsupported call event.');
      }
    } catch (e) { this.error(socket, req, e instanceof ApiError ? `HTTP_${e.statusCode}` : 'SERVER_ERROR', e instanceof Error ? e.message : 'Call request failed.'); }
  }
  endForUser(userId: string): void { const call = callService.finishForUser(userId); if (call) this.connections.sendToUser(call.callerId === userId ? call.calleeId : call.callerId, { type: 'call_ended', payload: { callId: call.callId } }); }
  private error(socket: WebSocket, requestId: string | undefined, code: string, message: string): void { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'call_error', requestId, error: { code, message } })); }
}
