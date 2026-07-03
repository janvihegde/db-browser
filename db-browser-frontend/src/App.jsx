import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar.jsx';
import api from './services/api';
import TableWorkspace from './components/TableWorkspace.jsx';

function App() {
  const [selectedDb, setSelectedDb] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [tables, setTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  // Fetch tables whenever a schema is selected
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

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      width: '100vw',
      margin: 0, 
      padding: 0, 
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      backgroundColor: '#000000',
      color: '#ffffff'
    }}>
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
           <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <h1 style={{ marginTop: 0, fontSize: '2.5rem', fontWeight: 300 }}>{selectedDb}</h1>
            <p style={{ color: '#a3a3a3' }}>Select a schema from the sidebar to view its tables.</p>
          </div>
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
  );
}

export default App;