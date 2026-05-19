import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  return (
    <div className="app">
      <nav className="app-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Straddle Tracker
        </NavLink>
        <NavLink to="/kotak" className={({ isActive }) => (isActive ? 'active' : '')}>
          Kotak Neo
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
