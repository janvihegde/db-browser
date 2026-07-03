import React, { useEffect, useState } from 'react';
import { List, ListItemButton, ListItemText } from '@mui/material';
import api from '../services/api';

const QueryHistoryList = ({ onSelect }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Calling the endpoint we built earlier
    api.get('/database/query/history')
      .then(res => setHistory(res.data.history || []))
      .catch(err => console.error("History fetch error", err));
  }, []);

  return (
    <List>
      {history.map((item, index) => (
        <ListItemButton key={index} onClick={() => onSelect(item.query)} sx={{ borderBottom: '1px solid #171717' }}>
          <ListItemText 
            primary={item.query.substring(0, 30) + '...'} 
            secondary={new Date(item.executed_at).toLocaleDateString()}
            primaryTypographyProps={{ style: { color: '#ffffff', fontSize: '0.85rem' } }}
            secondaryTypographyProps={{ style: { color: '#525252', fontSize: '0.7rem' } }}
          />
        </ListItemButton>
      ))}
    </List>
  );
};

export default QueryHistoryList;