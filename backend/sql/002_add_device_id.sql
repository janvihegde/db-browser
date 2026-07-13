    -- Switches identity from email/password to a client-generated device ID.
-- Run this once against your app database (same one 001_... ran against).

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS device_id TEXT UNIQUE;

-- email/password are no longer required going forward
ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;