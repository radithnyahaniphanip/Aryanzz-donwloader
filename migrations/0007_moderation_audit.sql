PRAGMA foreign_keys = ON;

-- Moderation audit log; stores account decisions, never raw device identifiers.
CREATE TABLE IF NOT EXISTS auth_moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('ban','unban')),
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_moderation_events_user
  ON auth_moderation_events(user_id,created_at DESC);
