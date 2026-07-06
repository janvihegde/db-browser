import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar.jsx';
import TableWorkspace from './components/TableWorkspace.jsx';
import Login from './components/Login.jsx';
import api from './services/api';
import DatabaseStats from './components/DatabaseStats.jsx';

function App() {
  // Database/Workspace State
  const [selectedDb, setSelectedDb] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // Authentication State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Check Auth Session on Mount
  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setUser(res.data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 2. Fetch tables whenever a schema is selected
  useEffect(() => {
    if (selectedDb && selectedSchema) {
      setIsLoadingTables(true);
      api.get(`/database/${selectedDb}/schemas/${selectedSchema}/tables`)
        .then(response => {
          setTables(response.data.tables || []);
          setIsLoadingTables(false);
        })
        .catch(err => {
          console.error("Failed to fetch tables:", err);
          setIsLoadingTables(false);
        });
    } else {
      setTables([]);
    }
  }, [selectedDb, selectedSchema]);

  // 3. Handle Logout
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  // --- RENDERING LOGIC ---

  // Show a spinner while checking the session cookie
  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <CircularProgress sx={{ color: '#3b82f6' }} />
      </div>
    );
  }

  // If no user session, render the Login screen
  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  // Main Authenticated Workspace
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', margin: 0, padding: 0, fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: '#000000', color: '#ffffff' }}>
      
      {/* Top Navbar / Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: '#111111', borderBottom: '1px solid #262626', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🐘 DB Browser
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.9rem' }}>
          <span style={{ color: '#a3a3a3' }}>
            Logged in as <strong style={{ color: '#fff' }}>{user.email}</strong> 
            <span style={{ backgroundColor: '#262626', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', marginLeft: '8px', color: '#10b981' }}>
              {user.role}
            </span>
          </span>
          <button 
            onClick={handleLogout} 
            style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = '#ef4444'; e.target.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = '#ef4444'; }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main App Layout */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Sidebar 
          selectedDb={selectedDb} 
          onSelectDb={setSelectedDb} 
          selectedSchema={selectedSchema}
          onSelectSchema={setSelectedSchema}
        />
        
        <main style={{ padding: '60px', flexGrow: 1, backgroundColor: '#050505', overflowY: 'auto' }}>
          {selectedTable ? (
  <TableWorkspace 
    db={selectedDb} 
    schema={selectedSchema} 
    table={selectedTable} 
    onBack={() => setSelectedTable(null)} 
  />
          ) : selectedSchema ? (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <h1 style={{ marginTop: 0, fontSize: '2.5rem', fontWeight: 300, letterSpacing: '-0.5px' }}>
                {selectedSchema} <span style={{ color: '#525252', fontSize: '1.5rem' }}>/ schema</span>
              </h1>
              
              <div style={{ marginTop: '40px' }}>
                <h3 style={{ color: '#a3a3a3', fontWeight: 400, borderBottom: '1px solid #262626', paddingBottom: '12px' }}>
                  Tables ({tables.length})
                </h3>
                
                {isLoadingTables ? (
                  <CircularProgress size={24} sx={{ color: '#ffffff', mt: 2 }} />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '20px' }}>
                    {tables.map(table => {
                      const tableName = table.table_name || table;
                      return (
                        <div 
                          key={tableName}
                          style={{
                            padding: '16px 24px',
                            backgroundColor: '#111111',
                            border: '1px solid #262626',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#525252'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#262626'}
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
             <DatabaseStats db={selectedDb} />
          ) : (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'flex-start', 
              color: '#525252' 
            }}>
              <h1 style={{ marginTop: 0, fontWeight: 200, fontSize: '3rem', letterSpacing: '-1px', color: '#ffffff' }}>
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