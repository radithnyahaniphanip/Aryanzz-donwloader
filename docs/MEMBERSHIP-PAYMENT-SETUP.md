# ARYANZZ V1 Membership payment setup

## Current payment flow

- Membership orders are stored in Cloudflare D1 (AUTH_DB).
- The QRIS image is supplied through the Worker secret MEMBERSHIP_QRIS_IMAGE_URL (an HTTPS image URL).
- Buyers must enter the exact order amount when paying a static QRIS.
- A static QRIS image does not contain an order ID and does not send an order-specific callback to this Worker. Do not claim automatic payment detection from the image alone.
- Until an official payment API or trusted payment-notification bridge is connected, the owner must check the incoming GoPay Merchant transaction and approve/reject the matching pending order from the owner-only Membership verification area.
- Membership is activated only after the owner confirms that the exact amount was received, or after an authenticated payment webhook has verified the exact order ID, transaction ID, and amount.

## Cloudflare / GitHub settings

Add these GitHub Actions repository secrets:

- MEMBERSHIP_QRIS_IMAGE_URL: public HTTPS URL of the merchant's own QRIS image. Never use a QR image belonging to another merchant.
- MEMBERSHIP_WEBHOOK_SECRET: random secret of at least 32 characters. Generate with openssl rand -hex 32. This only authenticates a trusted server-to-server bridge; it is not a GoPay API credential.

The deployment workflow syncs both secrets to the production Worker. Existing AUTH_DB and AUTH_SESSION_SECRET configuration is still required for centrally stored accounts, order history and Membership entitlements.

## Payment webhook contract

Endpoint: POST https://aryanzz-donwloader.radithnyahaniphanip.workers.dev/api/membership/webhooks/payment

Headers: Authorization: Bearer <MEMBERSHIP_WEBHOOK_SECRET>; Content-Type: application/json

Body for a confirmed successful payment:

{"orderId":"ARYM-ORDER-ID","transactionId":"UNIQUE-PROVIDER-TRANSACTION-ID","amount":80000,"status":"paid"}

Rules:
- Send the callback only from a trusted server-side payment integration after it has independently verified the provider's transaction status.
- amount must be the exact integer rupiah amount stored on the order.
- transactionId must be unique per provider transaction.
- The endpoint is idempotent: replaying the same successful event does not grant Membership twice.
- Failed, pending, cancelled or expired provider statuses never activate Membership.
- Never call this endpoint from browser JavaScript or expose the webhook secret to customers.

This endpoint is a generic trusted-bridge contract. It does not mean GoPay Merchant static QRIS directly supports this callback. Connect only an official provider API/notification or a properly authorized payment service that can verify the transaction. Do not use notification scraping, device accessibility listeners, or unofficial app automation as payment proof.

## Test before launch
1. Configure D1 and confirm migrations have completed.
2. Configure the QRIS image URL and webhook secret.
3. Create a low-value test order using an approved sandbox/test payment provider.
4. Send one valid callback and confirm the order becomes paid and Membership becomes active.
5. Replay the same callback; it must report a duplicate without extending Membership again.
6. Try a wrong amount, unknown order, reused transaction ID, invalid secret and pending status; none may activate Membership.
7. For the static GoPay QRIS image, keep manual owner verification until an official machine-readable payment notification is connected.