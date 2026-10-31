-- Users' own data API keys kept on the server: AES-256-GCM, a fresh 12-byte nonce per key, the
-- user's id bound in as additional data, and the master key's version for later rotation.
-- Only the last 4 characters are kept in clear, to show the key masked.
CREATE TABLE user_keys (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  last4 TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, source)
);
