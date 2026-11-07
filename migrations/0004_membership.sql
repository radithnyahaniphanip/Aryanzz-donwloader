PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS membership_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','expired')),
  payment_provider TEXT NOT NULL DEFAULT 'manual',
  provider_transaction_id TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  expires_at INTEGER,
  reviewed_by TEXT,
  note TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_provider_tx
  ON membership_orders(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_membership_user_created
  ON membership_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_status_created
  ON membership_orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_memberships (
  user_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
  started_at INTEGER NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
