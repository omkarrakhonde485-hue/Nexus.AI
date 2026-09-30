// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';

function NavigationBar() {
  const { session, profile, signOut } = useAuth();

  return (
    <nav style={{ padding: '1rem 2rem', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <Link to="/" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem' }}>NEXUS AI</Link>
        <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Home</Link>
        {session && <Link to="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none' }}>Dashboard</Link>}
      </div>

      <div>
        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
              {profile?.fullName} ({profile?.role})
            </span>
            <button
              onClick={signOut}
              style={{ padding: '0.4rem 0.8rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            style={{ padding: '0.4rem 1rem', background: '#0284c7', color: '#fff', textDecoration: 'none', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavigationBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
