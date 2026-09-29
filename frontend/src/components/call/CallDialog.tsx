import { useEffect, useRef } from 'react';
import type { CallController } from '../../hooks/useCall';
import type { AuthUser } from '../../api/AuthApi';

export default function CallDialog({ call, contacts }: { call: CallController; contacts: AuthUser[] }) {
  const localVideo = useRef<HTMLVideoElement>(null); const remoteVideo = useRef<HTMLVideoElement>(null); const remoteAudio = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (call.local && localVideo.current) localVideo.current.srcObject = call.local; }, [call.local]);
  useEffect(() => { if (call.remote && remoteVideo.current) remoteVideo.current.srcObject = call.remote; }, [call.remote]);
  useEffect(() => { if (call.remote && remoteAudio.current) remoteAudio.current.srcObject = call.remote; }, [call.remote]);
  if (!call.call) return call.error ? <div className="call-toast" role="alert">{call.error}</div> : null;
  const active = call.call;
  return <div className="call-overlay" role="dialog" aria-modal="true" aria-label={`${active.type} call`}><section className="call-card"><h2>{active.incoming ? `Incoming ${active.type} call` : `${active.type === 'voice' ? 'Voice' : 'Video'} call`}</h2><strong>{contacts.find(item => item.id === active.peerId)?.displayName ?? active.peerName}</strong><p>{active.phase}{active.connectedAt ? ` · ${String(Math.floor(call.duration / 60)).padStart(2, '0')}:${String(call.duration % 60).padStart(2, '0')}` : ''}</p>{active.type === 'video' ? <div className="call-videos"><video ref={remoteVideo} autoPlay playsInline /><video ref={localVideo} autoPlay muted playsInline /></div> : <audio ref={remoteAudio} autoPlay controls />}{active.incoming ? <div className="call-controls"><button onClick={() => void call.accept()}>Accept</button><button onClick={() => call.reject()}>Reject</button></div> : <div className="call-controls"><button onClick={call.toggleMute}>{call.muted ? 'Unmute' : 'Mute'}</button>{active.type === 'video' && <button onClick={call.toggleCamera}>{call.cameraOff ? 'Camera on' : 'Camera off'}</button>}<button onClick={() => call.end()}>End call</button></div>}{call.error && <p role="alert">{call.error}</p>}</section></div>;
}
