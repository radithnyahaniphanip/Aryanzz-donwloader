# ARYANZZ V2 — external account database with Turso

ARYANZZ can keep Cloudflare Workers for the website and API while storing account data in **Turso (hosted libSQL/SQLite)**. This removes the requirement for Cloudflare D1.

The Worker connects to Turso over HTTP using the official `@libsql/client/web` entry point. The adapter in `src/auth-database.js` exposes the D1-style methods already used by ARYANZZ (`prepare`, `bind`, `first`, `all`, and `run`), so the existing password hashing, email verification, sessions, trusted-device checks, moderation, and account-migration endpoints remain in place.

The Membership Durable Object remains on Cloudflare. It uses the same external account database to map each browser installation to the signed-in ARYANZZ account, allowing membership to follow the account across devices.

## 1. Create the Turso database

1. Create or sign in to a Turso account at https://turso.tech/.
2. Create a database, for example `aryanzz-auth`. Choose an available region close to the main users.
3. Copy the database URL.
4. Create a database authentication token. Treat the token as a password.

The Turso Free plan currently advertises $0/month, no credit card required, and included storage/read/write allowances. Check the current plan limits before launch: https://turso.tech/pricing.

## 2. Apply the ARYANZZ schema

From the repository root, run:

```bash
TURSO_DATABASE_URL="libsql://YOUR-DATABASE.turso.io" \
TURSO_AUTH_TOKEN="YOUR_DATABASE_TOKEN" \
npm run migrate:turso
```

The migration script applies the existing `migrations/0001_auth.sql` through `0008_device_lock_accounts.sql` files in order and records completed migrations in `aryanzz_schema_migrations`. It is safe to run again; completed migrations are skipped.

Do not put the token in source code, frontend JavaScript, or a public GitHub file.

## 3. Configure the Cloudflare Worker

In GitHub repository Settings, add these Actions secrets:

| Name | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Private Turso database token |

The deployment workflow copies them into the primary and backup Cloudflare Workers as secrets when the migration switch is enabled. It never writes the token into the repository.

After importing any existing production account data, add the repository variable `ARYANZZ_USE_TURSO` and set it to `true`. This makes the deployment workflow apply the Turso schema and skip D1 provisioning. Until that switch is enabled, the existing D1 compatibility path remains in place so a draft migration cannot unexpectedly strand current accounts.

Keep the existing authentication/security settings configured:

- `AUTH_SESSION_SECRET` — at least 32 characters, private.
- `TURNSTILE_SECRET_KEY` and `AUTH_TURNSTILE_SITE_KEY` — server and public CAPTCHA keys.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM` — required for email verification and password-reset emails.
- `AUTH_PUBLIC_ACCOUNTS_ENABLED` — leave unset or set to `true` to allow public registration.

The Turso token is read only by the Worker. It is never sent to the browser. If Turso credentials are configured, Turso takes precedence over any old D1 binding. D1 remains only as a backward-compatibility fallback.

## 4. Verify before enabling public registration

Open:

```text
https://aryanzz-donwloader.aryanz.workers.dev/api/auth/config
```

Expected state after deployment and configuration:

- `ready: true`
- `loginReady: true`
- `registrationReady: true`
- `missingLogin: []`
- `missingRegistration: []`

Do not announce online registration as active until these checks pass and a real test registration, email verification, login, logout, and cross-device login have succeeded.

## 5. Existing accounts and safe migration

### Accounts saved only in the old browser

The existing frontend has a legacy-account migration flow. On the same browser where the old account is stored, sign in with its existing email/ID and password. If the account is not yet online, the frontend can submit the legacy account record for email verification and migration. The flow is designed to preserve the ARYANZZ account ID and existing password hash. Keep the old browser storage intact until migration and a fresh login have both been tested.

This migration requires the account's email inbox and the configured Resend sender.

### Accounts already stored in a production D1 database

Do **not** switch the Worker to Turso until any existing production D1 data has been exported and imported. Preserve account IDs, email addresses, password salts/hashes/iteration counts, roles, bans, trusted-device records, primary-device records, and `auth_device_lock_accounts` mappings. Decide deliberately whether to invalidate old sessions and temporary verification codes. The current migration script creates schema only; it does not copy production records.

Keep a backup of the existing database before changing the live database connection.

## 6. Security notes

- Never place `TURSO_AUTH_TOKEN` in browser code, a checked-in `wrangler.toml`, screenshots, or chat.
- Do not use LocalStorage as the source of truth for paid membership or account permissions. LocalStorage remains only as a legacy/offline fallback.
- Membership access must continue to be checked by the Worker/ Durable Object, not by a client-side membership flag.
- Test registration, verification, login, logout, password reset, account migration, moderation, and AirPay membership on a staging deployment before production.
