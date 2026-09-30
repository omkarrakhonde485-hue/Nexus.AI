// frontend/src/pages/DashboardPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import RoleGuard from '../components/RoleGuard';

export default function DashboardPage() {
  const { user, profile, permissions, session, signOut } = useAuth();
  const [testResult, setTestResult] = useState(null);
  const [loadingTest, setLoadingTest] = useState(false);

  const runAuthTest = async (endpoint) => {
    setLoadingTest(true);
    setTestResult(null);

    try {
      const response = await apiClient.get(endpoint, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      setTestResult({ status: response.status, data: response.data });
    } catch (err) {
      setTestResult({
        status: err.response?.status || 500,
        error: err.response?.data?.error || { code: 'CLIENT_ERROR', message: err.message },
      });
    } finally {
      setLoadingTest(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header Banner */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0, color: '#38bdf8' }}>NEXUS Operations Command Center</h1>
          <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0' }}>Role-Based Access & Identity Management (Block 3)</p>
        </div>
        <button
          onClick={signOut}
          style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Sign Out
        </button>
      </header>

      {/* Profile Overview Card */}
      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: '#f8fafc' }}>Authenticated Identity Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Full Name</span>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{profile?.fullName || 'User'}</div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Email Address</span>
            <div style={{ color: '#cbd5e1' }}>{user?.email}</div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>System Role</span>
            <div>
              <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: '#0284c7', color: '#fff', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {profile?.role}
              </span>
            </div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Department</span>
            <div style={{ color: '#cbd5e1' }}>{profile?.department || 'N/A'}</div>
          </div>
        </div>
      </section>

      {/* Permissions Matrix */}
      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: '#f8fafc' }}>Granted Permission Tokens ({permissions.length})</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
          {permissions.map((p) => (
            <span key={p} style={{ padding: '0.25rem 0.5rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', fontSize: '0.75rem', color: '#38bdf8', fontFamily: 'monospace' }}>
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* Backend Authorization Proof Interactive Panel */}
      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: '#f8fafc' }}>⚡ Backend Authorization Test Suite</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Test backend token verification & permission enforcement. Click buttons below to invoke live backend endpoints using your current Bearer token.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => runAuthTest('/api/auth/me')}
            disabled={loadingTest}
            style={{ padding: '0.75rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            1. Test GET /api/auth/me (All Auth Users)
          </button>

          <button
            onClick={() => runAuthTest('/api/auth/admin-only-test')}
            disabled={loadingTest}
            style={{ padding: '0.75rem 1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            2. Test Admin Endpoint (Requires admin.users.manage)
          </button>
        </div>

        {testResult && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#0f172a', borderRadius: '6px', border: `1px solid ${testResult.status === 200 ? '#16a34a' : '#dc2626'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 'bold', color: testResult.status === 200 ? '#4ade80' : '#f87171' }}>
                HTTP Status: {testResult.status} {testResult.status === 200 ? 'SUCCESS' : testResult.status === 403 ? 'FORBIDDEN (PROVEN)' : 'ERROR'}
              </span>
            </div>
            <pre style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(testResult.data || testResult.error, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Role Guarded Component Preview */}
      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px', border: '1px solid #334155' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem', color: '#f8fafc' }}>Role Guarded UI Section</h2>
        <RoleGuard allowedRoles={['admin', 'manager']}>
          <div style={{ padding: '1rem', background: '#064e3b', border: '1px solid #047857', borderRadius: '6px', color: '#a7f3d0' }}>
            <strong>Manager/Admin Exclusive Control Panel: </strong>
            You are viewing this panel because your identity is authorized as a Manager or Admin.
          </div>
        </RoleGuard>
      </section>
    </div>
  );
}
