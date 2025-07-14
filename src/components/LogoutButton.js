import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import '../App.css'; // Assuming you have some styles defined in App.css

const Navbar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/');
  };
  return (
    <nav style={{
      height: 50,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
     
      top: 0,
      left: 0,
      zIndex: 100
    }}>
      <div style={{ fontWeight: 600, fontSize: 20,  marginRight: '20px'}}>
        {user ? `Welcome ${user.username}` : 'Welcome'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="home-btn" onClick={() => navigate('/home')}>
          Home
        </button>
        <button
          style={{
            position: 'fixed',
            top: 10,
            right: 10,
            zIndex: 1000,
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onClick={handleLogout}
        >
          Log Out
        </button>
      </div>
    </nav>
  );
};

export default Navbar;