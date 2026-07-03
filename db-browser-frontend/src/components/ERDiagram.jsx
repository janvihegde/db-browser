import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import api from '../services/api';

const ERDiagram = () => {
  const [status, setStatus] = useState('Loading diagram data...');
  const containerRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Mermaid safely
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    // 2. Fetch the data
    api.get('/database/relationships')
      .then((res) => {
        const rels = res.data.relationships;
        
        console.log("API Response:", rels); // Open your browser console to see this!

        if (!rels || rels.length === 0) {
          setStatus("No relationships found in the API response.");
          return;
        }

        // 3. Build the Mermaid string carefully
        let code = 'erDiagram\n';
        rels.forEach(r => {
          // Wrap table names in quotes if they have weird characters
          const fromTable = r.from_table.replace(/-/g, '_'); 
          const toTable = r.to_table.replace(/-/g, '_');
          code += `    ${fromTable} ||--o{ ${toTable} : "${r.from_column}"\n`;
        });

        console.log("Mermaid Code Generated:\n", code);
        setStatus(''); // Clear loading status

        // 4. Render to the DOM
        if (containerRef.current) {
          containerRef.current.innerHTML = ''; // clear old renders
          mermaid.render('mermaid-svg-graph', code)
            .then(result => {
              containerRef.current.innerHTML = result.svg;
            })
            .catch(err => {
              console.error("Mermaid Render Crash:", err);
              setStatus("Mermaid crashed trying to draw the diagram. Check the console.");
            });
        }
      })
      .catch(err => {
        console.error("API Fetch Error:", err);
        setStatus(`Error fetching from backend: ${err.message}`);
      });
  }, []);

  return (
    <div style={{ padding: '24px', color: '#a3a3a3', width: '100%', height: '100%', overflow: 'auto' }}>
      {/* If there is a status/error, show it */}
      {status && (
        <div style={{ padding: '16px', backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}>
          {status}
        </div>
      )}
      
      {/* The container where the SVG will be injected */}
      <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }} />
    </div>
  );
};

export default ERDiagram;