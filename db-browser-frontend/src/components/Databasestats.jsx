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

  if (loading) return <CircularProgress sx={{ color: 'var(--accent-teal)', mt: 4 }} />;
  if (!stats) return <div style={{ color: 'var(--accent-error)' }}>Failed to load statistics.</div>;

  const Card = ({ title, value, icon, color }) => (
    <div style={{ backgroundColor: 'var(--bg-surface)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 300, color }}>{icon} {value}</div>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: '1000px' }}>
      <h1 style={{ marginTop: 0, fontSize: '2.5rem', fontWeight: 300, marginBottom: '8px', color: 'var(--text-primary)' }}>{db}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Database Overview & Statistics</p>

      {/* Top Metrics Row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <Card title="Total Size" value={stats.size} icon="💾" color="var(--accent-indigo)" />
        <Card title="Tables" value={stats.counts.table_count} icon="📊" color="var(--accent-teal)" />
        <Card title="Views" value={stats.counts.view_count} icon="👁️" color="var(--accent-indigo)" />
        <Card title="Functions" value={stats.counts.function_count} icon="⚙️" color="var(--accent-teal)" />
      </div>

      {/* Largest Tables List */}
      <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontWeight: 400, color: 'var(--text-primary)' }}>Top 5 Largest Tables</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stats.topTables.map((t, idx) => (
            <div key={t.table_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--bg-page)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{idx + 1}. {t.table_name}</span>
              <span style={{ color: 'var(--accent-teal)', fontFamily: 'monospace' }}>{t.size}</span>
            </div>
          ))}
          {stats.topTables.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>No tables found.</span>}
        </div>
      </div>
    </div>
  );
}