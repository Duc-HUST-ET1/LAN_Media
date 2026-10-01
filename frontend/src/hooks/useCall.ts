import { useCallback, useEffect, useRef, useState } from 'react';
import { realtimeClient, type RealtimeEvent } from '../api/RealtimeClient';

export type CallType = 'voice' | 'video';
export interface CallState { callId: string; peerId: string; peerName: string; type: CallType; phase: string; incoming: boolean; connectedAt?: number; }
const iceServers: RTCIceServer[] = (import.meta.env.VITE_ICE_SERVERS ?? 'stun:stun.l.google.com:19302').split(',').map((urls: string) => ({ urls: urls.trim() }));
export function useCall() {
  const [call, setCall] = useState<CallState | null>(null); const [local, setLocal] = useState<MediaStream | null>(null); const [remote, setRemote] = useState<MediaStream | null>(null); const [muted, setMuted] = useState(false); const [cameraOff, setCameraOff] = useState(false); const [error, setError] = useState(''); const [duration, setDuration] = useState(0);
  const peer = useRef<RTCPeerConnection | null>(null); const stream = useRef<MediaStream | null>(null); const pending = useRef<RTCIceCandidateInit[]>([]); const callRef = useRef<CallState | null>(null);
  const update = (value: CallState | null) => { callRef.current = value; setCall(value); };
  const cleanup = useCallback(() => { peer.current?.close(); peer.current = null; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; pending.current = []; setLocal(null); setRemote(null); setMuted(false); setCameraOff(false); }, []);
  const end = useCallback((notify = true) => { const current = callRef.current; if (notify && current) realtimeClient.send({ type: current.incoming ? 'call_reject' : 'end_call', payload: { callId: current.callId } }); cleanup(); update(null); }, [cleanup]);
  const getMedia = useCallback(async (type: CallType) => {
    if (typeof RTCPeerConnection === 'undefined') throw new Error('This browser does not provide WebRTC. Update it or use a recent Chrome, Edge, Firefox, or Safari.');
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!window.isSecureContext) throw new Error('Microphone and camera are blocked because this page is not secure. On another LAN device, open LAN-Media over HTTPS; HTTP works only on localhost.');
      throw new Error('This browser does not provide microphone and camera access. Use a recent browser and allow this site to access your devices.');
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' }); stream.current = media; setLocal(media); return media;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'NotAllowedError') throw new Error('Camera or microphone permission was denied. Allow access in the browser address bar or site settings, then try again.');
      if (cause instanceof DOMException && cause.name === 'NotFoundError') throw new Error(type === 'video' ? 'No camera or microphone was found on this device.' : 'No microphone was found on this device.');
      if (cause instanceof DOMException && (cause.name === 'NotReadableError' || cause.name === 'AbortError')) throw new Error('The camera or microphone is busy or unavailable. Close other apps using it and try again.');
      throw cause;
    }
  }, []);
  const startPeer = useCallback(async (type: CallType) => {
    const pc = new RTCPeerConnection({ iceServers }); peer.current = pc;
    const media = stream.current ?? await getMedia(type); media.getTracks().forEach(track => pc.addTrack(track, media));
    pc.ontrack = event => setRemote(event.streams[0] ?? new MediaStream([event.track]));
    pc.onicecandidate = event => { const active = callRef.current; if (event.candidate && active) realtimeClient.send({ type: 'ice_candidate', payload: { callId: active.callId, candidate: event.candidate.toJSON() } }); };
    pc.onconnectionstatechange = () => { const active = callRef.current; if (pc.connectionState === 'connected' && active) update({ ...active, phase: 'Connected', connectedAt: active.connectedAt ?? Date.now() }); else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') { setError('Call connection was lost.'); end(); } };
    return pc;
  }, [end, getMedia]);
  useEffect(() => realtimeClient.subscribe((event: RealtimeEvent) => {
    const p = event.payload ?? {}; const active = callRef.current;
    if (event.type === 'call_error') { setError(event.error?.message ?? 'Call failed.'); if (active?.callId) end(); else if (active && !active.incoming) { cleanup(); update(null); } return; }
    if (event.type === 'incoming_call' && typeof p.callId === 'string' && typeof p.callerId === 'string' && (p.callType === 'voice' || p.callType === 'video')) { update({ callId: p.callId, peerId: p.callerId, peerName: typeof p.callerName === 'string' ? p.callerName : p.callerId, type: p.callType, phase: 'Incoming call', incoming: true }); return; }
    if (!active) return;
    if (event.type === 'call_ringing' && typeof p.callId === 'string') { update({ ...active, callId: p.callId, phase: 'Ringing...' }); return; }
    if (p.callId !== active.callId) return;
    if (event.type === 'call_accepted') { update({ ...active, incoming: false, phase: 'Connecting...' }); void (async () => { try { const pc = await startPeer(active.type); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); realtimeClient.send({ type: 'webrtc_offer', payload: { callId: active.callId, description: offer } }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the call.'); end(); } })(); }
    if (event.type === 'webrtc_offer' && p.description) void (async () => { try { const pc = peer.current ?? await startPeer(active.type); await pc.setRemoteDescription(p.description as RTCSessionDescriptionInit); for (const candidate of pending.current.splice(0)) await pc.addIceCandidate(candidate); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); realtimeClient.send({ type: 'webrtc_answer', payload: { callId: active.callId, description: answer } }); update({ ...active, phase: 'Connecting...' }); } catch (e) { setError(e instanceof Error ? e.message : 'Call negotiation failed.'); end(); } })();
    if (event.type === 'webrtc_answer' && p.description) {
      const currentPeer = peer.current;
      if (!currentPeer || currentPeer.signalingState !== 'have-local-offer') return;
      void currentPeer.setRemoteDescription(p.description as RTCSessionDescriptionInit).then(async () => {
        for (const candidate of pending.current.splice(0)) {
          try { await currentPeer.addIceCandidate(candidate); } catch { /* Match the trickle path: discard an invalid ICE candidate without ending the call. */ }
        }
      }).catch((cause: unknown) => {
        const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
        setError(`Call negotiation failed: ${detail}`);
        end();
      });
    }
    if (event.type === 'ice_candidate' && p.candidate) { const candidate = p.candidate as RTCIceCandidateInit; if (peer.current?.remoteDescription) void peer.current.addIceCandidate(candidate).catch(() => undefined); else pending.current.push(candidate); }
    if (event.type === 'call_rejected' || event.type === 'call_ended') { cleanup(); update(null); if (event.type === 'call_rejected') setError('The call was rejected.'); }
  }), [cleanup, end, startPeer]);
  useEffect(() => realtimeClient.onStatus(status => { if (status === 'disconnected' && callRef.current) { setError('Realtime connection was lost.'); cleanup(); update(null); } }), [cleanup]);
  useEffect(() => { if (!call?.connectedAt) { setDuration(0); return; } const tick = () => setDuration(Math.floor((Date.now() - (call.connectedAt ?? Date.now())) / 1000)); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [call?.connectedAt]);
  const start = useCallback(async (peerId: string, peerName: string, type: CallType) => { setError(''); update({ callId: '', peerId, peerName, type, phase: 'Calling...', incoming: false }); if (!realtimeClient.send({ type: 'call_user', payload: { targetId: peerId, callType: type } })) { update(null); setError('Realtime connection is unavailable.'); } }, []);
  const accept = useCallback(async () => { const active = callRef.current; if (!active) return; try { await getMedia(active.type); if (!realtimeClient.send({ type: 'call_accept', payload: { callId: active.callId } })) throw new Error('Realtime connection is unavailable.'); update({ ...active, incoming: false, phase: 'Connecting...' }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not access microphone or camera.'); realtimeClient.send({ type: 'call_reject', payload: { callId: active.callId } }); cleanup(); update(null); } }, [cleanup, getMedia]);
  const toggleMute = () => { const next = !muted; stream.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); setMuted(next); };
  const toggleCamera = () => { const next = !cameraOff; stream.current?.getVideoTracks().forEach(track => { track.enabled = !next; }); setCameraOff(next); };
  return { call, local, remote, muted, cameraOff, error, duration, start, accept, reject: () => end(true), end, toggleMute, toggleCamera };
}
export type CallController = ReturnType<typeof useCall>;
