# ARYANZZ V1 Membership payment setup

## Current payment flow

- Membership orders are stored in Cloudflare D1 (AUTH_DB).
- The QRIS image is supplied through the Worker secret MEMBERSHIP_QRIS_IMAGE_URL (an HTTPS image URL).
- Buyers must enter the exact order amount when paying a static QRIS.
- A static QRIS image does not contain an order ID and does not send an order-specific callback to this Worker. Do not claim automatic payment detection from the image alone.
- Until an official payment API or trusted payment-notification bridge is connected, the owner must check the incoming GoPay Merchant transaction and approve/reject the matching pending order from the owner-only Membership verification area.
- Membership is activated only after the owner confirms that the exact amount was received, or after an authenticated payment webhook has verified the exact order ID, transaction ID, and amount.

## Required account database setup

The live production check must show `checkoutEnabled: true` before users can create orders. If it is false, the Worker has no `AUTH_DB` binding yet.

1. In Cloudflare Dashboard, open Workers & Pages → `aryanzz-donwloader` → Settings → Bindings.
2. Add a D1 database binding with variable name `AUTH_DB` and select (or create) database `aryanzz-auth-db`.
3. In GitHub repository Settings → Secrets and variables → Actions, add `ARYANZZ_AUTH_DB_ID` with that D1 database UUID. Ensure `CLOUDFLARE_API_TOKEN` has D1:Edit permission so deployment can apply migrations.
4. Ensure `AUTH_SESSION_SECRET` is set. For the complete online login/registration flow, also configure `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (verified sender), `TURNSTILE_SECRET_KEY`, and `AUTH_TURNSTILE_SITE_KEY`.
5. Push or run the deployment workflow again, then verify `/api/auth/config` reports `ready: true` and `/api/membership/payment-config` reports `checkoutEnabled: true`.

## Cloudflare / GitHub settings

Add these GitHub Actions repository secrets:

- MEMBERSHIP_QRIS_IMAGE_URL: public HTTPS URL of the merchant's own QRIS image. Never use a QR image belonging to another merchant.
- MEMBERSHIP_WEBHOOK_SECRET: random secret of at least 32 characters. Generate with openssl rand -hex 32. This only authenticates a trusted server-to-server bridge; it is not a GoPay API credential.

The deployment workflow syncs both secrets to the production Worker. Existing AUTH_DB and AUTH_SESSION_SECRET configuration is still required for centrally stored accounts, order history and Membership entitlements.

## Payment webhook contract

Endpoint: POST https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/api/membership/webhook

Headers: Content-Type: application/json; X-ARYANZZ-TIMESTAMP: <13-digit Unix milliseconds>; X-ARYANZZ-SIGNATURE: <lowercase hex HMAC-SHA256>

Body for a confirmed successful payment:

{"orderId":"ARYM-ORDER-ID","transactionId":"UNIQUE-PROVIDER-TRANSACTION-ID","amount":80000,"status":"paid"}

Signature calculation (server-side only): create the canonical string timestamp.orderId.amount.transactionId.status, then calculate HMAC-SHA256 using MEMBERSHIP_WEBHOOK_SECRET as the key. Send the timestamp and 64-character lowercase hexadecimal digest in the headers. The timestamp must be within five minutes of Worker time. Never calculate this signature in browser code.

Rules:
- Send the callback only from a trusted server-side payment integration after it has independently verified the provider's transaction status.
- amount must be the exact integer rupiah amount stored on the order.
- transactionId must be unique per provider transaction.
- The endpoint is idempotent: replaying the same successful event does not grant Membership twice.
- Failed, pending, cancelled or expired provider statuses never activate Membership.
- Never call this endpoint from browser JavaScript or expose the webhook secret to customers.

This endpoint is a generic signed trusted-bridge contract. It does not mean GoPay Merchant static QRIS directly supports this callback. Connect only an official provider API/notification or a properly authorized payment service that can verify the transaction. Do not use notification scraping, device accessibility listeners, or unofficial app automation as payment proof.

## Test before launch
1. Configure D1 and confirm migrations have completed.
2. Configure the QRIS image URL and webhook secret.
3. Create a low-value test order using an approved sandbox/test payment provider.
4. Send one valid callback and confirm the order becomes paid and Membership becomes active.
5. Replay the same callback; it must report a duplicate without extending Membership again.
6. Try a wrong amount, unknown order, reused transaction ID, invalid secret and pending status; none may activate Membership.
7. For the static GoPay QRIS image, keep manual owner verification until an official machine-readable payment notification is connected.