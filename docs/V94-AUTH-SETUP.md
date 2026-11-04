# ARYANZZ V94 account setup

The registration/login gate is intentionally inactive until a Cloudflare D1 database is attached. This prevents the public site from becoming inaccessible while the database is not configured.

## 1. Create the D1 database

In Cloudflare Dashboard:

1. Open **Workers & Pages**.
2. Open **D1 SQL Database**.
3. Create a database named `aryanzz-users`.
4. Copy its **Database ID** (this is an identifier, not an API token or password).

## 2. Apply the schema

Open the new D1 database's SQL Console and run the SQL from `migrations/0003_auth.sql`.

## 3. Attach the database to the Worker

In `wrangler.toml`, uncomment and fill this binding with the actual ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "aryanzz-users"
database_id = "YOUR_REAL_DATABASE_ID"
```

Do not commit API tokens, passwords, or Cloudflare account secrets. The database ID itself is not a secret, but it must be the real ID returned by Cloudflare.

## 4. Deploy and verify

Deploy the Worker, then check `/api/auth/config`. It should return `enabled: true`. Only then does the registration/login gate become mandatory.

## Security behavior

- Passwords are hashed with PBKDF2-HMAC-SHA-256, a per-account random salt, and 600,000 iterations. Plaintext passwords are never stored.
- Sessions use random tokens stored as SHA-256 hashes in D1 and are delivered in Secure, HttpOnly, SameSite=Strict cookies.
- Registration and login have a stricter per-IP request limit.
- Password policy: at least 12 characters, lowercase, uppercase, number, and symbol.
- The redeem-code field is optional and currently stored as a registration note; redemption benefits/validation are not configured yet.
- Email is used as the login identifier. Email ownership verification and password-reset email delivery require an email provider and are not enabled yet.
