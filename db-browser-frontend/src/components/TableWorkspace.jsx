import React, { useState, useEffect } from 'react';
import { Tabs, Tab, CircularProgress } from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import Editor from '@monaco-editor/react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../services/api';
import { dbClient } from '../services/dbClient';
import Toast from './Toast.jsx';

const TableWorkspace = ({ connectionId, db, schema, table, onBack }) => {
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

  // Helper function to format dates
const formatToYYMMDD = (params) => {
  if (!params.value) return params.value;

 // Helper function to format dates to YYYY-MM-DD
  const formatToYYMMDD = (params) => {
    if (!params.value) return params.value;

    let date;

    // 1. Check if the database driver already parsed it into a JavaScript Date object
    if (params.value instanceof Date) {
      date = params.value;
    } 
    // 2. Or, check if it is an ISO date string
    else if (typeof params.value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(params.value)) {
      date = new Date(params.value);
    }

    // If we successfully captured a valid date, format it
    if (date && !isNaN(date.getTime())) {
      const yyyy = date.getFullYear(); // REMOVED the .slice(-2) to keep all 4 digits
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      
      return `${yyyy}-${mm}-${dd}`;
    }
    
    // Return original value if it's not a recognized date format
    return params.value;
  };
  
  // Return original value if it's not a date
  return params.value;
};

  // Fetch row count whenever the table changes
  useEffect(() => {
    if (!db || !schema || !table) return;
    setRowCount(null);
    dbClient.getRowCount(connectionId, db, schema, table)
      .then(count => setRowCount(count))
      .catch(err => console.error("Failed to fetch count:", err));
  }, [connectionId, db, schema, table]);

  // Fetch data when switching tabs
  useEffect(() => {
    if (!db || !schema || !table) return;

    if (activeTab === 0) {
      setIsLoading(true);
      dbClient.previewTable(connectionId, db, schema, table)
        .then(data => {
          data = Array.isArray(data) ? data : [];
          setRowData(data);

          if (data.length > 0) {
           // Find where you map your column definitions (it likely looks something like this):
const dynamicColumns = Object.keys(data[0]).map(key => ({
  field: key,
  headerName: key,
  // Add the value formatter here to apply to all columns
  valueFormatter: formatToYYMMDD, 
  filter: true // (Keeping the search filter off as we did previously)
}));

// Then set your columnDefs state
setColumnDefs(dynamicColumns);
          }
        })
        .catch(err => console.error("Failed to fetch preview:", err))
        .finally(() => setIsLoading(false));

    } else if (activeTab === 1) {
      setIsLoading(true);
      dbClient.listColumns(connectionId, db, schema, table)
        .then(colsData => {
          setColumnsData(Array.isArray(colsData) ? colsData : []);
        })
        .catch(err => console.error("Failed to fetch columns:", err))
        .finally(() => setIsLoading(false));

    } else if (activeTab === 2) {
      setIsLoading(true);
      dbClient.getRelationships(connectionId, db, schema, table)
        .then(data => {
          setRelationships({
            outgoing: data.outgoing || [],
            incoming: data.incoming || []
          });
        })
        .catch(err => console.error("Failed to fetch relationships:", err))
        .finally(() => setIsLoading(false));
    }
  }, [connectionId, db, schema, table, activeTab]);

  // Handle SQL Execution (Run Query)
  // Handle SQL Execution (Run Query)
  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;

    setIsExecuting(true);
    setQueryError(null);

    try {
      const data = await dbClient.runQuery(connectionId, db, sqlQuery);
      const rows = Array.isArray(data) ? data : [];

      setQueryResults(rows);

      if (rows.length > 0) {
        // UPDATE IS HERE: Apply the formatter and turn off the filter
        setQueryColumnDefs(Object.keys(rows[0]).map(key => ({
          field: key, 
          headerName: key,
          sortable: true, 
          filter: true, 
          resizable: true,
          valueFormatter: formatToYYMMDD // Apply the date fix to query results!
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
    if (dbClient.isLocalId(connectionId)) {
      setQueryError('CSV export isn\'t supported yet for local connections.');
      return;
    }
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