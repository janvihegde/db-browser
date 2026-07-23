const { Pool } = require('pg');
require('dotenv').config();

// Two kinds of pools live in this app now:
//
// 1. The "app" pool — a single, fixed pool (from .env: DB_HOST, DB_USER,
//    etc.) used ONLY for the app's own internal tables: app_users and
//    user_connections. This is Anthropic's/your infra, not the user's.
//
// 2. "User connection" pools — created dynamically per saved connection
//    (each user's own AWS RDS credentials, entered via the Connections UI),
//    keyed by host+port+user+database so the same connection browsing two
//    databases reuses two small pools rather than one per request.

const appPoolConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_POOL_MAX || 10)
};

let appPool = null;
function getAppPool() {
  if (!appPool) {
    appPool = new Pool(appPoolConfig);
    appPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client (app pool)', err);
    });
  }
  return appPool;
}

// User-connection pools, keyed by a composite string so identical
// connection details reuse the same pool instead of opening new ones.
const userPools = new Map();

/**
 * Get (or lazily create) a pool for a specific user-supplied RDS connection
 * + database name. `conn` must already have a decrypted plaintext password
 * (decrypt it right before calling this, never store it decrypted anywhere
 * else) — see routes/databaseRoutes.js for how this is used.
 */
function getUserPool(conn, databaseName) {
  // FIX: Key by the unique connection ID and database name so that deleting/recreating 
  // a connection with new SSL properties generates a completely fresh pool.
  const key = `${conn.id}:${databaseName}`;
  
  if (!userPools.has(key)) {
    const pool = new Pool({
      user: conn.db_user,
      host: conn.host,
      database: databaseName,
      password: conn.db_password, // must already be decrypted by the caller
      port: conn.port,
      ssl: {
        rejectUnauthorized: !!conn.ssl_reject_unauthorized
      },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: Number(process.env.DB_POOL_MAX || 10)
    });
    pool.on('error', (err) => {
      console.error(`Unexpected error on idle PostgreSQL client (user pool: ${key})`, err);
    });
    userPools.set(key, pool);
  }
  return userPools.get(key);
}

module.exports = { getAppPool, getUserPool };
