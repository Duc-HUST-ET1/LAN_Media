import { randomUUID } from 'node:crypto';
import type { CallSession, CallType } from '../models/Call.js';
import { ApiError } from '../core/errors/ApiError.js';

export class CallService {
  private readonly calls = new Map<string, CallSession>();
  private readonly activeByUser = new Map<string, string>();
  start(callerId: string, calleeId: string, type: CallType): CallSession {
    if (callerId === calleeId) throw new ApiError(400, 'You cannot call yourself.');
    if (this.activeByUser.has(callerId) || this.activeByUser.has(calleeId)) throw new ApiError(409, 'User is currently unavailable.');
    const call = { callId: randomUUID(), callerId, calleeId, type, status: 'ringing' as const };
    this.calls.set(call.callId, call); this.activeByUser.set(callerId, call.callId); this.activeByUser.set(calleeId, call.callId);
    return call;
  }
  get(callId: string, userId: string): CallSession {
    const call = this.calls.get(callId);
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new ApiError(403, 'Unknown call or access denied.');
    return call;
  }
  accept(callId: string, userId: string): CallSession { const call = this.get(callId, userId); if (call.calleeId !== userId || call.status !== 'ringing') throw new ApiError(409, 'Call cannot be accepted.'); call.status = 'accepted'; return call; }
  finish(callId: string): CallSession | undefined { const call = this.calls.get(callId); if (!call) return; this.calls.delete(callId); this.activeByUser.delete(call.callerId); this.activeByUser.delete(call.calleeId); return call; }
  finishForUser(userId: string): CallSession | undefined { const id = this.activeByUser.get(userId); return id ? this.finish(id) : undefined; }
}
export const callService = new CallService();
