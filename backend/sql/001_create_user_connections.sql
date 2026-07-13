-- Run this once against your app's database (the one DB_NAME points to —
-- the same database that already has your app_users table).
--
-- Stores each user's own AWS RDS connection details. Passwords are never
-- stored in plaintext — they're encrypted application-side (AES-256-GCM)
-- before being written here, and decrypted only in memory when the app
-- needs to actually connect.

CREATE TABLE IF NOT EXISTS user_connections (
    id                        SERIAL PRIMARY KEY,
    user_id                   INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    label                     TEXT NOT NULL,
    host                      TEXT NOT NULL,
    port                      INTEGER NOT NULL DEFAULT 5432,
    db_user                   TEXT NOT NULL,
    db_password_encrypted     TEXT NOT NULL,
    database_name             TEXT NOT NULL,
    ssl_reject_unauthorized   BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_connections_user_id ON user_connections(user_id);
