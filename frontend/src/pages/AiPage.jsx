// frontend/src/pages/AiPage.jsx
// Minimal testing UI for NEXUS AI Agent

import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function AiPage() {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userMsg = message.trim();
    setMessage('');
    setError(null);
    setLoading(true);

    const newConvo = [...conversation, { sender: 'user', text: userMsg }];
    setConversation(newConvo);

    try {
      const res = await api.post('/api/ai/agent', { message: userMsg });
      if (res.data.success) {
        setConversation([
          ...newConvo,
          {
            sender: 'nexus',
            text: res.data.data.message,
            actions: res.data.data.actions || [],
            intent: res.data.data.intent,
            workflowId: res.data.data.workflowId,
          },
        ]);
      } else {
        setError(res.data.error?.message || 'AI processing failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem', color: '#f8fafc' }}>
      <h1 style={{ fontSize: '1.8rem', color: '#38bdf8', marginBottom: '0.5rem' }}>Ask NEXUS AI</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Autonomous operations assistant for {profile?.fullName || 'employee'}.
      </p>

      {/* Messages */}
      <div style={{ background: '#1e293b', borderRadius: '8px', padding: '1rem', minHeight: '300px', marginBottom: '1rem', border: '1px solid #334155' }}>
        {conversation.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: '4rem' }}>
            "I need reimbursement for ₹2,850 from yesterday's client visit."
          </p>
        ) : (
          conversation.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '1.2rem', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '80%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: msg.sender === 'user' ? '#0284c7' : '#334155',
                  color: '#fff',
                }}
              >
                <strong>{msg.sender === 'user' ? 'You' : 'NEXUS AI'}: </strong>
                <span>{msg.text}</span>

                {/* AI Actions Trace */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.3rem' }}>AI Actions:</div>
                    {msg.actions.map((act, i) => (
                      <div key={i} style={{ color: act.status === 'success' ? '#4ade80' : '#f87171' }}>
                        ✓ {act.tool} ({act.status}) - {act.summary}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && <div style={{ color: '#38bdf8', fontSize: '0.9rem' }}>NEXUS AI is reasoning and orchestrating...</div>}
        {error && <div style={{ color: '#f87171', fontSize: '0.9rem', marginTop: '0.5rem' }}>Error: {error}</div>}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What do you need to get done?"
          disabled={loading}
          style={{ flex: 1, padding: '0.75rem 1rem', background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
        />
        <button
          type="submit"
          disabled={loading || !message.trim()}
          style={{ padding: '0.75rem 1.5rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
