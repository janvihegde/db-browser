import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import api from '../services/api';

export default function DatabaseStats({ db }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/database/${db}/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error("Failed to fetch stats", err))
      .finally(() => setLoading(false));
  }, [db]);

  if (loading) return <CircularProgress sx={{ color: '#3b82f6', mt: 4 }} />;
  if (!stats) return <div style={{ color: '#ef4444' }}>Failed to load statistics.</div>;

  const Card = ({ title, value, icon, color }) => (
    <div style={{ backgroundColor: '#111111', padding: '24px', borderRadius: '8px', border: '1px solid #262626', flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: '#a3a3a3', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 300, color }}>{icon} {value}</div>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '1000px' }}>
      <h1 style={{ marginTop: 0, fontSize: '2.5rem', fontWeight: 300, marginBottom: '8px' }}>{db}</h1>
      <p style={{ color: '#a3a3a3', marginBottom: '32px' }}>Database Overview & Statistics</p>

      {/* Top Metrics Row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <Card title="Total Size" value={stats.size} icon="💾" color="#3b82f6" />
        <Card title="Tables" value={stats.counts.table_count} icon="📊" color="#10b981" />
        <Card title="Views" value={stats.counts.view_count} icon="👁️" color="#f59e0b" />
        <Card title="Functions" value={stats.counts.function_count} icon="⚙️" color="#a855f7" />
      </div>

      {/* Largest Tables List */}
      <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontWeight: 400, color: '#e5e5e5' }}>Top 5 Largest Tables</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stats.topTables.map((t, idx) => (
            <div key={t.table_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#171717', borderRadius: '6px', border: '1px solid #262626' }}>
              <span style={{ fontWeight: 500 }}>{idx + 1}. {t.table_name}</span>
              <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{t.size}</span>
            </div>
          ))}
          {stats.topTables.length === 0 && <span style={{ color: '#525252' }}>No tables found.</span>}
        </div>
      </div>
    </div>
  );
}