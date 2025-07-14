import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { changePassword } from '../api';
import { useAuth } from '../AuthContext';
import '../App.css';

const ChangePassword = () => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate(); // Initialize navigate

  // Autofill username and email from auth user on mount
  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        username: user.username || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (form.newPassword !== form.confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }
    const res = await changePassword(form);
    if (res.success || res.message === 'Password changed successfully.') {
      setMessage('Password changed successfully.');
      // Clear any authentication tokens or user data here if needed
      setTimeout(() => {
        // Example: localStorage.removeItem('token');
        navigate('/');
      }, 1500); // Show message for 1.5 seconds before redirect
    } else {
      setError(res.message || 'Failed to change password');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-box">
          <h1 className="welcome-heading">Change Password</h1>
          <form onSubmit={handleSubmit}>
            <div className="login-form">
              <input
                type="text"
                className="login-input"
                name="username"
                placeholder="Username"
                value={form.username}
                readOnly
                required
              />
              <input
                type="email"
                className="login-input"
                name="email"
                placeholder="Email"
                value={form.email}
                readOnly
                // no onChange for readOnly
                required
              />
              <input
                type="password"
                className="login-input"
                name="password"
                placeholder="Current Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <input
                type="password"
                className="login-input"
                name="newPassword"
                placeholder="New Password"
                value={form.newPassword}
                onChange={handleChange}
                required
              />
              <input
                type="password"
                className="login-input"
                name="confirmNewPassword"
                placeholder="Confirm New Password"
                value={form.confirmNewPassword}
                onChange={handleChange}
                required
              />
              <button type="submit" className="home-btn">Change Password</button>
            </div>
            {message && <p className="login-success">{message}</p>}
            {error && <p className="login-error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;