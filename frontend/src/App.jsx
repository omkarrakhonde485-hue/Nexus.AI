import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '1rem 2rem', background: '#1e293b', display: 'flex', gap: '1rem', borderBottom: '1px solid #334155' }}>
        <Link to="/" style={{ color: '#f8fafc', textDecoration: 'none', fontWeight: 'bold' }}>Home</Link>
        <Link to="/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>Login</Link>
        <Link to="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none' }}>Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
