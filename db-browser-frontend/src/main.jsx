import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import './index.css'
import App from './App.jsx'

// AG Grid v31+ uses a modular architecture — without registering modules,
// the grid renders rows but sort/filter/pagination silently do nothing.
// AllCommunityModule covers everything used in this app (sort, filter,
// pagination, CSV export) without needing enterprise features.
ModuleRegistry.registerModules([AllCommunityModule])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)