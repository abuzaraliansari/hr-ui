import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginEmployee, forgotPassword } from '../api'; // import the new API
import { useAuth } from '../AuthContext';
import '../App.css';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [error, setError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false); // toggle state
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    console.log("Login component mounted");
  }, []);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  // ...existing code...
const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setMessage('');
  if (isForgotPassword) {
    try {
      const res = await forgotPassword({ email: formData.email });
      if (res.success) {
        setMessage('Password reset email sent successfully.');
      } else {
        setError(res.message || 'Failed to send email.');
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Something went wrong. Please try again.");
    }
  } else {
    // If scrap user, skip API and go to scrapper page
    if (
      formData.username.trim().toLowerCase() === 'scrap' &&
      formData.password === '1234'
    ) {
      navigate('/scrapper');
      return;
    }
    try {
      const res = await loginEmployee(formData);
      if (res.success) {
        setUser(res.data.user);
        console.log("Login successful. User data:", res.data.user);
        navigate('/home', { state: { user: res.data.user } });
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    }
  }
};
// ...existing code...

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-box">
          {isForgotPassword ? (
            <>
              <h1 className="welcome-heading">Forget Password</h1>
              <form onSubmit={handleSubmit}>
                <div className="login-form">
                  <input
                    type="email"
                    className="login-input"
                    id="email"
                    placeholder="Enter your registered email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  <button type="submit" className="home-btn">Send Mail</button>
                </div>
                {message && <p className="success-message">{message}</p>}
                {error && <p className="login-error">{error}</p>}
              </form>
              <p onClick={() => setIsForgotPassword(false)} className="login-link">Back</p>
            </>
          ) : (
            <>
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
              <p onClick={() => setIsForgotPassword(true)} className="login-link">Forgot Password?</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
