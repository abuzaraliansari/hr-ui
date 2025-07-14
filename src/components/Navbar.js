import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Navbar = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Don't show nav links if not authenticated or on login page
  if (!user || location.pathname === '/') {
    return (
      <header className="navbar-header navbar-header-simple">
        <div className="navbar-logo-container">
          <img src="https://www.intmavens.com/wp-content/uploads/2022/09/logo-300x180.png" alt="IntMavens Logo" className="navbar-logo" />
        <span className="navbar-title">IntMavens</span>
      </div>
      <div className="navbar-center-title">
        <span className="navbar-center-text">Timesheet Management</span>
      </div>
      </header>
    );
  }

  return (
    <header className="navbar-header">
      <div className="navbar-logo-container">
        <img src="https://www.intmavens.com/wp-content/uploads/2022/09/logo-300x180.png" alt="IntMavens Logo" className="navbar-logo" />
        <span className="navbar-title">IntMavens</span>
      </div>
      <div className="navbar-center-title">
        <span className="navbar-center-text">Timesheet Management</span>
      </div>
      <button
        className="navbar-toggle"
        type="button"
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        onClick={() => setNavOpen(o => !o)}
      >
        {navOpen ? '-' : '+'}
      </button>
      <nav>
        <ul className={`navbar-links${navOpen ? ' open' : ''}`}>
          {/* Hide Home link on /home */}
          {location.pathname !== '/home' && (
            <li><Link to="/home" className="navbar-link" onClick={() => setNavOpen(false)}>Home</Link></li>
          )}
          <li>
            <Link to="/ViewTimesheetentries" className="navbar-link" onClick={() => setNavOpen(false)}>
              View Timesheet
            </Link>
          </li>
          <li>
            <Link to="/TimesheetEntry" className="navbar-link" onClick={() => setNavOpen(false)}>
              Timesheet Entry
            </Link>
          </li>
          {/* <li><Link to="/add-timesheet" className="navbar-link">Add Entry</Link></li> */}
          <li>
            <Link to="/password" className="navbar-link" onClick={() => setNavOpen(false)}>
              Password
            </Link>
          </li>
          {user?.roles?.[0]?.roleName !== 'user' && (
            <li>
              <Link to="/ApproveTimesheet" className="navbar-link" onClick={() => setNavOpen(false)}>
                Approve TimeSheet Entry
              </Link>
            </li>
          )}
          {user?.roles?.[0]?.roleName !== 'user' && (
             <li>
              <Link to="/managerTimesheet" className="navbar-link" onClick={() => setNavOpen(false)}>
                Approve On Behalf
              </Link>
            </li>
            
          )}
          <li>
            <button
              onClick={() => {
                setNavOpen(false);
                handleLogout();
              }}
              className="logout-btn"
              type="button"
            >
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Navbar;