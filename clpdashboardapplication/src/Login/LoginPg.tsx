import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * By: Grant Harsch
 * Super simple login page that is really just made for demo purposes. 
 */
const LoginPg: React.FC = () => {

  const API_BASE = '/api';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSignupMode, setIsSignupMode] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API_BASE}/login`, {
        username: username.trim(),
        password: password.trim(),
      });

      if (!response.data || !response.data.success) {
        setError(response.data?.message || 'Invalid credentials');
        return;
      }

      localStorage.setItem('userId', String(response.data.userId));
      const userRole = response.data.role;
      if (userRole === 'student') navigate('/studentdash');
      else if (userRole === 'professor') navigate('/professordash');
      else if (userRole === 'admin') navigate('/admindash');
      else setError('Unknown role returned from server');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Network or server error. Make sure mock server is running.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await axios.post(`${API_BASE}/signup`, {
        username: username.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
      });

      setMessage(response.data?.message || 'Signup request submitted. Admin will assign your role.');
      setUsername('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>{isSignupMode ? 'Sign Up' : 'Login'}</h2>
      <form onSubmit={isSignupMode ? handleSignup : handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        {isSignupMode && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: '100%', padding: 8 }}
              required
            />
          </div>
        )}
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {message && <div style={{ color: '#155724', backgroundColor: '#d4edda', padding: 12, borderRadius: 4, marginBottom: 12 }}>{message}</div>}
        <button type="submit" style={{ width: '100%', padding: 10, backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: 4 }}>
          {isSignupMode ? 'Request Signup' : 'Login'}
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 14, color: '#444' }}>
        <button
          type="button"
          onClick={() => {
            setIsSignupMode(!isSignupMode);
            setError('');
            setMessage('');
          }}
          style={{ background: 'none', border: 'none', color: '#007bff', padding: 0, cursor: 'pointer' }}
        >
          {isSignupMode ? 'Already have an account? Login' : 'Need an account? Sign up'}
        </button>
      </div>

      {!isSignupMode && (
        <div style={{ marginTop: 24, fontSize: 12, color: '#888' }}>
          <div>Test accounts:</div>
          <div>Student: student / password</div>
          <div>Professor: professor / password</div>
          <div>Admin: admin / password</div>
        </div>
      )}
      {isSignupMode && (
        <div style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
          After requesting signup, an admin must approve and assign you one of: student, professor, or admin.
        </div>
      )}
    </div>
  );
};
export default LoginPg;