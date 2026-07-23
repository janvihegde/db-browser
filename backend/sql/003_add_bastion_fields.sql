-- Run this once against your app's database (same one 001_ and 002_ ran against).
--
-- Adds optional bastion/EC2 jump-host details to each saved connection, used
-- to reach a DB that's only network-reachable from inside the bastion (e.g.
-- an internal RDS endpoint). bastion_password is encrypted the same way
-- db_password already is (AES-256-GCM, application-side).
--
-- Existing rows get NULLs here, meaning they keep connecting directly, exactly
-- as before this migration.

ALTER TABLE user_connections
  ADD COLUMN IF NOT EXISTS bastion_host TEXT,
  ADD COLUMN IF NOT EXISTS bastion_port INTEGER,
  ADD COLUMN IF NOT EXISTS bastion_user TEXT,
  ADD COLUMN IF NOT EXISTS bastion_password_encrypted TEXT;