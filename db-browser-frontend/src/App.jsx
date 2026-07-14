import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar.jsx';
import TableWorkspace from './components/TableWorkspace.jsx';
import ConnectionManager from './components/ConnectionManager.jsx';
import api from './services/api';
import { dbClient } from './services/dbClient';

function App() {
  // Connection State — which saved AWS RDS connection is active
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);

  // Database/Workspace State
  const [selectedDb, setSelectedDb] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // Identity State — no login, just whichever device/user record the
  // X-Device-Id header resolves (or auto-creates) to.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityError, setIdentityError] = useState(false);

  // 1. Identify (and auto-register) this device on mount
  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
      })
      .catch(() => {
        setIdentityError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 2. Fetch tables whenever a schema is selected
  useEffect(() => {
    if (selectedConnectionId && selectedDb && selectedSchema) {
      setIsLoadingTables(true);
      dbClient.listTables(selectedConnectionId, selectedDb, selectedSchema)
        .then(tables => {
          setTables(tables);
          setIsLoadingTables(false);
        })
        .catch(err => {
          console.error("Failed to fetch tables:", err);
          setIsLoadingTables(false);
        });
    } else {
      setTables([]);
    }
  }, [selectedConnectionId, selectedDb, selectedSchema]);

  // 3. Switch back to the connection picker
  const handleSwitchConnection = () => {
    setSelectedConnectionId(null);
    setSelectedDb(null);
    setSelectedSchema(null);
    setSelectedTable(null);
  };

  // --- RENDERING LOGIC ---

  // Show a spinner while checking the session cookie
  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)' }}>
        <CircularProgress sx={{ color: 'var(--accent-purple)' }} />
      </div>
    );
  }

  // Couldn't reach the backend / register this device — show a simple retry
  if (identityError || !user) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <p>Couldn't connect to the server. Please check your connection and try again.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  // Logged in but no database connection selected yet — show the picker
  if (!selectedConnectionId) {
    return (
      <div style={{ minHeight: '100vh', width: '100vw', margin: 0, fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🐘 DB Browser
          </div>
        </div>
        <ConnectionManager onSelectConnection={setSelectedConnectionId} />
      </div>
    );
  }

  // Main Authenticated Workspace
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, padding: 0, fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      
      {/* Top Navbar / Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🐘 DB Browser
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.9rem' }}>
          <button
            onClick={handleSwitchConnection}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Switch Connection
          </button>
        </div>
      </div>

      {/* Main App Layout */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Sidebar 
          connectionId={selectedConnectionId}
          selectedDb={selectedDb} 
          onSelectDb={setSelectedDb} 
          selectedSchema={selectedSchema}
          onSelectSchema={setSelectedSchema}
          onSelectTable={setSelectedTable}
        />
        
        <main style={{ padding: '60px', flexGrow: 1, backgroundColor: 'var(--bg-main)', overflowY: 'auto' }}>
          {selectedTable ? (
            <TableWorkspace 
              connectionId={selectedConnectionId}
              db={selectedDb} 
              schema={selectedSchema} 
              table={selectedTable} 
              onBack={() => setSelectedTable(null)} 
            />
          ) : selectedSchema ? (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              
              {/* NEW: Go Back to Schemas Button */}
              <button 
                onClick={() => setSelectedSchema(null)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--accent-teal)', 
                  cursor: 'pointer', 
                  fontSize: '0.95rem',
                  padding: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 500
                }}
              >
                ← Back to Schemas
              </button>

              <h1 style={{ marginTop: 0, fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                {selectedSchema} <span style={{ color: 'var(--text-secondary)', fontSize: '1.5rem' }}>/ schema</span>
              </h1>
              
              <div style={{ marginTop: '40px' }}>
                <h3 style={{ color: 'var(--text-secondary)', fontWeight: 400, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  Tables ({tables.length})
                </h3>
                {isLoadingTables ? (
                  <CircularProgress size={24} sx={{ color: 'var(--text-primary)', mt: 2 }} />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '20px' }}>
                    {tables.map(table => {
                      const tableName = table.table_name || table;
                      return (
                        <div 
                          key={tableName}
                          style={{
                            padding: '16px 24px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: 'var(--text-primary)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                          onClick={() => setSelectedTable(tableName)}
                        >
                          {tableName}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : selectedDb ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
              <h1 style={{ marginTop: 0, fontWeight: 200, fontSize: '3rem', letterSpacing: '-1px', color: 'var(--text-primary)' }}>
                {selectedDb}
              </h1>
              <p style={{ fontSize: '1.2rem' }}>Expand the database on the left and select a schema to view tables.</p>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
              <h1 style={{ marginTop: 0, fontWeight: 200, fontSize: '3rem', letterSpacing: '-1px', color: 'var(--text-primary)' }}>
                Database Workspace
              </h1>
              <p style={{ fontSize: '1.2rem' }}>Select a database from the left to begin.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;