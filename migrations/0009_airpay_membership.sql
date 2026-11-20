PRAGMA foreign_keys = ON;

ALTER TABLE membership_orders ADD COLUMN provider_payment_url TEXT;
ALTER TABLE membership_orders ADD COLUMN provider_qr_url TEXT;
ALTER TABLE membership_orders ADD COLUMN provider_qr_string TEXT;
ALTER TABLE membership_orders ADD COLUMN provider_total_amount INTEGER;
ALTER TABLE membership_orders ADD COLUMN provider_fee_amount INTEGER;
ALTER TABLE membership_orders ADD COLUMN provider_expires_at INTEGER;

CREATE TABLE IF NOT EXISTS airpay_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_airpay_webhook_received
  ON airpay_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_provider_expiry
  ON membership_orders(payment_provider,status,provider_expires_at);
