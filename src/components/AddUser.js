import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addUser } from '../api';
import '../App.css';

const AddUser = () => {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!form.username || !form.email || !form.password) {
      setError('All fields are required.');
      return;
    }
    const res = await addUser(form);
    if (res.success) {
      setMessage('User added successfully.');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } else {
      setError(res.message || 'Failed to add user');
    }
  };

  return (
    <div className="login-wrapper" style={{ overflow: 'hidden', height: '100vh' }}>
      <div className="login-container">
        <div className="login-box">
          <h1 className="welcome-heading">Add New User</h1>
          <form onSubmit={handleSubmit}>
            <div className="login-form">
              <input
                type="text"
                className="login-input"
                name="username"
                placeholder="Username"
                value={form.username}
                onChange={handleChange}
                required
              />
              <input
                type="email"
                className="login-input"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                required
              />
              
              <input
                type="password"
                className="login-input"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button type="submit" className="home-btn">Add User</button>
            </div>
            {message && <p className="login-success">{message}</p>}
            {error && <p className="login-error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddUser;
