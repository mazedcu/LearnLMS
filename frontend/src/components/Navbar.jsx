import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, LayoutDashboard, User } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const dashboardPath = user ? {
    student: '/dashboard/student',
    instructor: '/dashboard/instructor',
    admin: '/dashboard/admin',
    manager: '/dashboard/manager',
  }[user.role] || '/dashboard/student' : '/login';

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <BookOpen size={24} color="var(--clr-primary)" style={{ marginRight: '0.25rem' }} />
          Learnwith<span>Hasan</span>
        </Link>

        <div className="navbar-nav">
          <Link to="/" className={`nav-link ${isActive('/')}`}>Courses</Link>

          {user ? (
            <>
              <Link to={dashboardPath} className={`nav-link ${isActive(dashboardPath)}`} title="Dashboard">
                <LayoutDashboard size={18} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                Dashboard
              </Link>
              <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login')}`}>Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm" style={{ padding: '0.5rem 1.25rem' }}>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
