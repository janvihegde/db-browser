import React, { useState, useEffect } from 'react';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import Editor from '@monaco-editor/react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import Toast from './Toast.jsx';

const TableWorkspace = ({ db, schema, table, onBack }) => {
  const [activeTab, setActiveTab] = useState(0);

  // Data Preview State
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);

  // Columns Metadata State
  const [columnsData, setColumnsData] = useState([]);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  const [queryResults, setQueryResults] = useState([]);
  const [queryColumnDefs, setQueryColumnDefs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryError, setQueryError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [rowCount, setRowCount] = useState(null);

  // Fetch row count whenever the table changes
  useEffect(() => {
    if (!table) return;
    setRowCount(null);
    api.get(`/database/table/${table}/count`)
      .then(res => setRowCount(res.data.rowCount))
      .catch(err => console.error("Failed to fetch count:", err));
  }, [table]);

  // Fetch data when switching to Preview or Columns tabs
  useEffect(() => {
    if (activeTab === 0) {
      setIsLoading(true);
      api.get(`/database/${schema}/${table}/preview`)
        .then(response => {
          let data = [];
          if (Array.isArray(response.data)) data = response.data;
          else if (response.data && Array.isArray(response.data.rows)) data = response.data.rows;
          else if (response.data && response.data.data && Array.isArray(response.data.data)) data = response.data.data;

          setRowData(data);

          if (data.length > 0) {
            setColumnDefs(Object.keys(data[0]).map(key => ({
              field: key, sortable: true, filter: true, resizable: true
            })));
          } else {
            setColumnDefs([]);
          }
        })
        .catch(err => console.error("Failed to fetch preview:", err))
        .finally(() => setIsLoading(false));

    } else if (activeTab === 1) {
      setIsLoading(true);
      api.get(`/database/table/${table}/columns`)
        .then(response => {
          let colsData = [];
          if (Array.isArray(response.data)) colsData = response.data;
          else if (response.data && Array.isArray(response.data.columns)) colsData = response.data.columns;
          else if (response.data && response.data.data && Array.isArray(response.data.data)) colsData = response.data.data;

          setColumnsData(colsData);
        })
        .catch(err => console.error("Failed to fetch columns:", err))
        .finally(() => setIsLoading(false));
    }
  }, [db, schema, table, activeTab]);

  // Handle SQL Execution (Run Query)
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;

    setIsExecuting(true);
    setQueryError(null);

    try {
      const response = await api.post('/database/query', { sql: sqlQuery });

      let data = [];
      if (Array.isArray(response.data)) data = response.data;
      else if (response.data && Array.isArray(response.data.rows)) data = response.data.rows;
      else if (response.data && response.data.data && Array.isArray(response.data.data)) data = response.data.data;

      setQueryResults(data);

      if (data.length > 0) {
        setQueryColumnDefs(Object.keys(data[0]).map(key => ({
          field: key, sortable: true, filter: true, resizable: true
        })));
      } else {
        setQueryColumnDefs([]);
      }
    } catch (err) {
      console.error("Query execution error:", err);
      setQueryError(err.response?.data?.error || err.message || "An error occurred.");
      setQueryResults([]);
      setQueryColumnDefs([]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Trigger CSV Download
  const handleExportCSV = () => {
    if (!sqlQuery.trim()) return;
    const encodedQuery = encodeURIComponent(sqlQuery);
    const base = api.defaults.baseURL || '';
    const exportUrl = `${base}/database/query/export?sql=${encodedQuery}`;
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
        <Tab label="SQL Editor" />
      </Tabs>

      {/* Tab Content Area */}
      <div style={{ flexGrow: 1, backgroundColor: 'var(--bg-page)', borderRadius: '8px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} sx={{ color: 'var(--accent-indigo)' }} />
          </div>
        ) : activeTab === 0 ? (
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 1 ? (
          <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <AgGridReact rowData={columnsData} columnDefs={metaColumnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
            
            {/* Card 1: SQL Editor */}
            <div style={{ flexShrink: 0, height: '40%', minHeight: '250px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)' }}>
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

            {/* Card 3: Results Grid */}
            <div className="ag-theme-alpine" style={{ flexGrow: 1, minHeight: '300px', width: '100%', position: 'relative', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.08)' }}>
              <AgGridReact rowData={queryResults} columnDefs={queryColumnDefs} pagination={true} paginationPageSize={100} />
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