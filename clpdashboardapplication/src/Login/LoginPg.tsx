import React, { useState } from 'react';
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
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      if (userRole === 'student') navigate('/facilitatordash');
      else if (userRole === 'professor') navigate('/professordash');
      else if (userRole === 'admin') navigate('/admindash');
      else setError('Unknown role returned from server');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Network or server error. Make sure mock server is running.');
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      <div style={{ width: '100%', marginBottom: 20 }}>
        <div style={{ backgroundColor: '#0b5d3b', color: 'white', padding: '12px 20px', fontWeight: 700 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Collaborative Learning Program</span>
            <span style={{ fontWeight: 600, opacity: 0.95 }}>Login</span>
          </div>
        </div>
        <div style={{ backgroundColor: '#c9a227', height: 8 }} />
      </div>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 20px 40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        margin: '0 auto',
        padding: 28,
        border: '1px solid #dfe3e8',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        boxShadow: '0 8px 24px rgba(16, 24, 40, 0.08)'
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 24, color: '#102a43' }}>Welcome Back</h2>
        <p style={{ margin: '0 0 20px 0', color: '#627d98', fontSize: 14 }}>
          Sign in to continue to your dashboard.
        </p>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#334e68', marginBottom: 6 }}>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #cbd2d9',
                borderRadius: 6,
                fontSize: 14
              }}
              required
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#334e68', marginBottom: 6 }}>Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '1px solid #cbd2d9',
                borderRadius: 6,
                fontSize: 14
              }}
              required
            />
          </div>
          {error && (
            <div style={{
              color: '#b42318',
              backgroundColor: '#fdecea',
              border: '1px solid #f7c9c4',
              borderRadius: 6,
              padding: 10,
              marginBottom: 12,
              fontSize: 13
            }}>
              {error}
            </div>
          )}
          <button type="submit" style={{
            width: '100%',
            padding: 11,
            backgroundColor: '#0b5d3b',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            Login
          </button>
        </form>
        <div style={{ marginTop: 22, fontSize: 12, color: '#7b8794', borderTop: '1px solid #e4e7eb', paddingTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#486581' }}>Test accounts</div>
          <div>Facilitator: student / password</div>
          <div>Professor: professor / password</div>
          <div>Admin: admin / password</div>
        </div>
      </div>
      </div>
    </div>
  );
};
export default LoginPg;