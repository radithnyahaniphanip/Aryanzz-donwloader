# ARYANZZ V1 Membership Payments

## Current GoPay Merchant QRIS mode

The existing `MEMBERSHIP_QRIS_IMAGE_URL` setting displays the merchant's QRIS image. This mode creates a pending order and requires the owner to check the GoPay Merchant transaction list before approving it in Membership Center. A static QR image alone cannot notify a Cloudflare Worker that a customer has paid.

## Signed payment webhook contract

The Worker exposes:

`POST https://<ARYANZZ_HOST>/api/membership/webhook`

The endpoint accepts only a server-to-server callback signed with the secret stored as the Cloudflare Worker secret `MEMBERSHIP_WEBHOOK_SECRET` (minimum 32 characters). Never put this secret in browser JavaScript, HTML, or this repository.

Required headers:

- `Content-Type: application/json`
- `X-ARYANZZ-Timestamp: <Unix timestamp in milliseconds>`
- `X-ARYANZZ-Signature: <lowercase hex HMAC-SHA256>`

Required JSON body:

```json
{
  "orderId": "ARYM-ORDER-ID",
  "amount": 80000,
  "transactionId": "UNIQUE_PROVIDER_TRANSACTION_ID",
  "status": "paid"
}
```

Signature input is the UTF-8 string:

```
<TIMESTAMP>.<ORDER_ID>.<AMOUNT>.<TRANSACTION_ID>.<STATUS>
```

Calculate HMAC-SHA256 over that exact string using `MEMBERSHIP_WEBHOOK_SECRET`; send the 64-character lowercase hex digest in `X-ARYANZZ-Signature`. The timestamp must be within five minutes of the Worker clock. Status must be `paid`, `success`, or `settlement`.

The Worker independently checks the pending order, exact amount, QRIS method, and unique provider transaction ID. It activates the plan only after those checks pass. Replayed or duplicate callbacks cannot extend the membership twice.

## Provider connection still required for automatic payment

This endpoint is the secure ARYANZZ receiver, not a connection to the GoPay Merchant app by itself. To enable end-to-end automatic activation, the payment provider or a trusted server-side integration must create/identify each payment and send the signed callback above only after confirming the settlement in the merchant account. Do not forward screenshots or a customer-controlled "I paid" button as proof of settlement.

Until that provider connection is configured, use the Owner payment review queue and verify the incoming payment in GoPay Merchant before approving the pending order.
