// frontend/src/pages/AiPage.jsx
// Interactive operations assistant for NEXUS AI with server-authoritative confirmation gating

import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function AiPage() {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);
  const [pendingActionId, setPendingActionId] = useState(null);
  const [pendingProposal, setPendingProposal] = useState(null);

  const sendMessageWithPayload = async (textToSend, actionIdToSend) => {
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setMessage('');
    setError(null);
    setLoading(true);

    const newConvo = [...conversation, { sender: 'user', text: userMsg }];
    setConversation(newConvo);

    try {
      const payload = { message: userMsg };
      if (actionIdToSend) {
        payload.pendingActionId = actionIdToSend;
      }

      const res = await api.post('/api/ai/agent', payload);
      if (res.data.success) {
        const data = res.data.data;

        // If response requires confirmation, store pendingActionId
        if (data.requiresConfirmation && data.pendingActionId) {
          setPendingActionId(data.pendingActionId);
          setPendingProposal(data.proposal);
        } else {
          setPendingActionId(null);
          setPendingProposal(null);
        }

        setConversation([
          ...newConvo,
          {
            sender: 'nexus',
            text: data.message,
            actions: data.actions || [],
            intent: data.intent,
            workflowId: data.workflowId,
            requiresConfirmation: data.requiresConfirmation,
            pendingActionId: data.pendingActionId,
            proposal: data.proposal,
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

  const handleSend = async (e) => {
    e.preventDefault();
    await sendMessageWithPayload(message, pendingActionId);
  };

  const handleConfirmAction = async (affirmative) => {
    const text = affirmative ? 'yes' : 'no';
    await sendMessageWithPayload(text, pendingActionId);
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
          <div style={{ color: '#64748b', textAlign: 'center', marginTop: '4rem' }}>
            <p>"schedule a meeting with manager on 1 oct morning 11 AM"</p>
            <p style={{ fontSize: '0.85rem' }}>or "I need reimbursement for ₹2,850 from yesterday's client visit."</p>
          </div>
        ) : (
          conversation.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '1.2rem', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '85%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  background: msg.sender === 'user' ? '#0284c7' : '#334155',
                  color: '#fff',
                }}
              >
                <strong>{msg.sender === 'user' ? 'You' : 'NEXUS AI'}: </strong>
                <span>{msg.text}</span>

                {/* Pending Proposal Preview Banner */}
                {msg.proposal && (
                  <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: '#0f172a', borderRadius: '6px', border: '1px solid #0284c7' }}>
                    <div style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                      Proposed Calendar Event:
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                      <strong>Title:</strong> {msg.proposal.summary}<br />
                      <strong>Time:</strong> {msg.proposal.displayFull || `${msg.proposal.start} to ${msg.proposal.end}`}<br />
                      <strong>Timezone:</strong> {msg.proposal.timeZone}
                    </div>
                  </div>
                )}

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

        {/* Interactive Confirmation Bar if awaiting confirmation */}
        {pendingActionId && !loading && (
          <div style={{ margin: '1rem 0', padding: '0.85rem', background: '#0284c715', border: '1px solid #0284c7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 'bold' }}>
              Confirm scheduling this meeting proposal?
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleConfirmAction(true)}
                style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ✓ Yes, Schedule It
              </button>
              <button
                onClick={() => handleConfirmAction(false)}
                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
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
          placeholder={pendingActionId ? 'Type "yes" to confirm or "no" to cancel...' : 'What do you need to get done?'}
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
