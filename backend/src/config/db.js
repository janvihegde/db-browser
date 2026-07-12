const { Pool } = require('pg');
require('dotenv').config();

// Postgres connections are bound to a single database at connect time —
// unlike MySQL, you can't just "USE another_db" on the same connection.
// So "browsing multiple databases" means keeping a small pool per database,
// not one global pool. Pools are created lazily and cached here.

const baseConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),

  // AWS RDS PostgreSQL usually requires or supports SSL.
  // rejectUnauthorized: false skips certificate validation (MITM risk) —
  // set DB_SSL_REJECT_UNAUTHORIZED=true once you've got the RDS CA bundle
  // wired in. Left as a togglable default so this doesn't block your first deploy.
  ssl: {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  },

  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  // Keep this low per-process: if you ever run multiple backend instances,
  // (process count) x (this number) must stay under your RDS max_connections.
  // Also remember: this is now PER DATABASE POOL, so if users browse 3
  // databases, that's up to 3 x DB_POOL_MAX connections from one process.
  max: Number(process.env.DB_POOL_MAX || 10)
};

const pools = new Map();

/**
 * Get (or lazily create) the connection pool for a given database name.
 * Callers are responsible for validating dbName against a real, existing
 * database first (see isValidDatabase in databaseRoutes.js) — this function
 * does not validate, it just connects to whatever name it's given.
 */
function getPool(dbName) {
  const key = dbName || process.env.DB_NAME;
  if (!pools.has(key)) {
    const pool = new Pool({ ...baseConfig, database: key });
    pool.on('error', (err) => {
      console.error(`Unexpected error on idle PostgreSQL client (db: ${key})`, err);
    });
    pools.set(key, pool);
  }
  return pools.get(key);
}

// The "default" pool (DB_NAME from .env) is used for things that aren't
// really about browsing a specific database — listing all databases on the
// instance, and app-level tables like app_users for login.
function defaultPool() {
  return getPool(process.env.DB_NAME);
}

module.exports = { getPool, defaultPool };
