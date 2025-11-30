import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPg: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  try {
    const res = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password.trim() }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.message || 'Login failed');
      return;
    }

    const data = await res.json();
    if (data.role === 'student') navigate('/studentdash');
    else if (data.role === 'professor') navigate('/professordash');
    else if (data.role === 'admin') navigate('/admindash');
  } catch (err) {
    setError('Network or server error. Make sure mock server is running on port 3001.');
  }
    };

    return (
        <div style={{ maxWidth: 350, margin: '60px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
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
                <div>Professor: prof / password</div>
                <div>Admin: admin / password</div>
            </div>
        </div>
    );
};
export default LoginPg;