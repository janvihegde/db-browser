const crypto = require('crypto');

// AES-256-GCM: encrypts each user's saved RDS password before it touches
// the database. CONNECTION_ENCRYPTION_KEY must be a 32-byte key, base64
// encoded (generate with: openssl rand -base64 32).
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const keyB64 = process.env.CONNECTION_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error(
      'CONNECTION_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32'
    );
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('CONNECTION_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

// Returns a single string: "iv:authTag:ciphertext" (all base64), safe to
// store in a text column.
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV, recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

function decrypt(payload) {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = String(payload).split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted payload.');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
