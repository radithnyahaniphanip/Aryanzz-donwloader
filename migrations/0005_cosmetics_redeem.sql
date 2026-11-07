PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS redeem_codes (
  code_hash TEXT PRIMARY KEY,
  reward_id TEXT NOT NULL,
  max_redemptions INTEGER NOT NULL DEFAULT 1,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_active_expiry
  ON redeem_codes(active, expires_at);

CREATE TABLE IF NOT EXISTS redeem_redemptions (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  reward_expires_at INTEGER,
  FOREIGN KEY (code_hash) REFERENCES redeem_codes(code_hash),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_redeem_redemptions_code
  ON redeem_redemptions(code_hash);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cosmetic_id TEXT NOT NULL,
  source TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER,
  equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE(user_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_user
  ON user_cosmetics(user_id, acquired_at DESC);
