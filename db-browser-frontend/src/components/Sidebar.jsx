import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Sidebar = ({ connectionId, selectedDb, onSelectDb, selectedSchema, onSelectSchema, onSelectTable }) => {
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [expandedDb, setExpandedDb] = useState(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = no search active
  const [isSearching, setIsSearching] = useState(false);

  // Initial load: Fetch databases
  useEffect(() => {
    if (!connectionId) return;
    api.get(`/database/${connectionId}/list`)
      .then(res => setDatabases(res.data.databases || []))
      .catch(err => console.error("Failed to fetch DBs", err));
  }, [connectionId]);

  // Fetch schemas when a DB is expanded
  useEffect(() => {
    if (expandedDb && connectionId) {
      api.get(`/database/${connectionId}/${expandedDb}/schemas`)
        .then(res => setSchemas(res.data.schemas || []))
        .catch(err => console.error("Failed to fetch schemas", err));
    }
  }, [expandedDb, connectionId]);

  // Debounced search — fires 300ms after the user stops typing
  useEffect(() => {
    if (!selectedDb || !connectionId || !searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      api.get(`/database/${connectionId}/${selectedDb}/search`, { params: { q: searchTerm.trim() } })
        .then(res => setSearchResults(res.data))
        .catch(err => {
          console.error("Search failed", err);
          setSearchResults({ tables: [], columns: [] });
        })
        .finally(() => setIsSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, selectedDb, connectionId]);

  const handleDbClick = (db) => {
    setExpandedDb(expandedDb === db ? null : db);
    onSelectDb(db);
    onSelectSchema(null); // Reset schema when DB changes
    setSearchTerm('');
    setSearchResults(null);
  };

  const handleSchemaClick = (schema) => {
    onSelectSchema(schema);
  };

  const handleSearchResultClick = (schema, table) => {
    onSelectSchema(schema);
    onSelectTable(table);
    setSearchTerm('');
    setSearchResults(null);
  };

  return (
    <div style={{ width: '280px', backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      {/* Search Box — only usable once a database is selected */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          placeholder={selectedDb ? 'Search tables & columns...' : 'Select a database first'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={!selectedDb}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: selectedDb ? 'var(--bg-page)' : 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem'
          }}
        />
      </div>

      {/* Search Results (shown instead of the tree while a search is active) */}
      {searchResults ? (
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>
          {isSearching ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Searching...</div>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tables ({searchResults.tables.length})
              </div>
              {searchResults.tables.map((t, i) => (
                <div
                  key={`t-${i}`}
                  onClick={() => handleSearchResultClick(t.table_schema, t.table_name)}
                  style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--text-primary)' }}
                >
                  📄 {t.table_schema}.{t.table_name}
                </div>
              ))}

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Columns ({searchResults.columns.length})
              </div>
              {searchResults.columns.map((c, i) => (
                <div
                  key={`c-${i}`}
                  onClick={() => handleSearchResultClick(c.table_schema, c.table_name)}
                  style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}
                >
                  🔤 {c.table_schema}.{c.table_name}.{c.column_name}
                </div>
              ))}

              {searchResults.tables.length === 0 && searchResults.columns.length === 0 && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No matches found.</div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Navigation Tree */
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Databases
            </div>

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
        </div>
      )}
    </div>
  );
};

export default Sidebar;
