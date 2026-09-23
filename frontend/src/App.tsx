import { useEffect, useState } from 'react';
import { getHealth, type BackendHealth } from './api/HealthApi';
import HomePage from './pages/HomePage/HomePage';
import ChatPage from './pages/ChatPage/ChatPage';
import CallPage from './pages/CallPage/CallPage';
import FilesPage from './pages/FilesPage/FilesPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import './styles/reset.css';
import './styles/variables.css';
import './styles/global.css';

const pages = ['Home', 'Chat', 'Calls', 'Files', 'Settings', 'Login', 'Register'] as const;
type Page = (typeof pages)[number];
const pageComponents = { Home: HomePage, Chat: ChatPage, Calls: CallPage, Files: FilesPage, Settings: SettingsPage, Login: LoginPage, Register: RegisterPage };

export default function App() {
  const [page, setPage] = useState<Page>('Home');
  const [backend, setBackend] = useState<BackendHealth | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => { if (active) setBackend(health); })
      .catch(() => { if (active) setConnectionError(true); });
    return () => { active = false; };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={() => setPage('Home')}>LAN<span>-</span>Media</a>
        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {pages.map((item) => (
            <button className={`nav-link${page === item ? ' nav-link--active' : ''}`} key={item} onClick={() => setPage(item)} type="button">
              <span className="nav-dot" aria-hidden="true" />{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">Private communication<br />on your local network</div>
      </aside>
      <main className="main-content">
        <header className="topbar"><span>LAN workspace</span><span className="frontend-status"><i /> Frontend: Online</span></header>
        <section className="page-content">
          <p className="eyebrow">YOUR LOCAL NETWORK</p>
          {(() => { const CurrentPage = pageComponents[page]; return <CurrentPage />; })()}
          <div className="status-grid">
            <article className="status-card">
              <div className="card-heading"><span>Backend connection</span><span className={`status-pill ${backend ? 'is-online' : connectionError ? 'is-offline' : 'is-pending'}`}><i />{backend ? 'Connected' : connectionError ? 'Offline' : 'Connecting'}</span></div>
              <h2>{backend?.service ?? 'LAN-Media Backend'}</h2>
              <p>API: <strong>{backend?.status === 'ok' ? 'OK' : connectionError ? 'Unavailable' : 'Checking…'}</strong></p>
            </article>
            <article className="status-card status-card--muted">
              <div className="card-heading"><span>Current phase</span><span className="phase-pill">Phase 1</span></div>
              <h2>Project foundation</h2>
              <p>Core setup is ready for the next development phase.</p>
            </article>
          </div>
          <div className="notice"><span className="notice-mark">✦</span><p><strong>{page} page</strong><br />This is a Phase 1 placeholder. Features will be added incrementally.</p></div>
        </section>
      </main>
    </div>
  );
}
