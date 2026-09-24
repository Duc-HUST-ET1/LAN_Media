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
const protectedPages: Array<{ path: Route; title: Page; icon: string }> = [
  { path: '/', title: 'Home', icon: '⌂' }, { path: '/chat', title: 'Chat', icon: '◉' }, { path: '/calls', title: 'Calls', icon: '◖' },
  { path: '/files', title: 'Files', icon: '▤' }, { path: '/settings', title: 'Settings', icon: '⚙' },
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
    pageContent = <HomePage user={auth.user} onLogout={handleLogout} onNavigate={navigate} />;
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
    <div className={`app-shell${auth.user ? '' : ' app-shell--guest'}${route === '/chat' ? ' app-shell--chat' : ''}`}>
      <header className="app-topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>LAN<span>-</span>Media</a>
        {auth.user && <nav className="top-nav" aria-label="Main navigation">
          {protectedPages.map((item) => (
            <a className={`nav-link${route === item.path ? ' nav-link--active' : ''}`} href={item.path} key={item.path} onClick={(event) => { event.preventDefault(); navigate(item.path); }}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.title}</span>
            </a>
          ))}
        </nav>}
        <div className="topbar-actions">
          <div className="system-status">
            {auth.user && <span className={`frontend-status ${realtime.status !== 'connected' ? 'is-disconnected' : ''}`}><i /> Realtime: {realtime.status}</span>}
            <span className="frontend-status"><i /> Frontend: Online</span>
            <span className={`frontend-status ${backend?.database === 'connected' ? '' : 'is-disconnected'}`}><i /> Database: {backend?.database ?? (connectionError ? 'Offline' : 'Connecting')}</span>
          </div>
          {auth.user && <span className="profile-chip" title={auth.user.username}>{auth.user.displayName.slice(0, 1).toUpperCase()}</span>}
        </div>
      </header>
      {auth.user && <nav className="mobile-nav" aria-label="Mobile navigation">
        {protectedPages.map((item) => <a className={`nav-link${route === item.path ? ' nav-link--active' : ''}`} href={item.path} key={item.path} onClick={(event) => { event.preventDefault(); navigate(item.path); }}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.title}</span></a>)}
      </nav>}
      <main className="main-content">
        <section className="page-content">
          {page !== 'Login' && page !== 'Register' && page !== 'Home' && route !== '/chat' && <p className="eyebrow">YOUR LOCAL NETWORK</p>}
          {pageContent}
          {auth.user && route !== '/' && <button className="secondary-button page-logout" onClick={() => void handleLogout()} type="button">Log out</button>}
        </section>
      </main>
    </div>
  );
}
