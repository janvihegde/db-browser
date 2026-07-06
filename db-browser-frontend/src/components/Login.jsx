import React, { useState } from 'react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { email, password });
            onLoginSuccess(res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1e1e' }}>
            <form onSubmit={handleLogin} style={{ padding: '40px', backgroundColor: '#2d2d2d', borderRadius: '8px', color: 'white', width: '300px' }}>
                <h2>DB Browser Login</h2>
                {error && <div style={{ color: '#ff4d4f', marginBottom: '10px' }}>{error}</div>}
                <div style={{ marginBottom: '15px' }}>
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }} required />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }} required />
                </div>
                <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#1890ff', color: 'white', border: 'none', cursor: 'pointer' }}>Login</button>
            </form>
        </div>
    );
}