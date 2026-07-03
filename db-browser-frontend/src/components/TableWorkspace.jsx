import React, { useState, useEffect } from 'react';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import Editor from '@monaco-editor/react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import QueryHistoryList from './QueryHistoryList.jsx';

const TableWorkspace = ({ db, schema, table, onBack }) => {
  const [activeTab, setActiveTab] = useState(0);

  // Data Preview State
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);

  // Columns Metadata State
  const [columnsData, setColumnsData] = useState([]);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM ${schema}."${table}" LIMIT 100;`);
  const [queryResults, setQueryResults] = useState([]);
  const [queryColumnDefs, setQueryColumnDefs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryError, setQueryError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  // Fetch data when switching to Preview or Columns tabs
  useEffect(() => {
    if (activeTab === 0) {
      setIsLoading(true);
      api.get(`/database/${schema}/${table}/preview`)
        .then(response => {
          let data = [];
          if (Array.isArray(response.data)) {
            data = response.data;
          } else if (response.data && Array.isArray(response.data.rows)) {
            data = response.data.rows;
          } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
            data = response.data.data;
          }

          setRowData(data);

          if (data.length > 0) {
            setColumnDefs(Object.keys(data[0]).map(key => ({
              field: key, sortable: true, filter: true, resizable: true
            })));
          } else {
             setColumnDefs([]);
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch preview:", err);
          setIsLoading(false);
        });

    } else if (activeTab === 1) {
      setIsLoading(true);
      api.get(`/database/table/${table}/columns`)
        .then(response => {
           let colsData = [];
           if (Array.isArray(response.data)) {
             colsData = response.data;
           } else if (response.data && Array.isArray(response.data.columns)) {
             colsData = response.data.columns;
           } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
             colsData = response.data.data;
           }

          setColumnsData(colsData);
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch columns:", err);
          setIsLoading(false);
        });
    }
  }, [db, schema, table, activeTab]);

  // Handle SQL Execution
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;

    setIsExecuting(true);
    setQueryError(null);

    try {
      const response = await api.post('/database/query', { sql: sqlQuery });

      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
      } else if (response.data && Array.isArray(response.data.rows)) {
        data = response.data.rows;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        data = response.data.data;
      }

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
      setQueryError(err.response?.data?.error || err.message || "An error occurred while executing the query.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Trigger CSV Download
  const handleExportCSV = () => {
    if (!sqlQuery.trim()) return;
    const encodedQuery = encodeURIComponent(sqlQuery);
    const exportUrl = `http://localhost:5000/api/database/query/export?sql=${encodedQuery}`;
    window.open(exportUrl, '_blank');
  };

  const metaColumnDefs = [
    { field: 'column_name', headerName: 'Column Name', flex: 1, sortable: true, filter: true },
    { field: 'data_type', headerName: 'Data Type', flex: 1, sortable: true, filter: true },
    { field: 'is_nullable', headerName: 'Nullable', flex: 1, sortable: true, filter: true },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease' }}>

      {/* Header Area */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer',
            padding: 0, marginBottom: '12px', fontSize: '0.9rem'
          }}
        >
          ← Back to Tables
        </button>
        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 300, color: '#ffffff' }}>
          {table}
        </h2>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          minHeight: '40px',
          mb: 3,
          borderBottom: '1px solid #262626',
          '& .MuiTab-root': { color: '#a3a3a3', textTransform: 'none', fontSize: '1rem' },
          '& .Mui-selected': { color: '#ffffff !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#3b82f6' }
        }}
      >
        <Tab label="Data Preview" />
        <Tab label="Columns" />
        <Tab label="SQL Editor" />
      </Tabs>

      {/* Tab Content Area */}
      <div style={{ flexGrow: 1, backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden' }}>

        {isLoading && activeTab !== 2 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} sx={{ color: '#3b82f6' }} />
          </div>
        ) : activeTab === 0 ? (
          <div className="ag-theme-alpine-dark" style={{ height: '100%', width: '100%' }}>
            <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 1 ? (
          <div className="ag-theme-alpine-dark" style={{ height: '100%', width: '100%' }}>
            <AgGridReact rowData={columnsData} columnDefs={metaColumnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : (
          /* Tab 2: SQL Editor with History Sidebar */
          <div style={{ display: 'flex', height: '100%' }}>

            {/* NEW: History Panel */}
            <div style={{ width: '250px', borderRight: '1px solid #262626', backgroundColor: '#050505', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #262626', fontSize: '0.9rem', color: '#a3a3a3' }}>Query History</div>
              <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                <QueryHistoryList onSelect={(q) => setSqlQuery(q)} />
              </div>
            </div>

            {/* Main SQL Editor Area */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Top Half: Code Editor */}
              <div style={{ height: '40%', borderBottom: '1px solid #262626', paddingTop: '16px' }}>
                <Editor
                  height="100%"
                  defaultLanguage="sql"
                  theme="vs-dark"
                  value={sqlQuery}
                  onChange={(value) => setSqlQuery(value)}
                  options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }}
                />
              </div>

              {/* Middle Bar: Action Buttons */}
              <div style={{
                padding: '12px 24px',
                backgroundColor: '#111111',
                borderBottom: '1px solid #262626',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                <button
                  onClick={handleRunQuery}
                  disabled={isExecuting}
                  style={{
                    backgroundColor: isExecuting ? '#1e3a8a' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 24px',
                    borderRadius: '4px',
                    cursor: isExecuting ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isExecuting ? 'Executing...' : '▶ Run Query'}
                </button>

                <button
                  onClick={handleExportCSV}
                  disabled={queryResults.length === 0}
                  style={{
                    backgroundColor: queryResults.length === 0 ? '#171717' : '#059669',
                    color: queryResults.length === 0 ? '#525252' : '#ffffff',
                    border: '1px solid',
                    borderColor: queryResults.length === 0 ? '#262626' : '#059669',
                    padding: '7px 20px',
                    borderRadius: '4px',
                    cursor: queryResults.length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500
                  }}
                >
                  ↓ Download CSV
                </button>

                {queryError && (
                  <div style={{ color: '#ef4444', fontSize: '0.9rem', fontFamily: 'monospace', marginLeft: 'auto' }}>
                    <strong>Error:</strong> {queryError}
                  </div>
                )}
              </div>

              {/* Bottom Half: Results Grid */}
              <div className="ag-theme-alpine-dark" style={{ flexGrow: 1, minHeight: '300px', width: '100%' }}>
                <AgGridReact
                  rowData={queryResults}
                  columnDefs={queryColumnDefs}
                  pagination={true}
                  paginationPageSize={100}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableWorkspace;