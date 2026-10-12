import { useEffect, useRef } from 'react';
import type { CallController } from '../../hooks/useCall';
import type { AuthUser } from '../../api/AuthApi';

const icons = {
  mic: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3m-4 0h8" /><path d="M12 19v3" /></svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l5-3v10l-5-3" /><rect x="3" y="6" width="12" height="12" rx="2" /></svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 1 18 0v5a2 2 0 0 1-2 2h-5l-5 3v-3H5a2 2 0 0 1-2-2z" /></svg>
  ),
  screen: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6" /></svg>
  ),
  hangup: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.5c-1.4 0-2.8-.2-4.1-.7a1.8 1.8 0 0 0-1.7.4l-2.4 2.4a16.4 16.4 0 0 1-7.2-7.2l2.4-2.4a1.8 1.8 0 0 0 .4-1.7A16.5 16.5 0 0 1 8.5 3c0-.8-.6-1.5-1.3-1.5H4.7A1.7 1.7 0 0 0 3 3.2c0 8.9 7.2 16.1 16.1 16.1a1.7 1.7 0 0 0 1.7-1.7v-2.5c0-.8-.6-1.5-1.5-1.5Z" /></svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  sound: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm6 6a6 6 0 0 1-6 6M17 3a10 10 0 0 1 0 18" /></svg>
  )
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LA';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'LA';
}

export default function CallDialog({ call, contacts }: { call: CallController; contacts: AuthUser[] }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);

  useEffect(() => { if (call.local && localVideo.current) localVideo.current.srcObject = call.local; }, [call.local]);
  useEffect(() => { if (call.remote && remoteVideo.current) remoteVideo.current.srcObject = call.remote; }, [call.remote]);
  useEffect(() => { if (call.remote && remoteAudio.current) remoteAudio.current.srcObject = call.remote; }, [call.remote]);

  if (!call.call) return call.error ? <div className="call-toast" role="alert">{call.error}</div> : null;

  const active = call.call;
  const peerName = contacts.find((item) => item.id === active.peerId)?.displayName ?? active.peerName;
  const isIncoming = active.incoming;
  const durationLabel = active.connectedAt ? ` · ${String(Math.floor(call.duration / 60)).padStart(2, '0')}:${String(call.duration % 60).padStart(2, '0')}` : '';

  return (
    <div className={`call-overlay ${active.type === 'video' ? 'is-video' : ''}`} role="dialog" aria-modal="true" aria-label={`${active.type} call`}>
      <section className="call-card">
        <header className="call-header">
          <div className="call-brand">
            <span className="call-brand-mark">L</span>
            <span>LAN-Media</span>
          </div>

          <div className="call-status-pill">
            <span className={`call-status-dot${isIncoming ? ' is-ringing' : ''}`} />
            <span>{isIncoming ? 'Cuộc gọi đến' : active.connectedAt ? 'Cuộc gọi đang diễn ra' : active.phase === 'Ringing...' ? 'Đang đổ chuông' : 'Đang kết nối'}</span>
          </div>

          <button type="button" className="call-minimize" aria-label={isIncoming ? 'Từ chối cuộc gọi' : 'Đóng cuộc gọi'} onClick={() => call.end()}>
            {icons.close}
          </button>
        </header>

        <div className="call-main">
          <div className="call-center-panel">
            {active.type === 'video' && !isIncoming ? (
              <div className="call-video-stage">
                <video ref={remoteVideo} autoPlay playsInline muted={false} />
                <video ref={localVideo} autoPlay muted playsInline className="call-local-video" />
              </div>
            ) : (
              <div className={`call-avatar-shell${isIncoming ? ' is-ringing' : ''}`}>
                <div className="call-avatar large">{initials(peerName)}</div>
              </div>
            )}

            <div className="call-name-wrap">
              <h2>{peerName}</h2>
              <p>{isIncoming ? `đang gọi ${active.type === 'voice' ? 'thoại' : 'video'} cho bạn` : `${active.type === 'voice' ? 'Cuộc gọi thoại' : 'Cuộc gọi video'}${durationLabel}`}</p>
            </div>

            {isIncoming
              ? <p className="call-incoming-hint">Trả lời để bắt đầu cuộc gọi</p>
              : <div className="call-signal-bars" aria-label="Signal quality"><span /><span /><span /><span /><span /></div>}
          </div>

          {!isIncoming && <div className="call-local-mini">
            <div className="call-avatar small">{initials('Bạn')}</div>
            <span>Bạn</span>
          </div>}
        </div>

        {isIncoming ? <div className="call-toolbar call-toolbar--incoming">
          <button type="button" className="call-tool call-tool-danger" onClick={() => call.reject()} aria-label="Từ chối cuộc gọi">
            {icons.hangup}
            <span>Từ chối</span>
          </button>
          <button type="button" className="call-tool call-tool-accept" onClick={() => void call.accept()} aria-label="Trả lời cuộc gọi">
            {icons.mic}
            <span>Trả lời</span>
          </button>
        </div> : <div className="call-toolbar">
          <button type="button" className={`call-tool ${call.muted ? 'is-muted' : ''}`} onClick={call.toggleMute} aria-label={call.muted ? 'Bật mic' : 'Tắt mic'}>
            {icons.mic}
            <span>{call.muted ? 'Bật mic' : 'Mic'}</span>
          </button>

          <button type="button" className={`call-tool ${call.cameraOff ? 'is-muted' : ''}`} onClick={call.toggleCamera} aria-label={call.cameraOff ? 'Bật camera' : 'Tắt camera'}>
            {icons.camera}
            <span>{call.cameraOff ? 'Bật camera' : 'Camera'}</span>
          </button>

          <button type="button" className="call-tool">
            {icons.chat}
            <span>Chia sẻ</span>
          </button>

          <button type="button" className="call-tool">
            {icons.sound}
            <span>Âm thanh</span>
          </button>

          <button type="button" className="call-tool call-tool-danger" onClick={() => call.end()} aria-label="Kết thúc cuộc gọi">
            {icons.hangup}
            <span>Kết thúc</span>
          </button>
        </div>}
      </section>
    </div>
  );
}
