import React, { useEffect, useState } from 'react';
import { getHealth, getDatabaseHealth, getAiHealth } from '../services/api';

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [aiHealth, setAiHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConnectivity() {
      try {
        setLoading(true);
        const [healthRes, dbRes, aiRes] = await Promise.all([
          getHealth().catch((err) => ({ success: false, error: { message: err.message } })),
          getDatabaseHealth().catch((err) => ({ success: false, error: { message: err.message } })),
          getAiHealth().catch((err) => ({ success: false, error: { message: err.message } })),
        ]);
        setHealth(healthRes);
        setDbHealth(dbRes);
        setAiHealth(aiRes);
      } catch (err) {
        console.error('Health check failed:', err);
      } finally {
        setLoading(false);
      }
    }
    checkConnectivity();
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0, color: '#38bdf8' }}>NEXUS AI</h1>
        <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0' }}>Company AI Operations Control Center</p>
      </header>

      <section style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Foundation System Status</h2>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Checking backend connectivity...</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
              <strong>Backend Status: </strong>
              {health?.success ? (
                <span style={{ color: '#4ade80' }}>Connected ✓ ({health.data?.service} - {health.data?.environment})</span>
              ) : (
                <span style={{ color: '#f87171' }}>Backend Unavailable ❌</span>
              )}
            </div>

            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
              <strong>Database Status: </strong>
              {dbHealth?.success ? (
                <span style={{ color: '#4ade80' }}>{dbHealth.data?.database || 'Connected'} ✓</span>
              ) : (
                <span style={{ color: '#f87171' }}>Unavailable ({dbHealth?.error?.message || 'Error'})</span>
              )}
            </div>

            <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
              <strong>AI Module (Gemini): </strong>
              <span style={{ color: '#94a3b8' }}>
                {aiHealth?.data?.configured ? 'Configured ✓' : 'Pending Configuration (Block 5)'}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
