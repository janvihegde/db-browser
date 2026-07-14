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
  const [editingId, setEditingId] = useState(null);
  
  const [error, setError] = useState(null);
  const [testSuccess, setTestSuccess] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    label: '',
    host: '',
    port: '5432',
    dbUser: '',
    dbPassword: '',
    databaseName: '',
    sslRejectUnauthorized: false
  };

  const [form, setForm] = useState(initialFormState);

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
    // Clear validation status when things change
    setError(null);
    setTestSuccess(null);
  };

  const handleTestConnection = async () => {
    setError(null);
    setTestSuccess(null);

    if (!form.host || !form.dbUser || !form.databaseName) {
      setError('Host, Username, and Database name are required to test.');
      return;
    }
    if (!editingId && !form.dbPassword) {
      setError('Password is required to test a new connection.');
      return;
    }

    setIsTesting(true);
    try {
      const res = await api.post('/connections/test', form);
      setTestSuccess(res.data.message || 'Connection test successful!');
    } catch (err) {
      setError(err.response?.data?.error || 'Connection verification failed.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setTestSuccess(null);

    if (!form.label || !form.host || !form.dbUser || !form.databaseName) {
      setError('All metadata fields are required.');
      return;
    }
    if (!editingId && !form.dbPassword) {
      setError('Password is required for new configurations.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/connections/${editingId}`, form);
      } else {
        await api.post('/connections', form);
      }
      setForm(initialFormState);
      setShowForm(false);
      setEditingId(null);
      loadConnections();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to persist transaction parameters.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (conn, e) => {
    e.stopPropagation(); // Avoid triggering database row selection triggers
    setError(null);
    setTestSuccess(null);
    setEditingId(conn.id);
    setForm({
      label: conn.label,
      host: conn.host,
      port: String(conn.port),
      dbUser: conn.db_user,
      dbPassword: '', // Keep blank unless updating to protect existing records
      databaseName: conn.database_name,
      sslRejectUnauthorized: !!conn.ssl_reject_unauthorized
    });
    setShowForm(true);
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

  const handleCancel = () => {
    setForm(initialFormState);
    setShowForm(false);
    setEditingId(null);
    setError(null);
    setTestSuccess(null);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '60px auto', padding: '0 24px' }}>
      <h1 style={{ fontWeight: 300, fontSize: '2rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
        Your Database Connections
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Connect your own PostgreSQL instance safely — credentials remain encrypted at rest.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {connections.length === 0 && !showForm && (
            <p style={{ color: 'var(--text-secondary)' }}>No saved connections found — configure one below.</p>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={(e) => handleEditClick(conn, e)}
                  style={{ background: 'transparent', border: '1px solid var(--accent-teal)', color: 'var(--accent-teal)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Edit
                </button>
                <button
                  onClick={(e) => handleDelete(conn.id, e)}
                  style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Delete
                </button>
              </div>
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
          <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
            {editingId ? 'Modify Connection Parameters' : 'New Connection Setup'}
          </h3>

          {error && (
            <div style={{ color: '#fff', backgroundColor: '#ef4444', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.9rem', lineHeight: '1.4' }}>
              ⚠️ {error}
            </div>
          )}

          {testSuccess && (
            <div style={{ color: '#fff', backgroundColor: '#22c55e', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.9rem' }}>
              ✅ {testSuccess}
            </div>
          )}

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Label</label>
          <input style={inputStyle} placeholder="e.g. Production Replica" value={form.label} onChange={e => handleFormChange('label', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Host</label>
          <input style={inputStyle} placeholder="mydb.xxxxxxx.rds.amazonaws.com" value={form.host} onChange={e => handleFormChange('host', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Port</label>
          <input style={inputStyle} type="number" value={form.port} onChange={e => handleFormChange('port', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Database Username</label>
          <input style={inputStyle} value={form.dbUser} onChange={e => handleFormChange('dbUser', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Database Password {editingId && <span style={{ opacity: 0.6 }}>(Leave blank to keep existing password)</span>}
          </label>
          <input style={inputStyle} type="password" value={form.dbPassword} onChange={e => handleFormChange('dbPassword', e.target.value)} />

          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Database Name</label>
          <input style={inputStyle} placeholder="postgres" value={form.databaseName} onChange={e => handleFormChange('databaseName', e.target.value)} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <input type="checkbox" checked={form.sslRejectUnauthorized} onChange={e => handleFormChange('sslRejectUnauthorized', e.target.checked)} />
            Enforce strict SSL certificate validation
          </label>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestConnection}
              style={{ backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '6px', cursor: isTesting ? 'not-allowed' : 'pointer' }}
            >
              {isTesting ? 'Verifying...' : 'Test Connection'}
            </button>
            
            <button
              type="submit"
              disabled={isSaving}
              style={{ backgroundColor: 'var(--accent-teal)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              {isSaving ? 'Saving...' : editingId ? 'Update Parameters' : 'Save Connection'}
            </button>
            
            <button
              type="button"
              onClick={handleCancel}
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