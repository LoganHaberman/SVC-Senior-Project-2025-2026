import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

/**
 * By: Grant Harsch
 * Super simple login page that is really just made for demo purposes. 
 */
const LoginPg: React.FC = () => {

  // Typing basic login variables
    const API_BASE = 'http://localhost:5000' // Not entirely needed but makes calling API endpoints easier
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  // Send the user and pass to the server for verification
  const testResponse = await axios.get(`${API_BASE}/users`);
  console.log('Users from server:', testResponse.data);

  try {
    console.log('Attempting login with:', { username, password });  
    const response = await axios.get(`${API_BASE}/login`, {
      params: {
        username: username.trim(),
        password: password.trim()
      }
    })

      .catch(error => {
        console.error('Error during login:', error);
        throw error; // Rethrow to be caught in the outer catch block
      }
    );
    console.log(response);
    console.log(response.data.user.role);
    // Depending on what the server tells us about the role of the user, navigate to the correct dashboard
    const data = response
    console.log(data);
    // Store userId in localStorage for use in other pages
    localStorage.setItem('userId', data.data.userId);
    const userRole = data.data.user.role;
    console.log(userRole);
    if (userRole === 'student') navigate('/studentdash');
    else if (userRole === 'professor') navigate('/professordash');
    else if (userRole === 'admin') navigate('/admindash');
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