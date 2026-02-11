import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * By: Grant Harsch
 * Date: 11/20/2025 -> 11/25/2025
 * Super simple login page that is really just made for demo purposes. 
 */
const LoginPg: React.FC = () => {

  // Typing basic login variables
    const API_BASE = 'http://localhost:3001/api' // Not entirely needed but makes calling API endpoints easier
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  // Send the user and pass to the mock server for verification
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password.trim() }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.message || 'Login failed');
      return;
    }

    // Depending on what the server tells us about the role of the user, navigate to the correct dashboard
    const data = await res.json();
    // Store userId in localStorage for use in other pages
    localStorage.setItem('userId', data.userId);
    if (data.role === 'student') navigate('/studentdash');
    else if (data.role === 'professor') navigate('/professordash');
    else if (data.role === 'admin') navigate('/admindash');
  } catch (err) {
    setError('Network or server error. Make sure mock server is running on port 3001.');
  }
    };

    // The actual login form that the user sees.
    return (
        <div style={{ maxWidth: 350, margin: '60px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
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
                {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
                <button type="submit" style={{ width: '100%', padding: 8 }} disabled={false}>Login</button>
            </form>
            <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                <div>Try these credentials:</div>
                <div>Student: student / password</div>
                <div>Professor: professor / password</div>
                <div>Admin: admin / password</div>
            </div>
        </div>
    );
};
export default LoginPg;