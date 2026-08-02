import { ConnectButton } from '@rainbow-me/rainbowkit';
import { BookOpen, Braces, Fingerprint, Grid3X3, Home, TrendingUp } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ApiPage } from './pages/ApiPage';
import { CanvasPage } from './pages/CanvasPage';
import { DocsPage } from './pages/DocsPage';
import { HomePage } from './pages/HomePage';

const navItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/agent', label: 'Agent', icon: Fingerprint, disabled: true },
  { to: '/trading', label: 'Trading', icon: TrendingUp, disabled: true },
  { to: '/canvas', label: 'Canvas', icon: Grid3X3 },
  { to: '/docs', label: 'Docs', icon: BookOpen },
  { to: '/api', label: 'API', icon: Braces },
];

export function App() {
  return (
    <div className="app-shell">
      <Header />
      <RouteRail />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/agent" element={<Navigate to="/" replace />} />
          <Route path="/trading" element={<Navigate to="/" replace />} />
          <Route path="/canvas" element={<CanvasPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="site-header">
      <NavLink className="brand-mark" to="/" aria-label="Loxleys home">
        <strong>Loxleys</strong>
        <small>RH / 4663</small>
      </NavLink>

      <nav className="desktop-nav" aria-label="Primary">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <span className="nav-button nav-button-disabled" aria-disabled="true" title="Coming after mint" key={item.to}>
                <Icon size={16} />
                {item.label}
                <small>Coming soon</small>
              </span>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-button active' : 'nav-button')}
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
    </header>
  );
}

export function RouteRail() {
  return (
    <nav className="tab-rail" aria-label="Sections">
      {navItems.map((item) => {
        const Icon = item.icon;
        if (item.disabled) {
          return (
            <span className="tab-button tab-button-disabled" aria-disabled="true" key={item.to}>
              <Icon size={18} />
              {item.label}
              <small>Soon</small>
            </span>
          );
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'tab-button active' : 'tab-button')}
          >
            <Icon size={18} />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
