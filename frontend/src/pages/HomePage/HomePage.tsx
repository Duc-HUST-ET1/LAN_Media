import { useState } from 'react';
import type { AuthUser } from '../../api/AuthApi';

interface HomePageProps { user: AuthUser; onLogout: () => Promise<void> }

export default function HomePage({ user, onLogout }: HomePageProps) {
  const [error, setError] = useState('');

  async function handleLogout() {
    try { await onLogout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not log out.'); }
  }

  return (
    <>
      <p className="eyebrow">YOUR LOCAL NETWORK</p>
      <div className="home-heading"><div><h1>Welcome, {user.displayName}</h1><p className="intro">Your private space for communication and media sharing.</p></div><button className="secondary-button" onClick={() => void handleLogout()} type="button">Log out</button></div>
      <div className="status-card"><div className="card-heading"><span>Account</span><span className="phase-pill">{user.role}</span></div><h2>{user.username}</h2><p>{user.email}</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
