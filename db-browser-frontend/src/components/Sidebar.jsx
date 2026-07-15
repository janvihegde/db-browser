import React, { useState, useEffect } from 'react';
import { dbClient } from '../services/dbClient';

const Sidebar = ({ connectionId, selectedDb, onSelectDb, selectedSchema, onSelectSchema, onSelectTable }) => {
  const [databases, setDatabases] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [expandedDb, setExpandedDb] = useState(null);

  // Initial load: Fetch databases
  useEffect(() => {
    if (!connectionId) return;
    dbClient.listDatabases(connectionId)
      .then(dbs => setDatabases(dbs))
      .catch(err => console.error("Failed to fetch DBs", err));
  }, [connectionId]);

  // Fetch schemas when a DB is expanded
  useEffect(() => {
    if (expandedDb && connectionId) {
      dbClient.listSchemas(connectionId, expandedDb)
        .then(schemas => setSchemas(schemas))
        .catch(err => console.error("Failed to fetch schemas", err));
    }
  }, [expandedDb, connectionId]);

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
        {/* Navigation Tree */}
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
    </div>
  );
};

export default Sidebar;