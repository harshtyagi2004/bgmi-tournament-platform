import React, { useState } from 'react';
import axios from 'axios';

export default function OrganizerRoomPanel({ tournamentId = "65d1a2b3c4d5e6f7a8b9c0d1", tournamentTitle = "BGMI Weekly Championship" }) {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleBroadcast = async () => {
    setLoading(true);
    setStatusMsg('');

    try {
      const res = await axios.post('http://localhost:5000/api/tournaments/broadcast-room', {
        tournamentId,
        roomId,
        password
      });

      if (res.data.success) {
        setStatusMsg('✅ Room credentials broadcasted successfully!');
        setRoomId('');
        setPassword('');
      }
    } catch (err) {
      setStatusMsg('❌ Failed to broadcast. Ensure server is active.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#fff', padding: '24px', borderRadius: '12px', maxWidth: '420px', fontFamily: 'sans-serif' }}>
      <h3 style={{ color: '#f97316', marginTop: 0 }}>⚙️ Room Credentials Dispatcher</h3>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>Tournament: <strong>{tournamentTitle}</strong></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', color: '#cbd5e1' }}>Room ID</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="e.g. 849201"
            style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', textTransform: 'uppercase', color: '#cbd5e1' }}>Password</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="e.g. 1234"
            style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff', marginTop: '4px', boxSizing: 'border-box' }}
          />
        </div>

        <button
          onClick={handleBroadcast}
          disabled={loading || !roomId || !password}
          style={{ padding: '12px', backgroundColor: '#ea580c', color: '#fff', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '8px' }}
        >
          {loading ? 'Dispatching...' : '🚀 Broadcast Credentials'}
        </button>

        {statusMsg && <p style={{ fontSize: '13px', textAlign: 'center', margin: '8px 0 0 0' }}>{statusMsg}</p>}
      </div>
    </div>
  );
}