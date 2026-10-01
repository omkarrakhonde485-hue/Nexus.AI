import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function IntegrationsPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState(null);
  const [driveWorkspace, setDriveWorkspace] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [initializingDrive, setInitializingDrive] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  // Check URL query parameters for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const googleParam = params.get('google');
    const reason = params.get('reason');

    if (googleParam === 'connected') {
      setAlertMessage({ type: 'success', text: 'Google Workspace successfully connected!' });
    } else if (googleParam === 'error') {
      setAlertMessage({ type: 'error', text: `Google connection failed: ${reason || 'Unknown error'}` });
    }
  }, [location]);

  const fetchStatus = async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setGoogleStatus(data.data);
        if (data.data.connected) {
          fetchDriveWorkspace();
        } else {
          setDriveWorkspace(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriveWorkspace = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/drive/workspace`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setDriveWorkspace(data);
      }
    } catch (err) {
      console.error('Failed to fetch Drive workspace status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [session]);

  const handleConnect = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/start?json=true`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        alert('Failed to obtain Google authorization URL.');
      }
    } catch (err) {
      console.error('OAuth start error:', err);
      alert('Error initiating Google connection.');
    }
  };

  const handleTestConnection = async () => {
    if (!session?.access_token) return;
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/test`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      setTestResult(data);
      // Refresh status in case token was expired/marked reauth
      fetchStatus();
    } catch (err) {
      setTestResult({ success: false, data: { error: err.message } });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!session?.access_token) return;
    if (!window.confirm('Are you sure you want to disconnect Google Workspace?')) return;

    try {
      setDisconnecting(true);
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage({ type: 'info', text: 'Google Workspace disconnected.' });
        setTestResult(null);
        setDriveWorkspace(null);
        fetchStatus();
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleInitializeWorkspace = async () => {
    if (!session?.access_token) return;
    try {
      setInitializingDrive(true);
      const res = await fetch(`${API_BASE_URL}/api/integrations/google/drive/workspace`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage({ type: 'success', text: 'NEXUS Workspace verified and synced with real Google Drive!' });
        setDriveWorkspace({
          success: true,
          workspaceCreated: true,
          folderId: data.folderId,
          webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.folderId}`,
        });
        fetchDriveWorkspace();
      } else {
        const errorMsg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Failed to initialize workspace.');
        setAlertMessage({ type: 'error', text: `Failed to initialize workspace: ${errorMsg}` });
      }
    } catch (err) {
      console.error('Init workspace error:', err);
      setAlertMessage({ type: 'error', text: 'Error initializing workspace: ' + err.message });
    } finally {
      setInitializingDrive(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: '#f8fafc' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#38bdf8' }}>
        Workspace Integrations
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
        Manage connected external services and authorized Google Workspace APIs.
      </p>

      {alertMessage && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            background:
              alertMessage.type === 'success'
                ? '#064e3b'
                : alertMessage.type === 'error'
                ? '#7f1d1d'
                : '#1e293b',
            color: '#fff',
            border:
              alertMessage.type === 'success'
                ? '1px solid #059669'
                : alertMessage.type === 'error'
                ? '1px solid #dc2626'
                : '1px solid #475569',
          }}
        >
          {alertMessage.text}
        </div>
      )}

      {/* Google Workspace Card */}
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f1f5f9', margin: 0 }}>
              Google Workspace
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
              Drive, Calendar, and Gmail integration for AI operations.
            </p>
          </div>
          <div>
            {loading ? (
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading...</span>
            ) : googleStatus?.connected ? (
              <span
                style={{
                  background: '#065f46',
                  color: '#34d399',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                ● Connected
              </span>
            ) : googleStatus?.status === 'reauthorization_required' ? (
              <span
                style={{
                  background: '#7c2d12',
                  color: '#fb923c',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                ⚠ Reauthorization Required
              </span>
            ) : (
              <span
                style={{
                  background: '#334155',
                  color: '#94a3b8',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                }}
              >
                Disconnected
              </span>
            )}
          </div>
        </div>

        {googleStatus?.connected ? (
          <div>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Connected Account:</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>{googleStatus.googleEmail}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                Scopes: {googleStatus.scopes?.length || 0} active OAuth permissions
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}
              >
                {testing ? 'Testing...' : 'Test Google Connection'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.2rem' }}>
              Connect your Google Workspace account to enable NEXUS AI to schedule calendar events, generate Drive documentation, and send email updates.
            </p>
            <button
              onClick={handleConnect}
              style={{
                padding: '0.6rem 1.2rem',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.95rem',
              }}
            >
              Connect Google Workspace
            </button>
          </div>
        )}

        {/* Live Test Results Card */}
        {testResult && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '6px',
              background: testResult.success ? '#064e3b' : '#7f1d1d',
              border: testResult.success ? '1px solid #059669' : '1px solid #dc2626',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 'bold' }}>
              {testResult.success ? '✓ Google API Verification Success' : '✗ Google API Test Failed'}
            </h3>
            <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Drive Workspace Card */}
      {googleStatus?.connected && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f1f5f9', margin: 0 }}>
                NEXUS Drive Workspace
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                App-managed folder structure for AI-generated documents and files.
              </p>
            </div>
            <div>
              {driveWorkspace?.workspaceCreated ? (
                <span
                  style={{
                    background: '#065f46',
                    color: '#34d399',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                  }}
                >
                  ✓ Created
                </span>
              ) : (
                <span
                  style={{
                    background: '#334155',
                    color: '#94a3b8',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.85rem',
                  }}
                >
                  Not Created
                </span>
              )}
            </div>
          </div>
          <div>
            {!driveWorkspace?.workspaceCreated ? (
              <button
                onClick={handleInitializeWorkspace}
                disabled={initializingDrive}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                }}
              >
                {initializingDrive ? 'Initializing Real Drive Workspace...' : 'Initialize Workspace'}
              </button>
            ) : (
              <div>
                <div style={{ background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #334155', fontSize: '0.85rem' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    Google Drive Workspace Active:
                  </div>
                  <div style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>
                    Folder ID: <code style={{ color: '#f59e0b', background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{driveWorkspace.folderId}</code>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    Created subfolders: <span style={{ color: '#4ade80' }}>Policies</span> • <span style={{ color: '#4ade80' }}>Reports</span> • <span style={{ color: '#4ade80' }}>Expenses</span> • <span style={{ color: '#4ade80' }}>Onboarding</span> • <span style={{ color: '#4ade80' }}>Meeting Reports</span>
                  </div>
                </div>
                <button
                  onClick={() => window.open(driveWorkspace.webViewLink || `https://drive.google.com/drive/folders/${driveWorkspace.folderId}`, '_blank')}
                  style={{
                    padding: '0.6rem 1.2rem',
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  Open NEXUS Drive (Google Drive) ↗
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Workspace Card */}
      {googleStatus?.connected && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f1f5f9', margin: 0 }}>
                NEXUS Google Calendar
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Event scheduling and calendar availability checking.
              </p>
            </div>
            <div>
              <span
                style={{
                  background: '#065f46',
                  color: '#34d399',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}
              >
                ✓ Connected
              </span>
            </div>
          </div>
          <div>
            <button
              onClick={() => window.open('https://calendar.google.com', '_blank')}
              style={{
                padding: '0.5rem 1rem',
                background: '#475569',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.9rem',
              }}
            >
              Open Google Calendar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

