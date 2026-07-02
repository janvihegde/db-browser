import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemText, Collapse } from '@mui/material';
import api from '../services/api';

const Sidebar = () => {
  const [databases, setDatabases] = useState([]);

  useEffect(() => {
    // Fetch the list of databases using your backend API
    api.get('/database/list')
      .then(response => setDatabases(response.data.databases))
      .catch(error => console.error("Error fetching databases:", error));
  }, []);

  return (
    <List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      {databases.map((db) => (
        <ListItem key={db}>
          <ListItemText primary={db} />
        </ListItem>
      ))}
    </List>
  );
};

export default Sidebar;