import { useState, type FormEvent } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
  onNavigate: (path: '/register') => void;
}

export default function LoginPage({ onLogin, onNavigate }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try { await onLogin(identifier, password); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Login failed.'); }
    finally { setSubmitting(false); }
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Sign in to LAN-Media</h1>
      <p className="auth-description">Use your username or email to continue.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Username or email<input autoComplete="username" onChange={(event) => setIdentifier(event.target.value)} required value={identifier} /></label>
        <label>Password<input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">New to this server? <button onClick={() => onNavigate('/register')} type="button">Create an account</button></p>
    </section>
  );
}
