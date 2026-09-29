export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'connected' | 'ended';
export interface CallSession { callId: string; callerId: string; calleeId: string; type: CallType; status: CallStatus; }
