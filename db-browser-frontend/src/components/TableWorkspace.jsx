import React, { useState, useEffect } from 'react';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import Editor from '@monaco-editor/react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import QueryHistoryList from './QueryHistoryList.jsx';
import ERDiagram from './ERDiagram';
import VisualQueryBuilder from './VisualQueryBuilder.jsx';
import Toast from './Toast.jsx';

// Helper function to translate Postgres EXPLAIN into plain English
const simplifyExplainPlan = (rawPlan) => {
  if (!rawPlan) return [];
  const lines = rawPlan.split('\n');
  const simpleSteps = [];

  lines.forEach(line => {
    const text = line.trim();
    if (text.startsWith('Execution Time:')) {
      simpleSteps.push(`⏱️ ${text}`);
    } else if (text.startsWith('Planning Time:')) {
      simpleSteps.push(`🧠 ${text}`);
    } else if (text.includes('Seq Scan on')) {
      const match = text.match(/Seq Scan on (\w+)/);
      const table = match ? match[1] : 'a table';
      simpleSteps.push(`📖 Searched every single row in the '${table}' table (Sequential Scan). This can be slow for large tables.`);
    } else if (text.includes('Index Scan using')) {
      const match = text.match(/Index Scan using (\w+) on (\w+)/);
      const index = match ? match[1] : 'an index';
      const table = match ? match[2] : 'a table';
      simpleSteps.push(`⚡ Quickly looked up data in '${table}' using the '${index}' index.`);
    } else if (text.includes('Hash Join')) {
      simpleSteps.push(`🔗 Combined two sets of data together using a Hash Join.`);
    } else if (text.includes('Nested Loop')) {
      simpleSteps.push(`🔄 Matched rows one-by-one between two tables (Nested Loop).`);
    } else if (text.includes('Aggregate')) {
      simpleSteps.push(`🧮 Calculated a summary result (like COUNT, SUM, or AVG).`);
    } else if (text.includes('Sort')) {
      simpleSteps.push(`🔀 Sorted the data before returning it.`);
    } else if (text.includes('Limit')) {
      simpleSteps.push(`✂️ Restricted the number of rows returned.`);
    }
  });

  return simpleSteps.length > 0 ? simpleSteps : ["Could not translate this specific plan."];
};

const TableWorkspace = ({ db, schema, table, onBack }) => {
  const [activeTab, setActiveTab] = useState(0);

  // Data Preview State
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);

  // Columns Metadata State
  const [columnsData, setColumnsData] = useState([]);

  // Query explanation state
  const [explainPlan, setExplainPlan] = useState(null);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`);
  const [queryResults, setQueryResults] = useState([]);
  const [queryColumnDefs, setQueryColumnDefs] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryError, setQueryError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Row Count State
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

  // Handle SQL Execution (Run Query)
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;

    setIsExecuting(true);
    setQueryError(null);
    setExplainPlan(null);

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

  // Handle EXPLAIN ANALYZE Execution
  const handleExplainQuery = async () => {
    if (!sqlQuery.trim()) return;

    setIsExecuting(true);
    setQueryError(null);
    setExplainPlan(null);

    try {
      const cleanQuery = sqlQuery.trim().replace(/;$/, '');
      const response = await api.post('/database/query', { sql: `EXPLAIN ANALYZE ${cleanQuery}` });

      let data = [];
      if (Array.isArray(response.data)) data = response.data;
      else if (response.data && Array.isArray(response.data.rows)) data = response.data.rows;
      else if (response.data && response.data.data && Array.isArray(response.data.data)) data = response.data.data;

      if (data.length > 0) {
        const planKey = Object.keys(data[0])[0];
        const planText = data.map(row => row[planKey]).join('\n');
        setExplainPlan(planText);
      }
    } catch (err) {
      console.error("Explain execution error:", err);
      setQueryError(err.response?.data?.error || err.message || "An error occurred.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Trigger CSV Download
  const handleExportCSV = () => {
    if (!sqlQuery.trim()) return;
    const encodedQuery = encodeURIComponent(sqlQuery);
    // Use the same base URL as the shared api client instead of a hardcoded host,
    // so this keeps working outside local dev (staging/prod).
    const base = api.defaults.baseURL || '';
    const exportUrl = `${base}/database/query/export?sql=${encodedQuery}`;
    window.open(exportUrl, '_blank');
  };

  // Save the current editor contents as a named saved query
  const handleSaveQuery = async () => {
    if (!sqlQuery.trim()) return;
    const name = window.prompt('Name this query:');
    if (!name) return;

    setIsSaving(true);
    try {
      await api.post('/queries/saved', { name, sql: sqlQuery });
    } catch (err) {
      console.error("Failed to save query:", err);
      setQueryError(err.response?.data?.error || err.message || "Failed to save query.");
    } finally {
      setIsSaving(false);
    }
  };

  const metaColumnDefs = [
    { field: 'column_name', headerName: 'Column Name', flex: 1, sortable: true, filter: true },
    { field: 'data_type', headerName: 'Data Type', flex: 1, sortable: true, filter: true },
    {
      field: 'is_primary_key',
      headerName: 'PK',
      width: 100,
      cellRenderer: (params) => params.value ? '🔑 Yes' : ''
    },
    {
      field: 'is_foreign_key',
      headerName: 'FK',
      width: 100,
      cellRenderer: (params) => params.value ? '🔗 Yes' : ''
    },
    { field: 'is_nullable', headerName: 'Nullable', width: 120, sortable: true, filter: true },
    { field: 'column_default', headerName: 'Default Value', flex: 1, sortable: true, filter: true },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease' }}>

      {/* Header Area */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, marginBottom: '12px', fontSize: '0.9rem' }}
        >
          ← Back to Tables
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 300, color: '#ffffff' }}>{table}</h2>
          {rowCount !== null && (
            <span style={{ color: '#a3a3a3', fontSize: '1.1rem', backgroundColor: '#171717', padding: '4px 12px', borderRadius: '16px', border: '1px solid #262626' }}>
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
          minHeight: '40px', mb: 3, borderBottom: '1px solid #262626',
          '& .MuiTab-root': { color: '#a3a3a3', textTransform: 'none', fontSize: '1rem' },
          '& .Mui-selected': { color: '#ffffff !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#3b82f6' }
        }}
      >
        <Tab label="Data Preview" />
        <Tab label="Columns" />
        <Tab label="SQL Editor" />
        <Tab label="ER Diagram" />
        <Tab label="Visual Builder" />
      </Tabs>

      {/* Tab Content Area */}
      <div style={{ flexGrow: 1, backgroundColor: '#000000', borderRadius: '8px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={32} sx={{ color: '#3b82f6' }} />
          </div>
        ) : activeTab === 0 ? (
          <div className="ag-theme-alpine-dark" style={{ height: '100%', width: '100%', border: '1px solid #262626', borderRadius: '8px' }}>
            <AgGridReact rowData={rowData} columnDefs={columnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 1 ? (
          <div className="ag-theme-alpine-dark" style={{ height: '100%', width: '100%', border: '1px solid #262626', borderRadius: '8px' }}>
            <AgGridReact rowData={columnsData} columnDefs={metaColumnDefs} pagination={true} paginationPageSize={100} />
          </div>
        ) : activeTab === 2 ? (
          /* Tab 2: SQL Editor with History Sidebar */
          <div style={{ display: 'flex', height: '100%', backgroundColor: '#000000' }}>

            {/* Left: Query History Sidebar */}
            <div style={{ width: '250px', borderRight: '1px solid #262626', backgroundColor: '#0a0a0a', display: 'flex', flexDirection: 'column', borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #262626', fontSize: '0.9rem', color: '#e5e5e5', fontWeight: 600 }}>
                Query History
              </div>
              <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                <QueryHistoryList onSelect={(q) => setSqlQuery(q)} />
              </div>
            </div>

            {/* Right: Editor Workspace */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, padding: '20px', gap: '20px', overflowY: 'auto' }}>

              {/* Card 1: SQL Editor */}
              <div style={{ flexShrink: 0, height: '40%', minHeight: '250px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ padding: '8px 16px', backgroundColor: '#111111', borderBottom: '1px solid #262626', fontSize: '0.75rem', fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  Query Editor
                </div>

                {/* Monaco Editor Container */}
                <div style={{ flexGrow: 1, position: 'relative' }}>
                  <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme="vs-dark"
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
              <div style={{ flexShrink: 0, padding: '16px 24px', backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <button onClick={handleRunQuery} disabled={isExecuting} style={{ backgroundColor: isExecuting ? '#1e3a8a' : '#2563eb', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: isExecuting ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'background-color 0.2s' }}>
                  {isExecuting ? 'Executing...' : '▶ Run Query'}
                </button>

                <button onClick={handleExplainQuery} disabled={isExecuting} style={{ backgroundColor: '#4c1d95', color: '#ffffff', border: '1px solid #7c3aed', padding: '9px 20px', borderRadius: '6px', cursor: isExecuting ? 'not-allowed' : 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>
                  ⚡ Explain Plan
                </button>


                <button onClick={handleExportCSV} disabled={queryResults.length === 0} style={{ backgroundColor: queryResults.length === 0 ? '#171717' : '#059669', color: queryResults.length === 0 ? '#525252' : '#ffffff', border: '1px solid', borderColor: queryResults.length === 0 ? '#262626' : '#059669', padding: '9px 20px', borderRadius: '6px', cursor: queryResults.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 500, transition: 'all 0.2s' }}>
                  ↓ Download CSV
                </button>
              </div>

              {/* Card 3: Results Grid OR Explain Plan Output */}
              <div className="ag-theme-alpine-dark" style={{ flexShrink: 0, height: '400px', width: '100%', position: 'relative', border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {explainPlan ? (
                  <div style={{ padding: '24px', backgroundColor: '#0a0a0a', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span style={{ color: '#a855f7', fontWeight: 600, fontSize: '1.2rem' }}>Query Execution Explained</span>
                      <button onClick={() => setExplainPlan(null)} style={{ background: '#262626', border: 'none', color: '#e5e5e5', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>✕ Close</button>
                    </div>

                    <div style={{ padding: '20px', backgroundColor: '#171717', border: '1px solid #7c3aed', borderRadius: '8px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {simplifyExplainPlan(explainPlan).map((step, idx) => (
                        <div key={idx} style={{ color: '#e5e5e5', fontSize: '1.05rem', lineHeight: '1.6' }}>{step}</div>
                      ))}
                    </div>

                    <span style={{ color: '#525252', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw Postgres Output</span>
                    <pre style={{ margin: 0, padding: '16px', backgroundColor: '#000', border: '1px solid #262626', borderRadius: '6px', color: '#a3a3a3', fontFamily: 'monospace', fontSize: '12px', overflowX: 'auto', lineHeight: '1.5' }}>
                      {explainPlan}
                    </pre>
                  </div>
                ) : (
                  <AgGridReact rowData={queryResults} columnDefs={queryColumnDefs} pagination={true} paginationPageSize={100} />
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 3 ? (
          <div style={{ border: '1px solid #262626', borderRadius: '8px', height: '100%', overflow: 'hidden' }}>
            <ERDiagram />
          </div>
        
        ) : (
  /* activeTab === 4: Visual Query Builder */
  <div style={{ border: '1px solid #262626', borderRadius: '8px', height: '100%', overflow: 'hidden' }}>
    <VisualQueryBuilder
      onGenerateSql={(sql) => {
        setSqlQuery(sql);
        setActiveTab(2); // Jump back to SQL Editor
      }}
    />
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