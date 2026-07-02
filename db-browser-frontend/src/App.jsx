import Sidebar from './components/Sidebar.jsx';

function App() {
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ padding: '20px' }}>
        <h1>Database Browser</h1>
        <p>Select a database to explore...</p>
      </main>
    </div>
  );
}

export default App;