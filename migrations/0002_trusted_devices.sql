PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_trusted_devices (
  user_id TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, device_hash),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_trusted_devices_recent ON auth_trusted_devices(user_id, last_seen_at DESC);
