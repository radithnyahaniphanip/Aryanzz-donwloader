PRAGMA foreign_keys = ON;

-- Link the server-issued HttpOnly installation token to the account after
-- successful authentication. Only SHA-256 hashes are stored, never raw tokens.
CREATE TABLE IF NOT EXISTS auth_device_lock_accounts (
  lock_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_device_lock_accounts_user
  ON auth_device_lock_accounts(user_id,last_seen_at DESC);
