import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isWidePage = location.pathname.startsWith('/screener');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('auth_code');
    if (!code || location.pathname === '/fyers') return;
    navigate(`/fyers?auth_code=${encodeURIComponent(code)}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className={`app${isWidePage ? ' app-wide' : ''}`}>
      <nav className="app-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Straddle Tracker
        </NavLink>
        <NavLink to="/kotak" className={({ isActive }) => (isActive ? 'active' : '')}>
          Kotak Neo
        </NavLink>
        <NavLink to="/fyers" className={({ isActive }) => (isActive ? 'active' : '')}>
          Fyers
        </NavLink>
        <NavLink to="/screener" className={({ isActive }) => (isActive ? 'active' : '')}>
          Stock Screener
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
