/**
 * Authenticated encryption for user AI credentials (Phase 4).
 * AES-256-GCM via Web Crypto (Workers runtime).
 *
 * The master key (CREDENTIAL_ENCRYPTION_KEY) exists ONLY as a Worker secret —
 * a base64-encoded 32-byte key. Plaintext credentials are never persisted,
 * logged, or returned to the client.
 */

export const ENCRYPTION_VERSION = 'AES-256-GCM-v1';

function b64encode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Imports the base64 master key. Accepts raw 32-byte base64.
 */
async function importMasterKey(base64Key) {
  const raw = b64decode(base64Key);
  if (raw.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypts plaintext → { ciphertext (base64), iv (base64), version }.
 * A fresh cryptographically random 96-bit IV is generated per record.
 */
export async function encryptCredential(plaintext, base64Key) {
  const key = await importMasterKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded
  );
  return {
    ciphertext: b64encode(ciphertext),
    iv: b64encode(iv),
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Decrypts { ciphertext, iv } → plaintext. Throws on tampering/auth failure.
 */
export async function decryptCredential(ciphertextB64, ivB64, base64Key) {
  const key = await importMasterKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64decode(ivB64), tagLength: 128 },
    key,
    b64decode(ciphertextB64)
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Returns only the last `n` characters of a secret, for UI display.
 */
export function maskedSuffix(secret, n = 4) {
  const trimmed = (secret || '').trim();
  if (trimmed.length <= n) return '••••';
  return `••••${trimmed.slice(-n)}`;
}
