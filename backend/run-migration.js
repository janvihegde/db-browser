// One-off helper to run a .sql migration file against your app database,
// using the same `pg` package already installed in backend/ — no need to
// install psql or any Postgres client tools separately.
//
// Usage (from inside the backend/ folder):
//   node run-migration.js sql/003_add_bastion_fields.sql

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <path-to-sql-file>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(migrationFile), 'utf8');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
  }
});

(async () => {
  try {
    console.log(`Running migration: ${migrationFile}`);
    await pool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();