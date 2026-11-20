import assert from "node:assert/strict";
import fs from "node:fs";
import { handleAirpayMembership } from "../src/airpay-membership.js";

const source = fs.readFileSync(new URL("../src/airpay-membership.js", import.meta.url), "utf8");
const frontend = fs.readFileSync(new URL("../public/membership.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../migrations/0009_airpay_membership.sql", import.meta.url), "utf8");

const catalogResponse = await handleAirpayMembership(new Request("https://aryanzz.example/api/membership/catalog"), {});
const catalog = await catalogResponse.json();
assert.equal(catalogResponse.status, 200);
assert.equal(catalog.provider, "AirPay");
assert.equal(catalog.plans.length, 8);
const priceMap = Object.fromEntries(catalog.plans.map(plan => [plan.id, plan.price]));
assert.deepEqual(priceMap, {
  "basic-monthly": 10000,
  "basic-yearly": 40000,
  "pro-monthly": 66000,
  "pro-yearly": 127000,
  "ultra-monthly": 200000,
  "ultra-yearly": 370000,
  "max-monthly": 600000,
  "max-yearly": 1600000
});
assert.ok(catalog.plans.every(plan => Array.isArray(plan.benefits) && plan.benefits.length >= 3));

const missingConfigResponse = await handleAirpayMembership(new Request("https://aryanzz.example/api/membership/payment-config"), {});
const missingConfig = await missingConfigResponse.json();
assert.equal(missingConfig.checkoutEnabled, false);
assert.equal(missingConfig.provider, "AirPay");
assert.ok(missingConfig.missing.includes("AUTH_DB · database akun ARYANZZ"));
assert.ok(missingConfig.missing.includes("AIRPAY_API_KEY · API key AirPay sandbox/live"));

const readyConfigResponse = await handleAirpayMembership(new Request("https://aryanzz.example/api/membership/payment-config"), {
  AIRPAY_API_KEY: "ak_test_0123456789abcdef",
  AUTH_DB: { prepare() {} }
});
const readyConfig = await readyConfigResponse.json();
assert.equal(readyConfig.checkoutEnabled, true);
assert.equal(readyConfig.mode, "sandbox");
assert.equal(readyConfig.webhookSupported, true);
assert.equal(readyConfig.pollingFallback, true);
assert.equal(readyConfig.missing.length, 0);

const noSessionResponse = await handleAirpayMembership(new Request("https://aryanzz.example/api/membership/orders", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ planId: "pro-monthly" })
}), {
  AUTH_SESSION_SECRET: "test-secret",
  AIRPAY_API_KEY: "ak_test_0123456789abcdef",
  AUTH_DB: { prepare() { return { bind() { return { first: async () => null }; } }; } }
});
assert.equal(noSessionResponse.status, 401, "Orders must require a logged-in ARYANZZ account");

const invalidWebhookResponse = await handleAirpayMembership(new Request("https://aryanzz.example/api/membership/webhook", {
  method: "POST",
  headers: { "X-AirPay-Signature": "0".repeat(64), "content-type": "application/json" },
  body: JSON.stringify({ status: "Success", external_id: "ARYM-FAKE", transaction_id: "ARYM-FAKE" })
}), {
  AIRPAY_API_KEY: "ak_test_0123456789abcdef",
  AUTH_DB: { prepare() {} }
});
assert.equal(invalidWebhookResponse.status, 401, "Unsigned payment callbacks must never activate Membership");

assert.ok(source.includes('headers.set("X-API-Key",airpayKey(env))'));
assert.ok(source.includes('"/api/qris/create"'));
assert.ok(source.includes('"/api/qris/status?transaction_id="'));
assert.ok(source.includes("X-AirPay-Signature"));
assert.ok(source.includes("external_id"));
assert.ok(source.includes("statusName(data.status)===\"paid\""));
assert.ok(source.includes("INSERT OR IGNORE INTO airpay_webhook_events"));
assert.ok(!source.includes("POKETO_SECRET_KEY"));
assert.ok(frontend.includes("/api/membership/orders/status?orderId="));
assert.ok(frontend.includes("QRIS"));
assert.ok(frontend.includes("tidak perlu memasukkan nomor rekening"));
assert.ok(html.includes('data-nav="membership"'));
assert.ok(html.includes('id="aryMembershipPlans"'));
assert.ok(html.includes('/membership.js?v=__ARYANZZ_VERSION__'));
assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS airpay_webhook_events"));
assert.ok(migration.includes("provider_total_amount"));
console.log("ARYANZZ AirPay Membership tests passed.");
