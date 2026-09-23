import { useState, type FormEvent } from 'react';
import '../LoginPage/LoginPage.css';

interface RegisterPageProps {
  onRegister: (input: { username: string; email: string; displayName: string; password: string }) => Promise<void>;
  onNavigate: (path: '/login') => void;
}

export default function RegisterPage({ onRegister, onNavigate }: RegisterPageProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try { await onRegister({ username, email, displayName, password }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Registration failed.'); }
    finally { setSubmitting(false); }
  }

  return (
    <section className="auth-panel">
      <p className="eyebrow">YOUR PRIVATE LAN</p>
      <h1>Create your account</h1>
      <p className="auth-description">Set up an account on this LAN-Media server.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Username<input autoComplete="username" minLength={3} maxLength={32} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_.-]+" required value={username} /></label>
        <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label>Display name<input autoComplete="name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
        <label>Password<input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        <label>Confirm password<input autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={submitting} type="submit">{submitting ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="auth-switch">Already registered? <button onClick={() => onNavigate('/login')} type="button">Sign in</button></p>
    </section>
  );
}
