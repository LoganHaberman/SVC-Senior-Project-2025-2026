import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const mockUsers = [
    { username: 'student', password: 'student123', role: 'student' },
    { username: 'prof', password: 'prof123', role: 'professor' },
    { username: 'admin', password: 'admin123', role: 'admin' }
];

const LoginPg: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const loginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const user = mockUsers.find(
            (u) => u.username === username && u.password === password
        );
        if (user) {
            if (user.role === 'student') navigate('/studentdash');
            else if (user.role === 'professor') navigate('/professordash');
            else if (user.role === 'admin') navigate('/admindash');
        } else {
            setError('Invalid credentials.');
        }
    };

    return (
        <div style={{ maxWidth: 350, margin: '60px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
            <h2>Login</h2>
            <form onSubmit={loginSubmit}>
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
                <button type="submit" style={{ width: '100%', padding: 8 }}>Login</button>
            </form>
            <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                <div>Try these credentials:</div>
                <div>Student: student / student123</div>
                <div>Professor: prof / prof123</div>
                <div>Admin: admin / admin123</div>
            </div>
        </div>
    );
};
export default LoginPg;