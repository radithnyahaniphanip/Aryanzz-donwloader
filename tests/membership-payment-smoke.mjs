import assert from "node:assert/strict";
import fs from "node:fs";
import { handleMembership } from "../src/membership.js";

const source = fs.readFileSync(new URL("../src/membership.js", import.meta.url), "utf8");
const frontend = fs.readFileSync(new URL("../public/membership.js", import.meta.url), "utf8");
const missing = await handleMembership(new Request("https://aryanzz.example/api/membership/payment-config"), {});
const missingBody = await missing.json();
assert.equal(missingBody.enabled, false);
assert.equal(missingBody.checkoutEnabled, false);
assert.equal(missingBody.automaticWebhookReady, false);
assert.ok(missingBody.missing.includes("AUTH_DB · database D1 ARYANZZ"));
assert.ok(missingBody.missing.includes("POKETO_SECRET_KEY · API key sandbox/live"));
assert.ok(missingBody.missing.includes("POKETO_WEBHOOK_SECRET · signing secret webhook"));
assert.equal(missingBody.webhookUrl, "https://aryanzz.example/api/membership/webhook");

const live = await handleMembership(new Request("https://aryanzz.example/api/membership/payment-config"), {
  POKETO_SECRET_KEY: "sk_live_example"
});
const liveBody = await live.json();
assert.equal(liveBody.mode, "live", "Live mode must be inferred from sk_live_ when explicit mode is omitted");
assert.equal(liveBody.apiKeyReady, true);
assert.equal(liveBody.webhookReady, false);

const sandbox = await handleMembership(new Request("https://aryanzz.example/api/membership/payment-config"), {
  POKETO_SECRET_KEY: "sk_test_example",
  POKETO_WEBHOOK_SECRET: "whsec_example_secret",
  AUTH_DB: { prepare() {} }
});
const sandboxBody = await sandbox.json();
assert.equal(sandboxBody.mode, "sandbox");
assert.equal(sandboxBody.enabled, true);
assert.equal(sandboxBody.checkoutEnabled, true);
assert.equal(sandboxBody.automaticWebhookReady, true);
assert.deepEqual(sandboxBody.missing, []);

assert.ok(!/data-buy=[^>]*disabled/.test(frontend), "Membership checkout buttons must remain clickable so users can see readiness errors");
assert.ok(frontend.includes("Bayar sekarang"), "Every membership plan must expose a Bayar sekarang action");
assert.ok(frontend.includes("paymentConfig.missing.join"), "Checkout UI must explain exact missing configuration");
assert.ok(source.includes("POKETO_WEBHOOK_SECRET belum terpasang"), "Invoice creation must fail closed if webhook signature verification is unavailable");
assert.ok(source.includes("poketoMode(env)"), "Webhook environment must match the API key mode");
console.log("ARYANZZ Membership payment readiness and checkout tests passed.");
