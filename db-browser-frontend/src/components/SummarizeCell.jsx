import React, { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { dbClient } from '../services/dbClient';

// Postgres type name -> which aggregate functions make sense for it.
// Kept as substring-tolerant checks since Postgres reports things like
// "timestamp without time zone", not just "timestamp".
export function getAvailableFunctions(dataType) {
  const type = (dataType || '').toLowerCase();
  const isNumeric = /int|numeric|decimal|real|double|float|serial/.test(type);
  const isDateLike = /timestamp|date|time/.test(type);
  const isUnorderable = /json|array|bytea/.test(type); // MIN/MAX aren't defined for these in Postgres

  const functions = [
    { key: 'count', label: 'Count of rows' },
    { key: 'count_distinct', label: 'Count of distinct values' },
  ];

  if (isNumeric) {
    functions.push(
      { key: 'sum', label: 'Sum' },
      { key: 'avg', label: 'Average (Mean)' },
      { key: 'median', label: 'Median' },
      { key: 'min', label: 'Min' },
      { key: 'max', label: 'Max' },
    );
  } else if (isDateLike) {
    functions.push(
      { key: 'min', label: 'Earliest' },
      { key: 'max', label: 'Latest' },
    );
  } else if (!isUnorderable) {
    functions.push(
      { key: 'min', label: 'Min' },
      { key: 'max', label: 'Max' },
    );
  }

  return functions;
}

export function buildSummarizeSql(functionKey, schema, table, column) {
  const qualifiedTable = `"${schema}"."${table}"`;
  const qualifiedColumn = `"${column}"`;
  switch (functionKey) {
    case 'count': return `SELECT COUNT(${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'count_distinct': return `SELECT COUNT(DISTINCT ${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'sum': return `SELECT SUM(${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'avg': return `SELECT AVG(${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'median': return `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'min': return `SELECT MIN(${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    case 'max': return `SELECT MAX(${qualifiedColumn}) AS result FROM ${qualifiedTable};`;
    default: throw new Error(`Unknown summarize function: ${functionKey}`);
  }
}

// Postgres often returns aggregates (especially SUM/AVG on bigint/numeric)
// as strings to avoid JS float precision loss - format them back to
// readable numbers where that's clearly what they are.
export function formatResultValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
    const num = Number(value);
    if (Number.isFinite(num)) return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

const SummarizeCell = ({ connectionId, db, schema, table, column, dataType }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null); // { label, value } | { label, error }

  const functions = getAvailableFunctions(dataType);

  const handleChange = async (e) => {
    const key = e.target.value;
    e.target.value = ''; // reset the select back to placeholder after each run
    if (!key) return;

    const fn = functions.find((f) => f.key === key);
    setIsRunning(true);
    setResult(null);
    try {
      const sql = buildSummarizeSql(key, schema, table, column);
      const rows = await dbClient.runQuery(connectionId, db, sql);
      setResult({ label: fn.label, value: rows?.[0]?.result });
    } catch (err) {
      setResult({ label: fn.label, error: err.message || 'Failed to run.' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', overflow: 'hidden' }}>
      <select
        defaultValue=""
        onChange={handleChange}
        disabled={isRunning}
        style={{
          fontSize: '0.8rem',
          padding: '3px 6px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-page)',
          color: 'var(--text-primary)',
          flexShrink: 0,
        }}
      >
        <option value="" disabled>Summarize...</option>
        {functions.map((fn) => (
          <option key={fn.key} value={fn.key}>{fn.label}</option>
        ))}
      </select>

      {isRunning && <CircularProgress size={14} sx={{ color: 'var(--accent-indigo)' }} />}

      {result && !isRunning && (
        result.error ? (
          <span
            title={result.error}
            style={{ color: '#ef4444', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {result.label}: error
          </span>
        ) : (
          <span
            title={`${result.label}: ${formatResultValue(result.value)}`}
            style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {result.label}: {formatResultValue(result.value)}
          </span>
        )
      )}
    </div>
  );
};

export default SummarizeCell;