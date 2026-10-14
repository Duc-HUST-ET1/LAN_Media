import { randomUUID } from 'node:crypto';
import type { CallSession, CallType } from '../models/Call.js';
import { ApiError } from '../core/errors/ApiError.js';

export class CallService {
  private readonly calls = new Map<string, CallSession>();
  private readonly activeByUser = new Map<string, string>();
  private readonly ringingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly ringingTimeoutMs = 50_000) {}
  start(callerId: string, calleeId: string, type: CallType, onMissed: (call: CallSession) => void): CallSession {
    if (callerId === calleeId) throw new ApiError(400, 'You cannot call yourself.');
    if (this.activeByUser.has(callerId) || this.activeByUser.has(calleeId)) throw new ApiError(409, 'User is currently unavailable.');
    const call = { callId: randomUUID(), callerId, calleeId, type, status: 'ringing' as const };
    this.calls.set(call.callId, call); this.activeByUser.set(callerId, call.callId); this.activeByUser.set(calleeId, call.callId);
    this.ringingTimers.set(call.callId, setTimeout(() => {
      const expired = this.finish(call.callId);
      if (expired?.status === 'ringing') onMissed(expired);
    }, this.ringingTimeoutMs));
    return call;
  }
  get(callId: string, userId: string): CallSession {
    const call = this.calls.get(callId);
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new ApiError(403, 'Unknown call or access denied.');
    return call;
  }
  accept(callId: string, userId: string): CallSession {
    const call = this.get(callId, userId);
    if (call.calleeId !== userId || call.status !== 'ringing') throw new ApiError(409, 'Call cannot be accepted.');
    call.status = 'accepted';
    this.clearRingingTimer(callId);
    return call;
  }
  finish(callId: string): CallSession | undefined {
    const call = this.calls.get(callId);
    if (!call) return;
    this.clearRingingTimer(callId);
    this.calls.delete(callId); this.activeByUser.delete(call.callerId); this.activeByUser.delete(call.calleeId);
    return call;
  }
  finishForUser(userId: string): CallSession | undefined {
    const id = this.activeByUser.get(userId);
    return id ? this.finish(id) : undefined;
  }
  private clearRingingTimer(callId: string): void {
    const timer = this.ringingTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.ringingTimers.delete(callId);
  }
}
export const callService = new CallService();
