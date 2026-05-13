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
          Learn<span>LMS</span>
        </Link>

        <div className="navbar-nav">
          <Link to="/" className={`nav-link ${isActive('/')}`}>Courses</Link>

          {user ? (
            <>
              <Link to={dashboardPath} className="nav-link" title="Dashboard">
                <LayoutDashboard size={16} style={{ verticalAlign: 'middle' }} />
                {' '}Dashboard
              </Link>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
