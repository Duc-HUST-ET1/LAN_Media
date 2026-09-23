import { useEffect, useState, type ReactNode } from 'react';
import { getHealth, type BackendHealth } from './api/HealthApi';
import { useAuth } from './hooks/useAuth';
import HomePage from './pages/HomePage/HomePage';
import ChatPage from './pages/ChatPage/ChatPage';
import CallPage from './pages/CallPage/CallPage';
import FilesPage from './pages/FilesPage/FilesPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import LoginPage from './pages/LoginPage/LoginPage';
import RegisterPage from './pages/RegisterPage/RegisterPage';
import { useWebSocket } from './hooks/useWebSocket';
import './styles/reset.css';
import './styles/variables.css';
import './styles/global.css';

const routes = {
  '/': 'Home', '/chat': 'Chat', '/calls': 'Calls', '/files': 'Files', '/settings': 'Settings',
  '/login': 'Login', '/register': 'Register',
} as const;
type Route = keyof typeof routes;
type Page = (typeof routes)[Route];
const protectedPages: Array<{ path: Route; title: Page }> = [
  { path: '/', title: 'Home' }, { path: '/chat', title: 'Chat' }, { path: '/calls', title: 'Calls' },
  { path: '/files', title: 'Files' }, { path: '/settings', title: 'Settings' },
];

function currentRoute(): Route {
  const path = window.location.pathname;
  return Object.hasOwn(routes, path) ? path as Route : '/';
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [backend, setBackend] = useState<BackendHealth | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const auth = useAuth();
  const realtime = useWebSocket(Boolean(auth.user));

  function navigate(path: Route, replace = false) {
    if (replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    setRoute(path);
  }

  useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    const isPublicRoute = route === '/login' || route === '/register';
    if (!auth.user && !isPublicRoute) navigate('/login', true);
    if (auth.user && isPublicRoute) navigate('/', true);
  }, [auth.loading, auth.user, route]);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => { if (active) setBackend(health); })
      .catch(() => { if (active) setConnectionError(true); });
    return () => { active = false; };
  }, []);

  const page: Page = routes[route];
  const handleLogin = async (identifier: string, password: string) => {
    await auth.login(identifier, password);
    navigate('/');
  };
  const handleRegister = async (input: { username: string; email: string; displayName: string; password: string }) => {
    await auth.register(input);
    navigate('/');
  };
  const handleLogout = async () => {
    await auth.logout();
    navigate('/login');
  };

  let pageContent: ReactNode;
  if (auth.loading) {
    pageContent = <p className="intro">Checking your session…</p>;
  } else if (!auth.user && route === '/login') {
    pageContent = <LoginPage onLogin={handleLogin} onNavigate={(path) => navigate(path)} />;
  } else if (!auth.user && route === '/register') {
    pageContent = <RegisterPage onRegister={handleRegister} onNavigate={(path) => navigate(path)} />;
  } else if (auth.user && route === '/') {
    pageContent = <HomePage user={auth.user} onLogout={handleLogout} />;
  } else if (auth.user && route === '/chat') {
    pageContent = <ChatPage userId={auth.user.id} />;
  } else if (auth.user && route === '/calls') {
    pageContent = <CallPage />;
  } else if (auth.user && route === '/files') {
    pageContent = <FilesPage />;
  } else if (auth.user) {
    pageContent = <SettingsPage />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>LAN<span>-</span>Media</a>
        {auth.user ? <>
          <p className="sidebar-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {protectedPages.map((item) => (
              <a className={`nav-link${route === item.path ? ' nav-link--active' : ''}`} href={item.path} key={item.path} onClick={(event) => { event.preventDefault(); navigate(item.path); }}>
                <span className="nav-dot" aria-hidden="true" />{item.title}
              </a>
            ))}
          </nav>
          <div className="sidebar-footer">Signed in as<br /><strong>{auth.user.username}</strong></div>
        </> : <div className="sidebar-guest">Private communication<br />on your local network</div>}
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>LAN workspace</span>
          <div className="system-status">
            {auth.user && <span className={`frontend-status ${realtime.status !== 'connected' ? 'is-disconnected' : ''}`}><i /> Realtime: {realtime.status}</span>}
            <span className="frontend-status"><i /> Frontend: Online</span>
            <span className={`frontend-status ${backend?.database === 'connected' ? '' : 'is-disconnected'}`}><i /> Database: {backend?.database ?? (connectionError ? 'Offline' : 'Connecting')}</span>
          </div>
        </header>
        <section className="page-content">
          {page !== 'Login' && page !== 'Register' && page !== 'Home' && <p className="eyebrow">YOUR LOCAL NETWORK</p>}
          {pageContent}
          {auth.user && route !== '/' && <button className="secondary-button page-logout" onClick={() => void handleLogout()} type="button">Log out</button>}
        </section>
      </main>
    </div>
  );
}
