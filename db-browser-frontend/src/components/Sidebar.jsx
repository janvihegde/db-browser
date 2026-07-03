import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemButton, ListItemText, Typography, Collapse, TextField, InputAdornment, CircularProgress } from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';

const Sidebar = ({ selectedDb, onSelectDb, selectedSchema, onSelectSchema }) => {
  const [databases, setDatabases] = useState([]);
  const [expandedDb, setExpandedDb] = useState(null);
  const [schemas, setSchemas] = useState({}); 
  
  // New Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch Databases on load
  useEffect(() => {
    api.get('/database/list')
      .then(response => {
        if (response.data?.databases) setDatabases(response.data.databases);
      })
      .catch(err => console.error("Error fetching databases:", err));
  }, []);

  // Handle Search with a 500ms Debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      api.get(`/database/search?query=${encodeURIComponent(searchTerm)}`)
        .then(response => {
          // Aggressively hunt for the data array just like we did in the SQL Editor
          let data = [];
          if (Array.isArray(response.data)) data = response.data;
          else if (response.data && Array.isArray(response.data.rows)) data = response.data.rows;
          else if (response.data && response.data.data && Array.isArray(response.data.data)) data = response.data.data;
          else if (response.data && response.data.results) data = response.data.results;
          
          setSearchResults(data);
          setIsSearching(false);
        })
        .catch(err => {
          console.error("Error searching:", err);
          setSearchResults([]);
          setIsSearching(false);
        });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Handle clicking a database
  const handleDbClick = async (dbName) => {
    onSelectDb(dbName);
    onSelectSchema(null); 
    
    const isExpanding = expandedDb !== dbName;
    setExpandedDb(isExpanding ? dbName : null);

    if (isExpanding && !schemas[dbName]) {
      try {
        const response = await api.get(`/database/${dbName}/schemas`);
        if (response.data?.schemas) {
          setSchemas(prev => ({ ...prev, [dbName]: response.data.schemas }));
        }
      } catch (error) {
        console.error("Error fetching schemas:", error);
      }
    }
  };

  return (
    <div style={{
      width: '320px', // Widened slightly to accommodate the search bar nicely
      height: '100%',
      backgroundColor: '#0a0a0a', 
      borderRight: '1px solid #262626',
      color: '#ededed',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header & Search Bar Area */}
      <div style={{ padding: '30px 24px 20px 24px', borderBottom: '1px solid #262626' }}>
        <Typography variant="h5" sx={{ fontWeight: 300, letterSpacing: '1px', color: '#ffffff', mb: 3 }}>
          Data Explorer
        </Typography>
        
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search tables & columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#737373', fontSize: '1.2rem' }} />
              </InputAdornment>
            ),
            style: { backgroundColor: '#171717', borderRadius: '8px', fontSize: '0.95rem', height: '44px' }
          }}
          sx={{
            // Force the typed text to be white
            '& .MuiInputBase-input': { 
              color: '#ffffff',
            },
            // Keep the placeholder text visible but dimmed
            '& .MuiInputBase-input::placeholder': {
              color: '#a3a3a3',
              opacity: 1,
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#262626' },
              '&:hover fieldset': { borderColor: '#404040' },
              '&.Mui-focused fieldset': { borderColor: '#3b82f6', borderWidth: '1px' },
            }
          }}
        />
      </div>

      {/* Main List Area */}
      <List sx={{ flexGrow: 1, padding: '16px 12px', overflowY: 'auto' }}>
        
        {/* Conditional Rendering: Show Search Results OR the normal Database List */}
        {searchTerm.trim() ? (
          
          isSearching ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <CircularProgress size={24} sx={{ color: '#3b82f6' }} />
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            searchResults.map((result, idx) => {
              // Gracefully extract names based on how your backend returns the search matches
              const itemName = result.table_name || result.column_name || result.name || "Unknown Item";
              const itemDetail = result.column_name ? `Column in ${result.table_name}` : `Table in ${result.table_schema || 'schema'}`;
              
              return (
                <ListItem disablePadding key={idx} sx={{ mb: 0.5 }}>
                  <ListItemButton sx={{ borderRadius: '6px', '&:hover': { backgroundColor: '#171717' } }}>
                    <ListItemText 
                      primary={itemName} 
                      secondary={itemDetail}
                      primaryTypographyProps={{ style: { color: '#ffffff', fontSize: '0.95rem', fontWeight: 500 } }}
                      secondaryTypographyProps={{ style: { color: '#a3a3a3', fontSize: '0.8rem' } }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            })
          ) : (
            <Typography sx={{ color: '#737373', textAlign: 'center', mt: 4, fontSize: '0.95rem' }}>
              No matches found for "{searchTerm}"
            </Typography>
          )

        ) : (
          
          /* Normal Database List */
          databases.map((db) => {
            const isDbExpanded = expandedDb === db;
            return (
              <React.Fragment key={db}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    onClick={() => handleDbClick(db)}
                    sx={{
                      borderRadius: '6px',
                      backgroundColor: isDbExpanded ? '#1a1a1a' : 'transparent',
                      '&:hover': { backgroundColor: '#171717' },
                    }}
                  >
                    <ListItemText 
                      primary={db} 
                      primaryTypographyProps={{ style: { fontWeight: isDbExpanded ? 600 : 400, fontSize: '0.95rem' } }}
                    />
                    {isDbExpanded ? <ExpandLess sx={{ color: '#a3a3a3' }}/> : <ExpandMore sx={{ color: '#a3a3a3' }}/>}
                  </ListItemButton>
                </ListItem>

                <Collapse in={isDbExpanded} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {(schemas[db] || []).map((schemaObj) => {
                      const schemaName = schemaObj.schema_name || schemaObj;
                      const isSchemaSelected = selectedSchema === schemaName;

                      return (
                        <ListItemButton
                          key={schemaName}
                          onClick={() => onSelectSchema(schemaName)}
                          sx={{
                            pl: 4, 
                            borderRadius: '6px',
                            mb: 0.5,
                            backgroundColor: isSchemaSelected ? '#262626' : 'transparent',
                            '&:hover': { backgroundColor: '#1f1f1f' },
                          }}
                        >
                          <ListItemText 
                            primary={schemaName} 
                            primaryTypographyProps={{ style: { color: isSchemaSelected ? '#ffffff' : '#a3a3a3', fontSize: '0.85rem' } }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          })
        )}
      </List>
    </div>
  );
};

export default Sidebar;