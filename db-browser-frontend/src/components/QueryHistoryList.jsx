import React, { useEffect, useState, useMemo } from 'react';
import { List, ListItemButton, ListItemText, TextField, Box, Typography } from '@mui/material';
import api from '../services/api';

const QueryHistoryList = ({ onSelect }) => {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.get('/database/query/history')
      .then(res => setHistory(res.data.history || []))
      .catch(err => console.error("History fetch error", err));
  }, []);

  // Filter logic: Filter queries by text content
  const filteredHistory = useMemo(() => {
    return history.filter(item => 
      (item.sql_text || '').toLowerCase().includes(filter.toLowerCase())
    );
  }, [history, filter]);

  // Summarize logic: Extract the first keyword (SELECT, INSERT, etc.)
  const getSummary = (sql) => {
    if (!sql) return 'Empty Query';
    const s = sql.toLowerCase();
    
    // Extracting the table name if possible
    const tableMatch = sql.match(/from\s+["']?([a-zA-Z0-9_.]+)/i);
    const tableName = tableMatch ? tableMatch[1] : 'records';

    // Intent-based mapping with references
    if (s.includes('join')) return `Merging ${tableName} with reference records`;
    if (s.includes('group by')) return `Summarizing ${tableName} by category`;
    if (s.includes('order by')) return `Sorting ${tableName} records`;
    if (s.includes('where')) return `Filtering ${tableName} reference records`;
    if (s.includes('count(')) return `Counting total ${tableName}`;
    if (s.includes('avg(')) return `Calculating average ${tableName} data`;
    if (s.includes('select *')) return `Viewing full ${tableName} records`;
    
    return `Accessing ${tableName} data`;
  };

  return (
    <Box sx={{ p: 2 }}>
      <TextField 
        placeholder="Filter queries..." 
        size="small" 
        fullWidth
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        sx={{
          mb: 2,
          input: { color: 'var(--text-primary)' },
          '& .MuiInputBase-input::placeholder': { color: 'var(--text-secondary)', opacity: 1 },
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'var(--border-color)' },
            '&:hover fieldset': { borderColor: 'var(--accent-indigo)' },
            '&.Mui-focused fieldset': { borderColor: 'var(--accent-indigo)' }
          }
        }}
      />
      
      <List>
        {filteredHistory.map((item, index) => {
          const sqlString = item.sql_text || '';
          return (
            <ListItemButton 
              key={index} 
              onClick={() => onSelect(sqlString)} 
              sx={{ borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
            >
              <Typography sx={{ color: 'var(--accent-indigo)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {getSummary(sqlString)}
              </Typography>
              <ListItemText 
                primary={sqlString.length > 30 ? sqlString.substring(0, 30) + '...' : sqlString}
                primaryTypographyProps={{ style: { color: 'var(--text-primary)', fontSize: '0.85rem' } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
};

export default QueryHistoryList;