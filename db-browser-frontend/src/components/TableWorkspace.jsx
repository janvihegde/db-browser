import React, { useState, useEffect } from 'react';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import Editor from '@monaco-editor/react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import Toast from './Toast.jsx';
import { extensionApi } from '../services/extensionBridge';

const TableWorkspace = ({ connectionId, db, schema, table, onBack }) => {
 const connectionId = connection.id; 
  
  const [activeTab, setActiveTab] = useState(0);

  // Data Preview State
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);

  // Columns Metadata State
  const [columnsData, setColumnsData] = useState([]);

  // Relationships State
  const [relationships, setRelationships] = useState({ outgoing: [], incoming: [] });

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  const [queryResults, setQueryResults] = useState([]);
  const [queryColumnDefs, setQueryColumnDefs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryError, setQueryError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [rowCount, setRowCount] = useState(null);

  // Base path for all routes scoped to this database/schema/table
  const tableBasePath = `/database/${connectionId}/${db}/schemas/${schema}/tables/${table}`;

  // Fetch row count whenever the table changes
  // Fetch row count update
useEffect(() => {
  if (!db || !schema || !table) return;
  setRowCount(null);
  
  if (connection.isLocal) {
    const sql = `SELECT count(*) FROM "${schema}"."${table}";`;
    extensionApi.runQuery(connection, db, sql)
      .then(res => setRowCount(res.data[0].count))
      .catch(console.error);
  } else {
    api.get(`${tableBasePath}/count`)
      .then(res => setRowCount(res.data.rowCount))
      .catch(console.error);
  }
}, [db, schema, table, connection]);

  // Fetch data when switching tabs
  // Fetch data when switching tabs
  useEffect(() => {
    if (!db || !schema || !table) return;

    const fetchTabData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 0) {
          // --- DATA PREVIEW ---
          let data = [];
          if (connection.isLocal) {
            const res = await extensionApi.previewTable(connection, db, schema, table);
            data = res.data || [];
          } else {
            const res = await api.get(`${tableBasePath}/preview`);
            data = res.data?.rows || res.data?.data || res.data || [];
          }
          
          setRowData(data);
          setColumnDefs(data.length > 0 
            ? Object.keys(data[0]).map(key => ({ field: key, sortable: true, filter: true, resizable: true })) 
            : []
          );

        } else if (activeTab === 1) {
          // --- COLUMNS ---
          let colsData = [];
          if (connection.isLocal) {
            const res = await extensionApi.listColumns(connection, db, schema, table);
            colsData = res.columns || [];
          } else {
            const res = await api.get(`${tableBasePath}/columns`);
            colsData = res.data?.columns || res.data?.data || res.data || [];
          }
          setColumnsData(colsData);

        } else if (activeTab === 2) {
          // --- RELATIONSHIPS ---
          if (connection.isLocal) {
            // Raw SQL to fetch outgoing foreign keys
            const outSql = `
              SELECT kcu.column_name, ccu.table_schema AS referenced_schema, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '${schema}' AND tc.table_name = '${table}';
            `;
            
            // Raw SQL to fetch incoming foreign keys
            const inSql = `
              SELECT tc.table_schema AS referencing_schema, tc.table_name AS referencing_table, kcu.column_name AS referencing_column, ccu.column_name AS referenced_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_schema = '${schema}' AND ccu.table_name = '${table}';
            `;

            const [outRes, inRes] = await Promise.all([
              extensionApi.runQuery(connection, db, outSql),
              extensionApi.runQuery(connection, db, inSql)
            ]);

            setRelationships({ outgoing: outRes.data || [], incoming: inRes.data || [] });
          } else {
            const res = await api.get(`${tableBasePath}/relationships`);
            setRelationships({
              outgoing: res.data.outgoing || [],
              incoming: res.data.incoming || []
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch tab data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTabData();
  }, [db, schema, table, activeTab, connection]);

  // Handle SQL Execution (Run Query)
  const handleRunQuery = async () => {
  if (!sqlQuery.trim()) return;
  setIsExecuting(true);
  setQueryError(null);

  try {
    let data = [];
    if (connection.isLocal) {
      // 🚀 Run locally
      const response = await extensionApi.runQuery(connection, db, sqlQuery);
      data = response.data;
    } else {
      // ☁️ Run via cloud
      const response = await api.post(`/database/${connection.id}/${db}/query`, { sql: sqlQuery });
      data = response.data?.rows || response.data?.data || response.data || [];
    }

    setQueryResults(data);
    if (data.length > 0) {
      setQueryColumnDefs(Object.keys(data[0]).map(key => ({ field: key, sortable: true, filter: true, resizable: true })));
    }
  } catch (err) {
    setQueryError(err.message || "An error occurred.");
    setQueryResults([]);
  } finally {
    setIsExecuting(false);
  }
};

  // Trigger CSV Download
  const handleExportCSV = () => {
    if (!sqlQuery.trim()) return;
    const encodedQuery = encodeURIComponent(sqlQuery);
    const base = api.defaults.baseURL || '';
    const exportUrl = `${base}/database/${connectionId}/${db}/query/export?sql=${encodedQuery}`;
    window.open(exportUrl, '_blank');
  };

  const metaColumnDefs = [
    { field: 'column_name', headerName: 'Column Name', flex: 1, sortable: true, filter: true },
    { field: 'data_type', headerName: 'Data Type', flex: 1, sortable: true, filter: true },
    { field: 'is_primary_key', headerName: 'PK', width: 100, cellRenderer: (params) => params.value ? '🔑 Yes' : '' },
    { field: 'is_foreign_key', headerName: 'FK', width: 100, cellRenderer: (params) => params.value ? '🔗 Yes' : '' },
    { field: 'is_nullable', headerName: 'Nullable', width: 120, sortable: true, filter: true },
    { field: 'column_default', headerName: 'Default Value', flex: 1, sortable: true, filter: true },
  ];

  const relationshipCardStyle = {
    padding: '16px 20px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    marginBottom: '12px'
  };

  return (
    <div className="workspace-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px', backgroundColor: 'var(--bg-page)' }}>

      {/* Header Area */}
      <div style={{ marginBottom: '24px' }}>
        <button onClick={onBack} className="btn-back" style={{ marginBottom: '8px', cursor: 'pointer' }}>← Back to Tables</button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{table}</h2>
          {rowCount !== null && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', backgroundColor: 'var(--bg-surface)', padding: '4px 12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              {Number(rowCount).toLocaleString()} Rows
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          minHeight: '40px', mb: 3, borderBottom: '1px solid var(--border-color)',
          '& .MuiTab-root': { color: 'var(--text-secondary)', textTransform: 'none', fontSize: '1rem', fontWeight: 500 },
          '& .Mui-selected': { color: 'var(--text-primary) !important' },
          '& .MuiTabs-indicator': { backgroundColor: 'var(--accent-indigo)' }
        }}
      >
        <Tab label="Data Preview" />
        <Tab label="Columns" />
        <Tab label="Relationships" />
        <Tab label="SQL Editor" />
      </Tabs>

      {/* Tab Content Area */}
      <div style={{ flexGrow: 1, backgroundColor: 'var(--bg-page)', borderRadius: '8px', overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} sx={{ color: 'var(--accent-indigo)' }} />
          </div>
        ) : activeTab === 0 ? (
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <AgGridReact theme="legacy" rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 1 ? (
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <AgGridReact theme="legacy" rowData={columnsData} columnDefs={metaColumnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 2 ? (
          <div style={{ height: '100%', overflowY: 'auto', padding: '4px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '12px' }}>
                This table references ({relationships.outgoing.length})
              </h4>
              {relationships.outgoing.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No outgoing foreign keys.</p>
              ) : (
                relationships.outgoing.map((fk, i) => (
                  <div key={i} style={relationshipCardStyle}>
                    <strong>{table}.{fk.column_name}</strong>
                    <span style={{ color: 'var(--text-secondary)' }}> → </span>
                    <strong>{fk.referenced_schema}.{fk.referenced_table}.{fk.referenced_column}</strong>
                  </div>
                ))
              )}
            </div>

            <div>
              <h4 style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '12px' }}>
                Referenced by ({relationships.incoming.length})
              </h4>
              {relationships.incoming.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No incoming foreign keys.</p>
              ) : (
                relationships.incoming.map((fk, i) => (
                  <div key={i} style={relationshipCardStyle}>
                    <strong>{fk.referencing_schema}.{fk.referencing_table}.{fk.referencing_column}</strong>
                    <span style={{ color: 'var(--text-secondary)' }}> → </span>
                    <strong>{table}.{fk.referenced_column}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' }}>

            {/* Card 1: SQL Editor — fixed height so it doesn't depend on a
                percentage of a variable-height ancestor; scrolls with the
                page instead of being squeezed to fit the viewport */}
            <div style={{ height: '300px', flexShrink: 0, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)' }}>
              <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                Query Editor
              </div>
              <div style={{ flexGrow: 1, position: 'relative' }}>
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  theme="light"
                  value={sqlQuery}
                  onChange={(value) => setSqlQuery(value)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true
                  }}
                />
              </div>
            </div>

            {/* Card 2: Action Buttons */}
            <div style={{ flexShrink: 0, padding: '16px 24px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)' }}>
              <button
                onClick={handleRunQuery}
                disabled={isExecuting}
                style={{
                  backgroundColor: isExecuting ? 'var(--border-color)' : 'var(--accent-teal)',
                  color: isExecuting ? 'var(--text-secondary)' : '#ffffff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '6px',
                  cursor: isExecuting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  transition: 'background-color 0.2s'
                }}
              >
                {isExecuting ? 'Executing...' : '▶ Run Query'}
              </button>

              <button
                onClick={handleExportCSV}
                disabled={queryResults.length === 0}
                style={{
                  backgroundColor: 'transparent',
                  color: queryResults.length === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '9px 20px',
                  borderRadius: '6px',
                  cursor: queryResults.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                ↓ Download CSV
              </button>
            </div>

            {/* Card 3: Results Grid — fixed height, same reasoning as Card 1.
                AG Grid handles its own internal row scrolling/pagination
                within this box; the page itself scrolls around the whole
                tab if editor + buttons + grid together exceed the viewport. */}
            <div className="ag-theme-alpine" style={{ height: '500px', flexShrink: 0, width: '100%', position: 'relative', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)' }}>
              <AgGridReact theme="legacy" rowData={queryResults} columnDefs={queryColumnDefs} pagination={true} paginationPageSize={100} />
            </div>
          </div>
        )}
      </div>

      {/* Global Error Toast */}
      {queryError && (
        <Toast
          message={queryError}
          type="error"
          onClose={() => setQueryError(null)}
        />
      )}
    </div>
  );
};

export default TableWorkspace;
