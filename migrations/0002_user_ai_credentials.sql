-- Phase 4: Secure user AI credentials.
-- Stores ONLY encrypted material (AES-256-GCM ciphertext + per-record IV).
-- The encryption master key lives exclusively in Worker secrets
-- (CREDENTIAL_ENCRYPTION_KEY) and never in D1, the browser, or Git.

CREATE TABLE IF NOT EXISTS user_ai_credentials (
  id                 TEXT PRIMARY KEY,
  clerk_user_id      TEXT NOT NULL,
  provider           TEXT NOT NULL CHECK (provider IN ('gemini')),
  encrypted_value    TEXT NOT NULL,           -- base64 ciphertext
  iv                 TEXT NOT NULL,           -- base64 96-bit nonce
  encryption_version TEXT NOT NULL,           -- e.g. 'AES-256-GCM-v1'
  masked_suffix      TEXT,                    -- last 4 chars of the key, for UI display only
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (clerk_user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_credentials_user
  ON user_ai_credentials (clerk_user_id, provider);
