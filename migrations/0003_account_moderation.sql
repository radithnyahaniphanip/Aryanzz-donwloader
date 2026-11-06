PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_user_bans (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_banned_devices (
  device_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_user_bans_created ON auth_user_bans(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_banned_devices_user ON auth_banned_devices(user_id);
