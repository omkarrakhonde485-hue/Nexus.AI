// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DEMO_ACCOUNTS = [
  { name: 'Aarav Sharma', email: 'aarav@nexusai.internal', role: 'admin', dept: 'Admin' },
  { name: 'Priya Patel', email: 'priya@nexusai.internal', role: 'manager', dept: 'Engineering' },
  { name: 'Neha Gupta', email: 'neha@nexusai.internal', role: 'finance', dept: 'Finance' },
  { name: 'Ananya Desai', email: 'ananya@nexusai.internal', role: 'hr', dept: 'HR' },
  { name: 'Vikram Singh', email: 'vikram@nexusai.internal', role: 'it', dept: 'IT' },
  { name: 'Rohan Verma', email: 'rohan@nexusai.internal', role: 'procurement', dept: 'Procurement' },
  { name: 'Omkar Dev', email: 'omkar@nexusai.internal', role: 'employee', dept: 'Engineering' },
  { name: 'Rahul Rao', email: 'rahul@nexusai.internal', role: 'employee', dept: 'Engineering' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('NexusDemo2026!');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e, demoEmail = null) => {
    if (e) e.preventDefault();
    const loginEmail = demoEmail || email;
    setErrorMsg('');
    setLoading(true);

    try {
      await signIn(loginEmail, password);
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '650px', margin: '2rem auto' }}>
      <header style={{ textCenter: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#38bdf8', margin: 0 }}>NEXUS AI Control Center</h1>
        <p style={{ color: '#94a3b8', margin: '0.5rem 0' }}>Select a Demo Identity or Sign In with credentials</p>
      </header>

      {errorMsg && (
        <div style={{ padding: '0.75rem', background: '#7f1d1d', color: '#fca5a5', borderRadius: '6px', marginBottom: '1.5rem' }}>
          {errorMsg}
        </div>
      )}

      {/* 1-Click Demo Identity Selector */}
      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc', fontSize: '1rem' }}>⚡ 1-Click Demo Identities (Block 3)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(acc.email);
                handleLogin(null, acc.email);
              }}
              style={{
                textAlign: 'left',
                padding: '0.75rem',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{acc.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.25rem' }}>
                Role: {acc.role.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{acc.dept}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Manual Email / Password Form */}
      <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
        <h3 style={{ marginTop: 0, color: '#f8fafc' }}>Manual Authentication</h3>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. omkar@nexusai.internal"
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '0.75rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? 'Authenticating...' : 'Sign In to NEXUS'}
        </button>
      </form>
    </div>
  );
}
