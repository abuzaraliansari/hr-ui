// components/Auth.js - Frontend only (NOT RECOMMENDED)
import React from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Auth = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  
  const CLIENT_ID = "211073160040-okr7hnvv38h60rb6vh4bm1srm0plpjc6.apps.googleusercontent.com";

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    try {
      // Parse the JWT token (INSECURE - anyone can create fake tokens)
      const userInfo = parseJwt(credentialResponse.credential);

      // Print the decoded user info to the console
      console.log('Google Authenticated User:', userInfo);

      const user = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        authMethod: 'google'
      };

      setUser(user);
      if (onLoginSuccess) onLoginSuccess(user);
      navigate('/home');

    } catch (err) {
      console.error('Google authentication error:', err);
      alert('Google authentication error: ' + err.message);
    }
  };

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div>
        <h2>Sign in with Google</h2>
        <GoogleLogin
          onSuccess={handleGoogleLogin}
          onError={(error) => {
            console.error('Login Failed:', error);
            alert('Login Failed: Please try again');
          }}
        />
      </div>
    </GoogleOAuthProvider>
  );
};

export default Auth;
