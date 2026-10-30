import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, LayoutDashboard, Menu, X, Smartphone } from 'lucide-react';
import { apkAvailable, openGetApp } from './getApp';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasApp, setHasApp] = useState(false);
  useEffect(() => { apkAvailable().then(setHasApp); }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); };

  const dashboardPath = user ? {
    student: '/dashboard/student',
    instructor: '/dashboard/instructor',
    admin: '/dashboard/admin',
    manager: '/dashboard/manager',
  }[user.role] || '/dashboard/student' : '/login';

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar" style={scrolled ? { boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } : {}}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <BookOpen size={22} color="var(--clr-primary)" />
          Learnwith<span>Hasan</span>
        </Link>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', padding: '0.5rem', color: 'var(--clr-heading)' }}
          className="mobile-menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`navbar-nav${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
          <Link to="/" className={`nav-link ${isActive('/')}`}>Courses</Link>
          {hasApp && (
            <button type="button" className="nav-link" onClick={openGetApp} style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer' }}>
              <Smartphone size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
              Get app
            </button>
          )}

          {user ? (
            <>
              <Link to={dashboardPath} className={`nav-link ${isActive(dashboardPath)}`} title="Dashboard">
                <LayoutDashboard size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                Dashboard
              </Link>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login')}`}>Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
