import React, { useState, useEffect } from 'react';
import api from '../services/api';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-page)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  marginBottom: '12px'
};

const ConnectionManager = ({ onSelectConnection }) => {
  const [connections, setConnections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    label: '',
    host: '',
    port: '5432',
    dbUser: '',
    dbPassword: '',
    databaseName: '',
    sslRejectUnauthorized: false
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadConnections = () => {
    setIsLoading(true);
    api.get('/connections')
      .then(res => setConnections(res.data.connections || []))
      .catch(err => console.error('Failed to load connections:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadConnections(); }, []);

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.label || !form.host || !form.dbUser || !form.dbPassword || !form.databaseName) {
      setError('All fields except SSL are required.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/connections', form);
      setForm({ label: '', host: '', port: '5432', dbUser: '', dbPassword: '', databaseName: '', sslRejectUnauthorized: false });
      setShowForm(false);
      loadConnections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved connection? This cannot be undone.')) return;
    try {
      await api.delete(`/connections/${id}`);
      loadConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '60px auto', padding: '0 24px' }}>
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
        Your Database Connections
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Connect your own AWS RDS instance — your credentials are encrypted and only usable by you.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {connections.length === 0 && !showForm && (
            <p style={{ color: 'var(--text-secondary)' }}>No saved connections yet — add your first one below.</p>
          )}

          {connections.map(conn => (
            <div
              key={conn.id}
              onClick={() => onSelectConnection(conn.id)}
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{conn.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {conn.db_user}@{conn.host}:{conn.port} / {conn.database_name}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(conn.id, e)}
                style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ backgroundColor: 'var(--accent-teal)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
        >
          + Add Connection
        </button>
      ) : (
        <form onSubmit={handleSave} style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>New Connection</h3>

          {error && <div style={{ color: '#ef4444', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</div>}

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Label</label>
          <input style={inputStyle} placeholder="e.g. My Analytics DB" value={form.label} onChange={e => handleFormChange('label', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Host</label>
          <input style={inputStyle} placeholder="mydb.xxxxxxxx.us-east-1.rds.amazonaws.com" value={form.host} onChange={e => handleFormChange('host', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Port</label>
          <input style={inputStyle} type="number" value={form.port} onChange={e => handleFormChange('port', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Database Username</label>
          <input style={inputStyle} value={form.dbUser} onChange={e => handleFormChange('dbUser', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Database Password</label>
          <input style={inputStyle} type="password" value={form.dbPassword} onChange={e => handleFormChange('dbPassword', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Database Name</label>
          <input style={inputStyle} placeholder="postgres" value={form.databaseName} onChange={e => handleFormChange('databaseName', e.target.value)} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <input type="checkbox" checked={form.sslRejectUnauthorized} onChange={e => handleFormChange('sslRejectUnauthorized', e.target.checked)} />
            Enforce strict SSL certificate validation
          </label>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{ backgroundColor: 'var(--accent-teal)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : 'Save Connection'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ConnectionManager;
