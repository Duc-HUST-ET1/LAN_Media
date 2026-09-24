import { useState } from 'react';
import type { AuthUser } from '../../api/AuthApi';

interface HomePageProps { user: AuthUser; onLogout: () => Promise<void>; onNavigate: (path: '/' | '/chat' | '/calls' | '/files' | '/settings') => void }

export default function HomePage({ user, onLogout, onNavigate }: HomePageProps) {
  const [error, setError] = useState('');

  async function handleLogout() {
    try { await onLogout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not log out.'); }
  }

  return (
    <>
      <p className="eyebrow">YOUR LOCAL NETWORK</p>
      <div className="home-heading"><div><h1>Welcome, {user.displayName}</h1><p className="intro">Your people and conversations, together in one place.</p></div><button className="secondary-button" onClick={() => void handleLogout()} type="button">Log out</button></div>
      <div className="home-dashboard">
        <button className="home-chat-card" onClick={() => onNavigate('/chat')} type="button"><span className="home-chat-icon">◉</span><span><strong>Open your messages</strong><small>Chat with people on your LAN</small></span><span className="home-card-arrow">›</span></button>
        <div className="status-card home-account-card"><div className="home-account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div><div className="home-account-copy"><div className="card-heading"><span>Your account</span><span className="phase-pill">{user.role}</span></div><h2>{user.displayName}</h2><p>@{user.username} · {user.email}</p></div></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
