PRAGMA foreign_keys = ON;

-- One browser installation is associated with one primary account.
-- device_hash is a server-keyed digest of a random first-party browser token,
-- never an IMEI, serial number, advertising ID, or hardware fingerprint.
CREATE TABLE IF NOT EXISTS auth_device_accounts (
  device_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_device_accounts_user
  ON auth_device_accounts(user_id);

CREATE TABLE IF NOT EXISTS redeem_codes (
  code_hash TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL DEFAULT 'legendary_launch',
  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK(max_redemptions BETWEEN 1 AND 10000),
  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK(redeemed_count >= 0),
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS redeem_redemptions (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  reward_expires_at INTEGER NOT NULL,
  UNIQUE(code_hash,user_id),
  FOREIGN KEY (code_hash) REFERENCES redeem_codes(code_hash) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_redeem_user_recent
  ON redeem_redemptions(user_id,redeemed_at DESC);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  source TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER,
  equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_active
  ON user_cosmetics(user_id,expires_at);
