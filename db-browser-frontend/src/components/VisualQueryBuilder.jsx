import React, { useState, useEffect } from 'react';
import api from '../services/api';

const PG_FUNCTIONS = {
  None: [''],
  Aggregate: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'],
  String: ['UPPER', 'LOWER', 'TRIM', 'LENGTH'],
  Math: ['ROUND', 'CEIL', 'FLOOR', 'ABS'],
  Date: ['DATE', 'EXTRACT(YEAR FROM', 'EXTRACT(MONTH FROM']
};

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL'];

const VisualQueryBuilder = ({ onGenerateSql, currentSchema = 'public' }) => {
  const [queryMode, setQueryMode] = useState('SELECT'); // 'SELECT' or 'INSERT'
  const [availableTables, setAvailableTables] = useState([]);
  const [canvasTables, setCanvasTables] = useState([]); 
  const [tableColumns, setTableColumns] = useState({});
  
  // SQL Clause States
  const [joins, setJoins] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [whereFilters, setWhereFilters] = useState([]); 
  const [insertData, setInsertData] = useState({}); // Stores data for INSERT mode

  const [generatedSql, setGeneratedSql] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // 1. Fetch live tables
  useEffect(() => {
    const fetchRealTables = async () => {
      try {
        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${currentSchema}' AND table_type = 'BASE TABLE' ORDER BY table_name;`;
        const res = await api.post('/database/query', { sql: query });
        const data = Array.isArray(res.data) ? res.data : (res.data.rows || res.data.data || []);
        setAvailableTables(data.map(row => row.table_name));
      } catch (err) {
        console.error("Failed to fetch tables", err);
      }
    };
    fetchRealTables();
  }, [currentSchema]);

  const fetchTableColumns = async (tableName) => {
    if (tableColumns[tableName]) return;
    try {
      const res = await api.get(`/database/table/${tableName}/columns`);
      const cols = Array.isArray(res.data) ? res.data : (res.data.columns || res.data.data || []);
      setTableColumns(prev => ({ ...prev, [tableName]: cols.map(c => c.column_name) }));
    } catch (err) {
      console.error(`Failed to fetch columns for ${tableName}`, err);
    }
  };

  // --- Drag and Drop ---
  const handleDragStart = (e, tableName) => e.dataTransfer.setData('tableName', tableName);
  const handleDragOver = (e) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const tableName = e.dataTransfer.getData('tableName');
    if (!tableName || canvasTables.includes(tableName)) return;

    // INSERT mode only allows one table
    if (queryMode === 'INSERT' && canvasTables.length >= 1) {
      setCanvasTables([tableName]);
    } else {
      setCanvasTables([...canvasTables, tableName]);
    }
    fetchTableColumns(tableName);
  };

  const removeTable = (tableName) => {
    setCanvasTables(canvasTables.filter(t => t !== tableName));
    setJoins(joins.filter(j => j.fromTable !== tableName && j.toTable !== tableName));
    setSelectedColumns(selectedColumns.filter(c => c.table !== tableName));
    setWhereFilters(whereFilters.filter(w => w.table !== tableName));
  };

  // --- Clause Managers ---
  const addJoin = () => setJoins([...joins, { type: 'INNER JOIN', fromTable: canvasTables[0], fromCol: '', toTable: canvasTables[1] || canvasTables[0], toCol: '' }]);
  const updateJoin = (index, field, value) => setJoins(joins.map((j, i) => i === index ? { ...j, [field]: value } : j));
  const removeJoin = (index) => setJoins(joins.filter((_, i) => i !== index));

  const addColumn = () => setSelectedColumns([...selectedColumns, { table: canvasTables[0], column: '*', func: '' }]);
  const updateColumn = (index, field, value) => setSelectedColumns(selectedColumns.map((c, i) => i === index ? { ...c, [field]: value } : c));
  const removeColumn = (index) => setSelectedColumns(selectedColumns.filter((_, i) => i !== index));

  const addWhere = () => setWhereFilters([...whereFilters, { table: canvasTables[0], column: '', operator: '=', value: '', logic: 'AND' }]);
  const updateWhere = (index, field, value) => setWhereFilters(whereFilters.map((w, i) => i === index ? { ...w, [field]: value } : w));
  const removeWhere = (index) => setWhereFilters(whereFilters.filter((_, i) => i !== index));

  // --- SQL Generation Engine ---
  useEffect(() => {
    if (canvasTables.length === 0) {
      setGeneratedSql('');
      return;
    }

    if (queryMode === 'INSERT') {
      const table = canvasTables[0];
      const columns = Object.keys(insertData).filter(k => insertData[k]);
      if (columns.length === 0) {
        setGeneratedSql(`-- Fill out the form to generate INSERT for ${table}`);
        return;
      }
      const vals = columns.map(c => {
        const val = insertData[c];
        return isNaN(val) ? `'${val}'` : val; // Auto-quote strings
      });
      setGeneratedSql(`INSERT INTO "${table}" ("${columns.join('", "')}") \nVALUES (${vals.join(', ')});`);
      return;
    }

    // --- SELECT MODE BUILDER ---
    let selectClause = 'SELECT *';
    let isAggregating = false;
    let groupBys = [];

    // 1. Selects & Functions
    if (selectedColumns.length > 0) {
      const selects = selectedColumns.map(c => {
        const colStr = c.column === '*' ? '*' : `"${c.table}"."${c.column}"`;
        if (!c.func) {
          groupBys.push(colStr);
          return colStr;
        }
        isAggregating = true;
        if (c.func.includes('EXTRACT')) return `${c.func} ${colStr}) AS "${c.func.split('(')[0]}_${c.column}"`;
        return `${c.func}(${colStr}) AS "${c.func}_${c.column}"`;
      });
      selectClause = `SELECT \n  ${selects.join(', \n  ')}`;
    }

    // 2. From & Joins
    let fromClause = `FROM "${canvasTables[0]}"`;
    joins.forEach(j => {
      if (j.fromTable && j.fromCol && j.toTable && j.toCol) {
        fromClause += `\n${j.type} "${j.toTable}" \n  ON "${j.fromTable}"."${j.fromCol}" = "${j.toTable}"."${j.toCol}"`;
      }
    });

    // 3. Where Clause
    let whereClause = '';
    if (whereFilters.length > 0) {
      const validFilters = whereFilters.filter(w => w.column && w.operator);
      if (validFilters.length > 0) {
        const conditions = validFilters.map((w, idx) => {
          const prefix = idx === 0 ? '' : `${w.logic} `;
          const val = (w.operator.includes('NULL')) ? '' : (isNaN(w.value) ? `'${w.value}'` : w.value);
          return `${prefix}"${w.table}"."${w.column}" ${w.operator} ${val}`;
        });
        whereClause = `\nWHERE \n  ${conditions.join('\n  ')}`;
      }
    }

    // 4. Group By
    let groupByClause = '';
    if (isAggregating && groupBys.length > 0 && groupBys.some(g => g !== '*')) {
      groupByClause = `\nGROUP BY \n  ${groupBys.filter(g => g !== '*').join(', ')}`;
    }

    setGeneratedSql(`${selectClause} \n${fromClause}${whereClause}${groupByClause};`);
  }, [canvasTables, joins, selectedColumns, whereFilters, insertData, queryMode]);

  return (
    <div style={{ display: 'flex', height: '100%', color: 'var(--text-primary)' }}>

      {/* Left Sidebar */}
      <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--accent-purple)' }}>Actual DB Tables</div>
        <div style={{ padding: '16px', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableTables.map(table => (
            <div 
              key={table} draggable onDragStart={(e) => handleDragStart(e, table)}
              style={{ padding: '10px 14px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'grab', fontSize: '0.9rem' }}
            >
              ⠿ {table}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', overflowY: 'auto' }}>
        
        {/* Mode Toggle & Canvas */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: isDraggingOver ? 'rgba(139, 92, 246, 0.08)' : 'transparent', transition: 'all 0.2s', minHeight: '200px' }}
             onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setQueryMode('SELECT')} style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: queryMode === 'SELECT' ? 'var(--accent-purple)' : 'var(--border-color)', color: '#fff', cursor: 'pointer' }}>SELECT (Analytics)</button>
            <button onClick={() => setQueryMode('INSERT')} style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: queryMode === 'INSERT' ? 'var(--accent-green)' : 'var(--border-color)', color: '#fff', cursor: 'pointer' }}>INSERT (Add Data)</button>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {canvasTables.length === 0 ? (
              <div style={{ width: '100%', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                Drag {queryMode === 'INSERT' ? 'a table' : 'tables'} here from the sidebar
              </div>
            ) : (
              canvasTables.map(table => (
                <div key={table} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent-purple)', borderRadius: '8px', minWidth: '150px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    {table} <button onClick={() => removeTable(table)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- INSERT DATA FORM --- */}
        {queryMode === 'INSERT' && canvasTables.length > 0 && (
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--accent-green)' }}>Insert Data into {canvasTables[0]}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {(tableColumns[canvasTables[0]] || []).map(col => (
                <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{col}</label>
                  <input 
                    type="text" 
                    placeholder={`Value for ${col}...`}
                    onChange={(e) => setInsertData({ ...insertData, [col]: e.target.value })}
                    style={{ padding: '8px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- SELECT BUILDER BLOCKS --- */}
        {queryMode === 'SELECT' && canvasTables.length > 0 && (
          <>
            {/* JOINS */}
            {canvasTables.length > 1 && (
              <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                 {/* Join UI identical to previous version goes here. Omitted for brevity in text, but active in code structure */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-purple)' }}>Joins</h3>
                  <button onClick={addJoin} style={{ padding: '6px 12px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Join</button>
                </div>
                {joins.map((join, index) => (
                  <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                     <select value={join.fromTable} onChange={e => updateJoin(index, 'fromTable', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      {canvasTables.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={join.fromCol} onChange={e => updateJoin(index, 'fromCol', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      {(tableColumns[join.fromTable] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span style={{color: 'var(--accent-purple)', alignSelf: 'center', fontWeight: 'bold'}}>=</span>
                    <select value={join.toTable} onChange={e => updateJoin(index, 'toTable', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      {canvasTables.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={join.toCol} onChange={e => updateJoin(index, 'toCol', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      {(tableColumns[join.toTable] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => removeJoin(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* COLUMNS & FUNCTIONS */}
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-purple)' }}>Select & Functions</h3>
                <button onClick={addColumn} style={{ padding: '6px 12px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Column</button>
              </div>
              {selectedColumns.map((col, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <select value={col.func} onChange={e => updateColumn(index, 'func', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--accent-purple)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                    <option value="">No Function</option>
                    {Object.entries(PG_FUNCTIONS).map(([group, funcs]) => (
                      group !== 'None' && <optgroup key={group} label={group}>{funcs.map(f => <option key={f} value={f}>{f}</option>)}</optgroup>
                    ))}
                  </select>
                  <select value={col.table} onChange={e => updateColumn(index, 'table', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    {canvasTables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={col.column} onChange={e => updateColumn(index, 'column', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    <option value="*">* (All Columns)</option>
                    {(tableColumns[col.table] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => removeColumn(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                </div>
              ))}
            </div>

            {/* WHERE FILTERS */}
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-purple)' }}>Filters (WHERE)</h3>
                <button onClick={addWhere} style={{ padding: '6px 12px', backgroundColor: 'var(--accent-purple)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Add Filter</button>
              </div>
              {whereFilters.map((w, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  {index > 0 && (
                    <select value={w.logic} onChange={e => updateWhere(index, 'logic', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--accent-purple)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  <select value={w.table} onChange={e => updateWhere(index, 'table', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    {canvasTables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={w.column} onChange={e => updateWhere(index, 'column', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    <option value="">Select Column...</option>
                    {(tableColumns[w.table] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={w.operator} onChange={e => updateWhere(index, 'operator', e.target.value)} style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--accent-purple)', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
                    {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {!w.operator.includes('NULL') && (
                    <input 
                      type="text" placeholder="Value..." value={w.value} onChange={e => updateWhere(index, 'value', e.target.value)}
                      style={{ padding: '6px', background: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', flexGrow: 1 }}
                    />
                  )}
                  <button onClick={() => removeWhere(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SQL Output Area */}
        <div style={{ padding: '24px', backgroundColor: 'var(--bg-main)', minHeight: '150px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, color: queryMode === 'INSERT' ? 'var(--accent-green)' : 'var(--accent-purple)' }}>Generated {queryMode} SQL</span>
            <button 
              onClick={() => onGenerateSql(generatedSql)}
              style={{ padding: '6px 16px', backgroundColor: queryMode === 'INSERT' ? 'var(--accent-green)' : 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Open in Editor
            </button>
          </div>
          <pre style={{ margin: 0, padding: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {generatedSql || '-- Drag a table onto the canvas'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default VisualQueryBuilder;