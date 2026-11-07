PRAGMA foreign_keys = ON;

-- Poketo webhook event IDs are unique so redeliveries cannot activate Membership twice.
CREATE TABLE IF NOT EXISTS poketo_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_poketo_webhook_received
  ON poketo_webhook_events(received_at DESC);
