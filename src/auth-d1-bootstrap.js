/* Generated from migrations/0001–0008; only fixed idempotent CREATE statements.
 * Used by the production Worker D1 binding when the Cloudflare deploy token
 * cannot run remote migrations. No arbitrary SQL or external input accepted. */
export const AUTH_D1_TABLES = Object.freeze(["auth_users","auth_verifications","auth_sessions","auth_trusted_devices","auth_user_bans","auth_banned_devices","membership_orders","user_memberships","auth_device_accounts","redeem_codes","redeem_redemptions","user_cosmetics","poketo_webhook_events","auth_moderation_events","auth_device_lock_accounts"]);
const AUTH_D1_DDL = Object.freeze([
  "CREATE TABLE IF NOT EXISTS auth_users (\n  id TEXT PRIMARY KEY,\n  email TEXT NOT NULL COLLATE NOCASE UNIQUE,\n  full_name TEXT NOT NULL,\n  password_salt TEXT NOT NULL,\n  password_hash TEXT NOT NULL,\n  password_iterations INTEGER NOT NULL DEFAULT 250000,\n  role TEXT NOT NULL DEFAULT 'member',\n  redeem_code TEXT NOT NULL DEFAULT '',\n  created_at INTEGER NOT NULL,\n  updated_at INTEGER NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS auth_verifications (\n  email TEXT NOT NULL COLLATE NOCASE,\n  purpose TEXT NOT NULL,\n  code_hash TEXT NOT NULL,\n  payload_json TEXT,\n  created_at INTEGER NOT NULL,\n  expires_at INTEGER NOT NULL,\n  attempts INTEGER NOT NULL DEFAULT 0,\n  last_sent_at INTEGER NOT NULL,\n  PRIMARY KEY (email, purpose)\n)",
  "CREATE TABLE IF NOT EXISTS auth_sessions (\n  token_hash TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  expires_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_auth_verifications_expiry ON auth_verifications(expires_at)",
  "CREATE TABLE IF NOT EXISTS auth_trusted_devices (\n  user_id TEXT NOT NULL,\n  device_hash TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  last_seen_at INTEGER NOT NULL,\n  PRIMARY KEY (user_id, device_hash),\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_trusted_devices_recent ON auth_trusted_devices(user_id, last_seen_at DESC)",
  "CREATE TABLE IF NOT EXISTS auth_user_bans (\n  user_id TEXT PRIMARY KEY,\n  reason TEXT NOT NULL,\n  banned_by TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE TABLE IF NOT EXISTS auth_banned_devices (\n  device_hash TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  reason TEXT NOT NULL,\n  banned_by TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_user_bans_created ON auth_user_bans(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_auth_banned_devices_user ON auth_banned_devices(user_id)",
  "CREATE TABLE IF NOT EXISTS membership_orders (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  plan_id TEXT NOT NULL,\n  amount INTEGER NOT NULL,\n  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','expired')),\n  payment_provider TEXT NOT NULL DEFAULT 'manual',\n  provider_transaction_id TEXT,\n  created_at INTEGER NOT NULL,\n  paid_at INTEGER,\n  expires_at INTEGER,\n  reviewed_by TEXT,\n  note TEXT NOT NULL DEFAULT '',\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_provider_tx\n  ON membership_orders(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL",
  "CREATE INDEX IF NOT EXISTS idx_membership_user_created\n  ON membership_orders(user_id, created_at DESC)",
  "CREATE INDEX IF NOT EXISTS idx_membership_status_created\n  ON membership_orders(status, created_at DESC)",
  "CREATE TABLE IF NOT EXISTS user_memberships (\n  user_id TEXT PRIMARY KEY,\n  plan_id TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),\n  started_at INTEGER NOT NULL,\n  expires_at INTEGER,\n  updated_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE TABLE IF NOT EXISTS auth_device_accounts (\n  device_hash TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  first_seen_at INTEGER NOT NULL,\n  last_seen_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_device_accounts_user\n  ON auth_device_accounts(user_id)",
  "CREATE TABLE IF NOT EXISTS redeem_codes (\n  code_hash TEXT PRIMARY KEY,\n  reward_id TEXT NOT NULL DEFAULT 'legendary_launch',\n  max_redemptions INTEGER NOT NULL DEFAULT 1 CHECK(max_redemptions BETWEEN 1 AND 10000),\n  redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK(redeemed_count >= 0),\n  expires_at INTEGER,\n  created_at INTEGER NOT NULL,\n  created_by TEXT NOT NULL,\n  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),\n  note TEXT NOT NULL DEFAULT ''\n)",
  "CREATE TABLE IF NOT EXISTS redeem_redemptions (\n  id TEXT PRIMARY KEY,\n  code_hash TEXT NOT NULL,\n  user_id TEXT NOT NULL,\n  redeemed_at INTEGER NOT NULL,\n  reward_expires_at INTEGER,\n  UNIQUE(code_hash,user_id),\n  FOREIGN KEY (code_hash) REFERENCES redeem_codes(code_hash) ON DELETE CASCADE,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_redeem_user_recent\n  ON redeem_redemptions(user_id,redeemed_at DESC)",
  "CREATE TABLE IF NOT EXISTS user_cosmetics (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  cosmetic_id TEXT NOT NULL,\n  source TEXT NOT NULL,\n  acquired_at INTEGER NOT NULL,\n  expires_at INTEGER,\n  equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_user_cosmetics_active\n  ON user_cosmetics(user_id,expires_at)",
  "CREATE TABLE IF NOT EXISTS poketo_webhook_events (\n  event_id TEXT PRIMARY KEY,\n  event_type TEXT NOT NULL,\n  received_at INTEGER NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS idx_poketo_webhook_received\n  ON poketo_webhook_events(received_at DESC)",
  "CREATE TABLE IF NOT EXISTS auth_moderation_events (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  user_id TEXT NOT NULL,\n  action TEXT NOT NULL CHECK(action IN ('ban','unban')),\n  reason TEXT NOT NULL,\n  actor_id TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_moderation_events_user\n  ON auth_moderation_events(user_id,created_at DESC)",
  "CREATE TABLE IF NOT EXISTS auth_device_lock_accounts (\n  lock_hash TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  last_seen_at INTEGER NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE\n)",
  "CREATE INDEX IF NOT EXISTS idx_auth_device_lock_accounts_user\n  ON auth_device_lock_accounts(user_id,last_seen_at DESC)"
]);
export async function authD1TableNames(db){
  if(!db||typeof db.prepare!=="function")return [];
  const query="SELECT name FROM sqlite_master WHERE type='table' AND name IN ("+AUTH_D1_TABLES.map(()=>"?").join(",")+")";
  const stmt=db.prepare(query).bind(...AUTH_D1_TABLES);
  const response=await stmt.all();
  return (response?.results||[]).map(row=>String(row.name||""));
}
export async function ensureAuthD1Schema(db){
  if(!db||typeof db.prepare!=="function")throw new Error("AUTH_DB_NOT_BOUND");
  const current=new Set(await authD1TableNames(db));
  const missing=AUTH_D1_TABLES.filter(name=>!current.has(name));
  if(!missing.length)return {ready:true,bootstrapped:false,missing:[]};
  // Every source migration uses IF NOT EXISTS. Running it twice is safe
  // even if multiple Worker isolates start at the same time.
  for(const sql of AUTH_D1_DDL)await db.prepare(sql).run();
  const completed=new Set(await authD1TableNames(db));
  const stillMissing=AUTH_D1_TABLES.filter(name=>!completed.has(name));
  if(stillMissing.length)throw new Error("AUTH_D1_MISSING_TABLES_AFTER_BOOTSTRAP");
  return {ready:true,bootstrapped:true,missing:[]};
}
