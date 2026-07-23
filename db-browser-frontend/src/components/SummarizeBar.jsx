import React, { useState, useMemo } from 'react';
import { CircularProgress } from '@mui/material';
import { dbClient } from '../services/dbClient';
import { getAvailableFunctions, buildSummarizeSql, formatResultValue } from './SummarizeCell.jsx';

const selectStyle = {
  fontSize: '0.85rem',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-page)',
  color: 'var(--text-primary)',
};

const SummarizeBar = ({ connectionId, db, schema, table, columns }) => {
  const [selectedColumn, setSelectedColumn] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null); // { label, value } | { label, error }

  const availableFunctions = useMemo(() => {
    if (!selectedColumn) return [];
    const col = columns.find((c) => c.column_name === selectedColumn);
    return getAvailableFunctions(col?.data_type);
  }, [selectedColumn, columns]);

  const handleColumnChange = (e) => {
    setSelectedColumn(e.target.value);
    setResult(null);
  };

  const handleFunctionChange = async (e) => {
    const key = e.target.value;
    e.target.value = ''; // reset back to placeholder after each run
    if (!key) return;

    const fn = availableFunctions.find((f) => f.key === key);
    setIsRunning(true);
    setResult(null);
    try {
      const sql = buildSummarizeSql(key, schema, table, selectedColumn);
      const rows = await dbClient.runQuery(connectionId, db, sql);
      setResult({ label: fn.label, value: rows?.[0]?.result });
    } catch (err) {
      setResult({ label: fn.label, error: err.message || 'Failed to run.' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        marginBottom: '12px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Summarize</span>

      <select value={selectedColumn} onChange={handleColumnChange} style={selectStyle}>
        <option value="" disabled>Choose a column...</option>
        {columns.map((c) => (
          <option key={c.column_name} value={c.column_name}>{c.column_name}</option>
        ))}
      </select>

      <select
        defaultValue=""
        onChange={handleFunctionChange}
        disabled={!selectedColumn || isRunning}
        style={selectStyle}
      >
        <option value="" disabled>Choose a function...</option>
        {availableFunctions.map((fn) => (
          <option key={fn.key} value={fn.key}>{fn.label}</option>
        ))}
      </select>

      {isRunning && <CircularProgress size={16} sx={{ color: 'var(--accent-indigo)' }} />}

      {result && !isRunning && (
        result.error ? (
          <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>{result.label}: {result.error}</span>
        ) : (
          <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
            {result.label} of {selectedColumn}: {formatResultValue(result.value)}
          </span>
        )
      )}
    </div>
  );
};

export default SummarizeBar;