# 🗄️ DB Browser

A web-based PostgreSQL database browser and query execution tool.

DB Browser lets you connect to your own PostgreSQL databases — cloud
instances (AWS RDS, Supabase, etc.) or databases running on your own
machine — browse schemas, view table relationships, and run SQL queries
from the browser, without installing a desktop client.

## ✨ Key Features

* **Two connection modes:** cloud/remote databases go through the hosted
  backend; databases on your own machine go through a browser extension +
  local native messaging host, so `localhost` correctly means *your*
  machine, not the server's.
* **Role-based access control:** Viewer/Editor/Admin roles restrict which
  SQL commands can run — Viewers are limited to `SELECT`/`EXPLAIN`,
  Editors add `INSERT`/`UPDATE`/`DELETE`.
* **Dynamic connection pooling:** pools are cached per unique connection,
  reused across requests instead of reconnecting every time.
* **Schema browsing:** databases, schemas, tables, columns, and foreign
  key relationships.
* **SQL editor:** run custom queries with a 60-second timeout to prevent
  hung transactions.
* **CSV export** for cloud connections (not yet available for local
  connections — see the extension's own README).
* **No signup:** a device ID is generated once per browser and stored
  locally — no accounts, no passwords.

---

## 🏗️ Architecture

Two different paths depending on where the database lives:

**Cloud/remote databases** — the original flow:
```
Browser (React) → Backend (Express, on Render) → Postgres (RDS, Supabase, etc.)
```
The backend stores connection metadata (host, port, user, database) in its
own app database, with the password encrypted at rest (AES-256-GCM,
decrypted only in memory when a query needs to run).

**Local databases** — for databases bound to `localhost` on your own
machine, which the hosted backend can never reach:
```
Browser (React) → Extension → Native messaging host → Postgres (your machine)
```
The browser extension relays requests to a small native host process
running locally, which opens the actual Postgres connection. Local
connection details are kept in the browser's own `localStorage`, not sent
to the hosted backend — see `native-host/README.md` (or the extension's own
docs) for the full setup.

The frontend's `dbClient.js` decides which path a given connection uses
based on whether it's marked local.

---

## 🚀 Tech Stack

**Frontend:**
* React (Vite)
* Axios (API client for the cloud path)
* Custom CSS / CSS variables

**Backend:**
* Node.js & Express
* PostgreSQL (`pg`)
* Built-in `crypto` for AES-256-GCM (encrypting saved cloud connection passwords)
* `json2csv` for CSV export

**Local connector (for databases on your own machine):**
* A Chrome/Edge extension (Manifest V3)
* A native messaging host (Node.js, talks to Postgres the same way the
  backend does, just running locally instead of on Render)

---

## 🛠️ Getting Started (Local Development)

### Prerequisites
* Node.js (v18+)
* A PostgreSQL instance for the app's own tables (`app_users`,
  `user_connections`) — this is separate from whatever database(s) you
  actually want to browse.

### 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=db_browser_app
DB_PASSWORD=your_password
DB_PORT=5432

# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CONNECTION_ENCRYPTION_KEY=your_generated_key_here

CORS_ORIGIN=http://localhost:5173
```

Run the migrations in `backend/sql/` against that database, then:
```bash
npm run dev
```

### 2. Frontend setup

```bash
cd db-browser-frontend
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

### 3. (Optional) Local database connector

To browse a database running on your own machine rather than a cloud one,
see `native-host/install.ps1` (Windows) to register the browser extension +
native messaging host. Not required if you're only connecting to
cloud-hosted databases.

---

## 📖 How to Use

1. **Open the app** — a device ID is generated automatically on first load.
2. **Add a connection** — host, port, username, password, database name.
   Check "This database is on my own machine" if it's local (requires the
   extension — see above); leave it unchecked for cloud databases.
3. **Test the connection** before saving, to confirm the credentials work.
4. **Browse** — schemas, tables, columns, relationships.
5. **Query** — the SQL editor tab supports arbitrary SQL, subject to your
   role's permissions.
6. **Export** — CSV export is available for cloud connections.

---

## 🛡️ Security Notes

* **Never commit your `.env` file or `CONNECTION_ENCRYPTION_KEY`.** Losing
  that key means permanently losing the ability to decrypt any saved cloud
  connection passwords.
* Cloud connection passwords are encrypted at rest and never sent back to
  the frontend — API responses explicitly omit `db_password_encrypted`.
* Local connection passwords (for databases on your own machine) are kept
  in the browser's `localStorage` in plaintext, since there's no hosted
  metadata service for those by design — a different tradeoff than the
  cloud path, worth knowing if this ever needs to satisfy a stricter threat
  model.
* SQL execution has a 60-second statement timeout to prevent runaway
  queries from locking up a connection.
* The native host (for local connections) will connect to any host/port
  reachable from your machine — same latitude the hosted backend has today,
  just scoped to your own machine instead of Render's network.
