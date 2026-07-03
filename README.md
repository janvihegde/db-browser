# 🐘 DB-Browser: Advanced PostgreSQL Visual Client

DB-Browser is a full-stack, web-based PostgreSQL database administration and visual analytics tool. Built to connect seamlessly to cloud databases (like AWS RDS), it provides a modern, dark-themed interface for exploring schemas, writing SQL, generating automated entity-relationship diagrams, and visually building complex queries without writing code.

## 🚀 Tech Stack

**Frontend:**
* **React (Vite):** Core UI framework.
* **AG Grid:** High-performance data tables for results and metadata.
* **Monaco Editor:** VS Code's underlying editor for the SQL text environment.
* **Mermaid.js:** Diagramming and charting tool for automated ER diagram generation.
* **Material UI (MUI):** Tab navigation and loading states.
* **HTML5 Drag & Drop API:** Native drag-and-drop for the visual query builder.

**Backend:**
* **Node.js & Express:** REST API server.
* **PostgreSQL (`pg`):** Native Postgres client for executing queries.
* **json2csv:** Utility for converting JSON database payloads into downloadable CSV files.

---

## ✨ Core Features & Architecture

### 1. Database Explorer (Sidebar Navigation)
* **Dynamic Hierarchy:** Automatically queries the database to list all available Schemas (`public`, etc.) and their respective Base Tables.
* **State Management:** Clicking a table dynamically updates the main workspace, fetching fresh data and metadata.

### 2. Multi-Tab Workspace (`TableWorkspace.jsx`)
The main workspace is divided into 5 distinct modules:

#### Tab 1: Data Preview
* Executes a `SELECT * LIMIT 100` upon table selection.
* Renders data into a fully interactive AG Grid, supporting out-of-the-box column sorting, filtering, and resizing.

#### Tab 2: Columns (Metadata)
* Queries the `information_schema.columns` view.
* Displays critical table structure information including `column_name`, `data_type`, and `is_nullable`.

#### Tab 3: Advanced SQL Editor & History
* **Monaco Integration:** Provides syntax highlighting, line numbers, and a premium coding experience.
* **Query Execution:** Securely passes raw SQL to the backend, rendering dynamic result grids.
* **Query Execution Plan:** Includes an **"Explain Plan"** feature that prepends `EXPLAIN ANALYZE` to the user's query, intercepting the database's internal execution path and rendering the raw performance metrics.
* **Intelligent Query History:** A client-side, in-memory search index that tracks past queries. It features an intent-aware summarization engine (e.g., dynamically labeling queries as *"Merging orders with reference records"* or *"Aggregating users data"*) rather than just showing raw SQL.
* **CSV Export:** A one-click download feature that pipes the current query results through the backend into a `.csv` file.

#### Tab 4: Automated ER Diagrams (`ERDiagram.jsx`)
* **Dynamic Generation:** Queries `pg_constraint` and `information_schema` to detect all live Foreign Key relationships in the database.
* **Visual Rendering:** Translates the SQL metadata into Mermaid.js syntax, rendering an interactive, zoomable Entity-Relationship Diagram of the database architecture.

#### Tab 5: Visual Query Builder (`VisualQueryBuilder.jsx`)
A zero-dependency, drag-and-drop query constructor featuring:
* **Live Database Sync:** Fetches actual tables from the database for the drag-and-drop sidebar.
* **Mode Switching:** Toggles between `SELECT` (Analytics) and `INSERT` (Data Entry) modes.
* **Drag-and-Drop Canvas:** Drop tables onto the workspace to begin building.
* **Join Engine:** Visually configure `INNER`, `LEFT`, and `RIGHT` joins based on the dropped tables.
* **PostgreSQL Functions:** Apply Aggregates (`COUNT`, `SUM`), String formatting (`UPPER`), Math (`ROUND`), and Date extraction directly to columns.
* **Auto Group-By Intelligence:** Automatically detects when aggregate functions are mixed with standard columns and generates the required `GROUP BY` SQL clause.
* **WHERE Filter Builder:** Chain `AND/OR` logical filters with various operators (`=`, `>`, `LIKE`, `IS NULL`).
* **Dynamic Forms:** In `INSERT` mode, instantly generates a data-entry form matching the columns of the selected table.

---

## 📁 Project Structure

```text
db-browser/
│
├── backend/                  # Node.js Express Server
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js         # PostgreSQL connection pool (AWS RDS SSL enabled)
│   │   ├── routes/
│   │   │   └── databaseRoutes.js # Core API endpoints (Query, Export, Metadata)
│   │   └── server.js         # Express initialization
│   ├── .env                  # DB Credentials
│   └── package.json
│
└── db-browser-frontend/      # React (Vite) Application
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.jsx           # Navigational tree
    │   │   ├── TableWorkspace.jsx    # Main tabbed interface
    │   │   ├── QueryHistoryList.jsx  # Intent-aware history panel
    │   │   ├── ERDiagram.jsx         # Mermaid visualization
    │   │   └── VisualQueryBuilder.jsx# Drag-and-drop SQL engine
    │   ├── services/
    │   │   └── api.js                # Axios configuration
    │   ├── App.jsx                   # Layout container
    │   ├── index.css                 # Global dark-theme overrides
    │   └── main.jsx
    └── package.json
