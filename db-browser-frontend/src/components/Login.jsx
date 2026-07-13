import React, { useState } from 'react';
import api from '../services/api';

export default function Login({ onLoginSuccess }) {
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setPassword('');
        setConfirmPassword('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            onLoginSuccess(res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post('/auth/signup', { email, password });
            onLoginSuccess(res.data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Signup failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isSignup = mode === 'signup';

    return (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1e1e' }}>
            <form onSubmit={isSignup ? handleSignup : handleLogin} style={{ padding: '40px', backgroundColor: '#2d2d2d', borderRadius: '8px', color: 'white', width: '320px' }}>
                <h2 style={{ marginTop: 0 }}>{isSignup ? 'Create Account' : 'DB Browser Login'}</h2>

                {error && <div style={{ color: '#ff4d4f', marginBottom: '15px', fontSize: '0.9rem' }}>{error}</div>}

                <div style={{ marginBottom: '15px' }}>
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }} required />
                </div>

                <div style={{ marginBottom: isSignup ? '15px' : '20px' }}>
                    <label>Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }} required minLength={isSignup ? 8 : undefined} />
                    {isSignup && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>At least 8 characters</div>}
                </div>

                {isSignup && (
                    <div style={{ marginBottom: '20px' }}>
                        <label>Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', boxSizing: 'border-box' }} required />
                    </div>
                )}

                <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '10px', backgroundColor: '#1890ff', color: 'white', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', borderRadius: '4px' }}>
                    {isSubmitting ? (isSignup ? 'Creating account...' : 'Logging in...') : (isSignup ? 'Create Account' : 'Login')}
                </button>

                <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.85rem', color: '#999' }}>
                    {isSignup ? (
                        <>Already have an account?{' '}
                            <span onClick={() => switchMode('login')} style={{ color: '#1890ff', cursor: 'pointer' }}>Log in</span>
                        </>
                    ) : (
                        <>New here?{' '}
                            <span onClick={() => switchMode('signup')} style={{ color: '#1890ff', cursor: 'pointer' }}>Create an account</span>
                        </>
                    )}
                </div>
            </form>
        </div>
    );
}
