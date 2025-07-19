import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Navbar = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // NEW

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  // Don't show nav links if not authenticated or on login page
  if (!user || location.pathname === '/') {
    return (
      <header className="navbar-header navbar-header-simple" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div className="navbar-logo-container" style={{ minWidth: 220, display: 'flex', alignItems: 'center' }}>
          <img src="https://www.intmavens.com/wp-content/uploads/2022/09/logo-300x180.png" alt="IntMavens Logo" className="navbar-logo" />
          <span className="navbar-title">IntMavens</span>
        </div>
        <div className="navbar-center-title" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
          <span className="navbar-center-text" style={{ fontWeight: 600, fontSize: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Timesheet Management</span>
        </div>
        {/* Username display for not logged in */}
        <div style={{ minWidth: 220, textAlign: 'right', color: '#555', fontWeight: 500 }}>
          {user ? `Logged in as: ${user.username || user.name || user.email || ''}` : 'Not logged in'}
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
          {location.pathname !== '/home' && (
            <li><Link to="/home" className="navbar-link" onClick={() => setNavOpen(false)}>Home</Link></li>
          )}

          {/* Timesheet Dropdown */}
          <li
            className="navbar-dropdown"
            onMouseEnter={() => setOpenDropdown('timesheet')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              className="navbar-link navbar-dropdown-btn"
              onClick={() => setOpenDropdown(openDropdown === 'timesheet' ? null : 'timesheet')}
              type="button"
            >
              Timesheet
            </button>
            <ul className={`navbar-dropdown-menu${openDropdown === 'timesheet' ? ' show' : ''}`}>
              <li>
                <Link to="/TimesheetEntry" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                  Timesheet Entry
                </Link>
              </li>
              <li>
                <Link to="/ViewTimesheetentries" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                  View Timesheet
                </Link>
              </li>
              
            </ul>
          </li>

          {/* Approve Dropdown */}
          <li
            className="navbar-dropdown"
            onMouseEnter={() => setOpenDropdown('approve')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              className="navbar-link navbar-dropdown-btn"
              onClick={() => setOpenDropdown(openDropdown === 'approve' ? null : 'approve')}
              type="button"
            >
              Approve
            </button>
            <ul className={`navbar-dropdown-menu${openDropdown === 'approve' ? ' show' : ''}`}>
              {user?.roles?.[0]?.roleName !== 'user' && (
                <li>
                  <Link to="/ApproveTimesheet" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                    Approve TimeSheet Entry
                  </Link>
                </li>
              )}
              {(user?.EmployeeID === 24 || user?.EmployeeID === 25 || user?.EmployeeID === 26) && (
                <li>
                  <Link to="/managerTimesheet" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                    Approve On Behalf
                  </Link>
                </li>
              )}
            </ul>
          </li>

          {/* User Management Dropdown */}
          <li
            className="navbar-dropdown"
            onMouseEnter={() => setOpenDropdown('userManagement')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              className="navbar-link navbar-dropdown-btn"
              onClick={() => setOpenDropdown(openDropdown === 'userManagement' ? null : 'userManagement')}
              type="button"
            >
               welcome: {user?.username || user?.name || user?.email || ''}
            </button>
            <ul className={`navbar-dropdown-menu${openDropdown === 'userManagement' ? ' show' : ''}`}>
              <li>
                <Link to="/userdetails" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                  User Details
                </Link>
              </li>
              <li>
                <Link to="/adduser" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                  Add User
                </Link>
              </li>
              <li>
                <Link to="/password" className="navbar-link" onClick={() => { setNavOpen(false); setOpenDropdown(null); }}>
                  Change Password
                </Link>
              </li>
            </ul>
          </li>

          {/* Username above logout */}
          <li style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',justifyContent:'center', minWidth: 180, marginLeft: 12 }}>
            <span style={{ color: '#36aaff', fontWeight: 600, fontSize: '1.1rem', marginBottom: 2, letterSpacing: 0.5 }}>
             
            </span>
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
      <style>{`
        .navbar-dropdown {
          position: relative;
        }
        .navbar-dropdown-btn {
          background: none;
          border: none;
          color: inherit;
          font: inherit;
          cursor: pointer;
          padding: 0.5rem 1rem;
        }
        .navbar-dropdown-menu {
          display: none;
          position: absolute;
          left: 0;
          top: 100%;
          background: #fff;
          min-width: 180px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 100;
          padding: 0.5rem 0;
          border-radius: 4px;
        }
        .navbar-dropdown-menu.show {
          display: block;
        }
        .navbar-dropdown-menu li {
          list-style: none;
        }
        .navbar-dropdown-menu .navbar-link {
          display: block;
          padding: 0.5rem 1.2rem;
          color: #333;
          text-decoration: none;
        }
        .navbar-dropdown-menu .navbar-link:hover {
          background: #f0f0f0;
        }
        @media (max-width: 900px) {
          .navbar-dropdown-menu {
            position: static;
            box-shadow: none;
            background: none;
            min-width: 0;
            padding: 0;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;