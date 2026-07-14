// One-off admin script: promote (or demote) a device's role.
//
// The app no longer uses email/password auth — 002_add_device_id.sql moved
// identity to a client-generated device ID (see middleware/auth.js), so
// there's no `email` or `password_hash` to look up anymore. This script
// used to try to do that and was broken in two ways: it imported
// `./src/config/db`, which exports `{ getAppPool, getUserPool }` (not a
// pool itself — `pool.query` was never a function), and it wrote to
// columns (`email`, `password_hash`) that this app no longer keys auth off
// of.
//
// Usage:
//   node setUser.js <deviceId> <Viewer|Editor|Admin>
//
// Find a device's current ID/role first with:
//   SELECT id, device_id, role FROM app_users;

require('dotenv').config();
const { getAppPool } = require('./src/config/db');

const VALID_ROLES = ['Viewer', 'Editor', 'Admin'];

async function setDeviceRole(deviceId, role) {
  if (!deviceId || !VALID_ROLES.includes(role)) {
    console.error(`Usage: node setUser.js <deviceId> <${VALID_ROLES.join('|')}>`);
    process.exitCode = 1;
    return;
  }

  try {
    const { rows } = await getAppPool().query(
      `UPDATE app_users SET role = $1 WHERE device_id = $2 RETURNING id, device_id, role;`,
      [role, deviceId]
    );

    if (rows.length === 0) {
      console.error(`No app_users row found for device_id "${deviceId}".`);
      process.exitCode = 1;
      return;
    }

    console.log(`Updated device ${rows[0].device_id} (user id ${rows[0].id}) to role "${rows[0].role}".`);
  } catch (err) {
    console.error('Failed to update role:', err.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

const [, , deviceId, role] = process.argv;
setDeviceRole(deviceId, role);