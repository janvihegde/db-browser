// db.js
//
// Adapted from backend/src/config/db.js's getUserPool. The original had two
// kinds of pools (an "app" pool for the hosted app's own tables, plus
// per-user pools for their RDS connections) — this host only ever needs the
// second kind, since there's no hosted app database on the user's own
// machine. Pools are still keyed and reused so repeatedly browsing the same
// connection/database doesn't open a new pool per request.

const { Pool } = require('pg');

const pools = new Map(); // key -> Pool

function poolKey(connection, databaseName) {
  return `${connection.host}:${connection.port}:${connection.dbUser}:${databaseName}`;
}

function getPool(connection, databaseName) {
  const key = poolKey(connection, databaseName);

  if (!pools.has(key)) {
    const pool = new Pool({
      user: connection.dbUser,
      host: connection.host,
      database: databaseName,
      password: connection.dbPassword,
      port: Number(connection.port) || 5432,
      ssl: { rejectUnauthorized: !!connection.sslRejectUnauthorized },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    pool.on('error', (err) => {
      console.error(`Unexpected error on idle PostgreSQL client (pool: ${key})`, err.message);
    });
    pools.set(key, pool);
  }

  return pools.get(key);
}

module.exports = { getPool };
