// One-off script to run the user_connections migration against your app
// database, using the same DB_* credentials your app already uses from .env.
//
// Run with:  node runMigration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

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

async function run() {
  const sqlDir = path.join(__dirname, 'sql');
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Connecting to ${process.env.DB_HOST}/${process.env.DB_NAME} ...`);
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
      console.log(`Applying ${file} ...`);
      await pool.query(sql);
    }
    console.log('✅ All migrations applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();