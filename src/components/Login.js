import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginEmployee } from '../api';
import { useAuth } from '../AuthContext';
import '../App.css';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    console.log("Login component mounted");
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting login form", formData);
    try {
      const res = await loginEmployee(formData);
      console.log("API response:", res);

      if (res.success) {
        setUser(res.data.user); // Store only the user object, not the wrapper
        navigate('/home', { state: { user: res.data.user } });
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-box">
          <h1 className="welcome-heading">Login</h1>
          <form onSubmit={handleSubmit}>
            <div className="login-form">
              <input
                type="text"
                className="login-input"
                id="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
              />
              <input
                type="password"
                className="login-input"
                id="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
              <button type="submit" className="home-btn">Login</button>
            </div>
            {error && <p className="login-error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
