

# 🗄️ DB Browser (PostgreSQL Workspace)

A full-stack, high-performance web application designed to securely connect, browse, and manage PostgreSQL databases. Built with a Node.js/Express backend and a modern React (Vite) frontend, this application provides an interactive workspace for database administrators and developers to query data, manage tables, translate natural language to SQL, and export records effortlessly.

## ✨ Core Features

* **Secure Authentication:** Route protection and user verification powered by JSON Web Tokens (JWT) and Bcrypt password hashing.
* **Tabbed Table Workspace:** A dynamic, multi-tab interface built with Material-UI (MUI) to view multiple tables or query results simultaneously without losing context.
* **High-Performance Data Grid:** Integrates `AG Grid` (`ag-grid-react`) for rapid rendering, sorting, and filtering of large database query results.
* **Natural Language to SQL:** A dedicated `sqlTranslator.js` module that parses user intents and translates them into executable SQL statements.
* **Data Export:** One-click functionality to convert database views into downloadable CSV files utilizing the backend `json2csv` engine.
* **Robust Database Connectivity:** Direct integration with PostgreSQL via the `pg` (node-postgres) module, supporting connection pooling and complex data types.

---

## 🛠️ Technology Stack

### **Frontend**

* **Framework:** React 18 (Bootstrapped with Vite for optimized HMR and builds)
* **UI Library:** Material-UI (@mui/material)
* **Data Tables:** AG Grid React
* **Styling:** CSS / MUI Emotion

### **Backend**

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database Driver:** PostgreSQL (`pg`, `pg-pool`)
* **Security & Auth:** `jsonwebtoken`, `bcrypt`, `cors`
* **Utilities:** `json2csv` (Export), `dotenv` (Environment management), `body-parser`

---

## 📁 Project Structure

```text
db-browser/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js               # PostgreSQL connection & pool config
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification and route protection
│   │   ├── routes/
│   │   │   ├── authRoutes.js       # Login, register, and token refresh logic
│   │   │   └── databaseRoutes.js   # DB querying, table fetching, and CSV export
│   │   └── server.js               # Express application entry point
│   ├── setUser.js                  # User seeding/management utility
│   ├── .env                        # Backend environment variables
│   └── package.json                
│
└── db-browser-frontend/
    ├── public/                     # Static assets (favicons, icons)
    ├── src/
    │   ├── assets/                 # SVGs and images (hero.png, react.svg)
    │   ├── components/
    │   │   ├── Login.jsx           # User authentication interface
    │   │   ├── Sidebar.jsx         # Database schema and table navigation
    │   │   ├── TableWorkspace.jsx  # AG Grid tabbed workspace for query results
    │   │   └── Toast.jsx           # MUI snackbar alerts for user feedback
    │   ├── services/
    │   │   └── api.js              # Axios/Fetch wrappers for backend communication
    │   ├── utils/
    │   │   └── sqlTranslator.js    # Natural language to SQL translation logic
    │   ├── App.jsx                 # Main React component and state routing
    │   ├── main.jsx                # React DOM render entry
    │   └── index.css               # Global styles
    ├── vite.config.js              # Vite bundler configuration
    └── package.json                

```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

* [Node.js](https://nodejs.org/en/) (v16.x or higher recommended)
* [PostgreSQL](https://www.postgresql.org/) (Running locally or hosted)
* [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/db-browser.git
cd db-browser

```

### 2. Backend Setup

Navigate to the backend directory, install dependencies, and configure your environment.

```bash
cd backend
npm install

```

**Create a `.env` file in the `backend` directory:**

```env
# Server Configuration
PORT=5000

# PostgreSQL Database Credentials
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_target_database

# Authentication
JWT_SECRET=your_super_secret_jwt_key

```

*Optional:* If you need to establish initial users, run the setup script:

```bash
node setUser.js

```

**Start the Backend Server:**

```bash
# For development
npm run dev
# OR
node src/server.js

```

### 3. Frontend Setup

Open a new terminal window/tab, navigate to the frontend directory, and install the dependencies.

```bash
cd db-browser-frontend
npm install

```

**Start the Frontend Development Server:**

```bash
npm run dev

```

The Vite server will typically launch on `http://localhost:5173`.

---

## 💡 Usage Guide

1. **Authentication:** Upon loading the app, enter your credentials in the `Login` view. The backend will validate via Bcrypt and return a JWT.
2. **Navigation:** Use the `Sidebar` to view the active PostgreSQL schema. Click on tables to spawn a new workspace tab.
3. **Viewing Data:** The `TableWorkspace` uses AG Grid. You can drag columns to rearrange, use column headers to filter records, and click headers to sort.
4. **SQL Translation:** Enter natural language queries into the input field; the `sqlTranslator.js` utility will convert your request into a valid SQL string and fetch the results.
5. **Export:** Click the export button within a workspace tab to trigger the backend `json2csv` pipeline, instantly downloading your current view as a CSV file.

---

## 🛡️ Security Considerations

* **Never commit `.env` files.** The `.gitignore` is already configured to prevent this.
* **JWT Expiration:** Ensure tokens have a reasonable expiration time set in `authRoutes.js`.
* **SQL Injection:** Ensure the backend `databaseRoutes.js` strictly utilizes parameterized queries (`pg` module's `$1, $2` syntax) rather than string concatenation, especially when parsing outputs from the `sqlTranslator`.
