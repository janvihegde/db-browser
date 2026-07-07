import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Sidebar = ({ selectedDb, onSelectDb, selectedSchema, onSelectSchema }) => {
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [expandedDb, setExpandedDb] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Initial load: Fetch databases
  useEffect(() => {
    api.get('/database/list')
      .then(res => setDatabases(res.data.databases || []))
      .catch(err => console.error("Failed to fetch DBs", err));
  }, []);

  // Fetch schemas when a DB is expanded
  useEffect(() => {
    if (expandedDb) {
      api.get(`/database/${expandedDb}/schemas`)
        .then(res => setSchemas(res.data.schemas || []))
        .catch(err => console.error("Failed to fetch schemas", err));
    }
  }, [expandedDb]);

  // Handle Search Input with 300ms Debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      api.get(`/database/search?query=${searchQuery}`)
        .then(res => setSearchResults(res.data.results || []))
        .catch(err => console.error("Search failed", err))
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDbClick = (db) => {
    setExpandedDb(expandedDb === db ? null : db);
    onSelectDb(db);
    onSelectSchema(null); // Reset schema when DB changes
  };

  const handleSchemaClick = (schema) => {
    onSelectSchema(schema);
  };

  return (
    <div style={{ width: '280px', backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      {/* Search Bar Area */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-page)' }}>
        <input
          type="text"
          placeholder="Search tables & columns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-page)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            outline: 'none',
            fontSize: '0.9rem',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent-indigo)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
        />
      </div>

      {/* Navigation Tree or Search Results */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>

        {searchQuery.trim() ? (
          /* --- SEARCH RESULTS VIEW --- */
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isSearching ? 'Searching...' : 'Search Results'}
            </div>

            {!isSearching && searchResults && searchResults.length === 0 && (
              <div style={{ color: 'var(--accent-error)', fontSize: '0.9rem' }}>No matches found.</div>
            )}

            {!isSearching && searchResults && searchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map((result, idx) => (
                  <div key={idx}
                    onClick={() => {
                       // Ensure the correct DB/Schema is selected before diving in
                       // Note: Assumes current selectedDb if backend doesn't explicitly return db name
                       if (!selectedDb && databases.length > 0) onSelectDb(databases[0]);
                       onSelectSchema(result.table_schema);
                       // We clear the search to let App.jsx render the schema view
                       setSearchQuery('');
                    }}
                    style={{ padding: '10px', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 600, color: result.type === 'table' ? 'var(--accent-teal)' : 'var(--accent-indigo)', fontSize: '0.95rem' }}>
                      {result.type === 'table' ? '📊 Table: ' : '🔤 Column: '}
                      <span style={{ color: 'var(--text-primary)' }}>{result.name}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Located in schema: <strong style={{ color: 'var(--text-primary)' }}>{result.table_schema}</strong>
                      {result.type === 'column' && <span> • Table: <strong style={{ color: 'var(--text-primary)' }}>{result.table_name}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- NORMAL NAVIGATION TREE --- */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Databases</div>
            {databases.map(dbName => (
              <div key={dbName}>
                {/* Database Node */}
                <div
                  onClick={() => handleDbClick(dbName)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: selectedDb === dbName ? 'var(--accent-indigo-soft)' : 'transparent',
                    color: selectedDb === dbName ? 'var(--accent-indigo)' : 'var(--text-primary)',
                    fontWeight: selectedDb === dbName ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {expandedDb === dbName ? '📂' : '📁'} {dbName}
                </div>

                {/* Schema Children */}
                {expandedDb === dbName && (
                  <div style={{ paddingLeft: '24px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {schemas.map(schema => (
                      <div
                        key={schema}
                        onClick={() => handleSchemaClick(schema)}
                        style={{
                          padding: '6px 12px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          backgroundColor: selectedSchema === schema ? 'var(--accent-teal-soft)' : 'transparent',
                          color: selectedSchema === schema ? 'var(--accent-teal)' : 'var(--text-secondary)',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          borderLeft: '1px solid var(--border-color)'
                        }}
                      >
                        📄 {schema}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;