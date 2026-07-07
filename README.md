# Database Browser

A highly professional, secure, and user-friendly web application designed for seamless PostgreSQL database exploration, SQL query execution, and visual data management.

---

## 🚀 Key Features

### 1. Database & Schema Discovery

* **Smart Database Listing:** Dynamically retrieves all available databases in your PostgreSQL cluster. It uses logic-based filtering (`pg_roles` and `pg_database` metadata) to automatically hide system databases (like `rdsadmin` or `postgres`), ensuring users only see relevant user-created databases.
* **Hierarchical Navigation:** Navigate easily through database schemas and table structures.

### 2. Intelligent Data Exploration

* **Preview & Metadata:** View raw data previews using a high-performance `AG-Grid` interface. Access deep metadata including data types, nullability, and primary/foreign key constraints.
* **Performance Insights:** - **Row Count Badges:** Fast, non-blocking estimation of row counts for every table.
* **Statistics Dashboard:** Get a bird's-eye view of your database health, including total size, object counts (tables, views, functions), and identification of the top 5 largest tables.



### 3. Advanced SQL IDE

* **Monaco-powered Editor:** A full-featured SQL editor (same engine as VS Code) with syntax highlighting and formatting.
* **Query Execution:** Secure execution of arbitrary SQL with strict `60s` statement timeouts to prevent system hang-ups.
* **Explain Plan Translation:** A built-in "Explain Plan" feature that translates complex Postgres `EXPLAIN ANALYZE` outputs into plain, actionable English (e.g., identifying sequential scans versus index scans).
* **History Tracking:** Automatically logs query execution to a central history table, allowing users to scroll back and re-run previous work.
* **Data Export:** Built-in ability to export any query's results directly to a formatted CSV file.

### 4. Visual Query Builder

* **Drag-and-Drop Interface:** A sophisticated visual builder that translates intuitive query-building actions into valid SQL, bridging the gap between non-technical users and complex database interactions.

---

## 🏗️ Technical Architecture

The application adheres to a secure **three-tier architecture**:

1. **Frontend (React + Vite):**
* Manages the state and provides a responsive UI.
* Communicates with the backend using a shared `api` service (Axios-based).


2. **Backend (Node.js + Express):**
* **Authentication Middleware:** Every request is authenticated using `requireAuth`.
* **Route Handling:** Routes are strictly separated into `authRoutes`, `databaseRoutes`, and `queryHistory`.
* **Connection Pooling:** Utilizes the `pg` (node-postgres) library with a robust connection pool to handle multiple concurrent users safely.


3. **Database Layer (PostgreSQL):**
* Uses system metadata (`information_schema` and `pg_catalog`) to power the "browser" features without requiring manual configuration.



---

## 📁 Codebase Structure

### `backend/`

* `src/server.js`: The central entry point. Registers routes and global security middleware (CORS, Cookie-Parser).
* `src/routes/databaseRoutes.js`: Contains all logic for metadata discovery, stats, and SQL query execution.
* `src/middleware/auth.js`: Implements Role-Based Access Control (RBAC).

### `db-browser-frontend/`

* `src/components/TableWorkspace.jsx`: The main interactive component that orchestrates tabs, SQL editor integration, and data viewing.
* `src/services/api.js`: Centralized Axios configuration for handling API calls and JWT tokens.
* `src/utils/sqlTranslator.js`: Logic for parsing PostgreSQL performance plans into human-readable text.

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
```bash
git clone <your-repo-url>

```


2. **Backend Setup:**
* Navigate to `/backend`.
* Run `npm install` to fetch dependencies.
* Set up your `.env` file (ensure `DATABASE_URL` and `JWT_SECRET` are set).
* Start the server: `npm start`.


3. **Frontend Setup:**
* Navigate to `/db-browser-frontend`.
* Run `npm install`.
* Start the development server: `npm run dev`.



---

*Built for database agility and developer productivity.*
