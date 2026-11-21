import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MembershipStore } from "../src/membership-store.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  async get(k) { return structuredClone(this.values.get(k)); }
  async put(k, v) { this.values.set(k, structuredClone(v)); }
  async delete(k) { this.values.delete(k); }
}

const browserUi = readFileSync(new URL("../public/membership-ui.js", import.meta.url), "utf8");
assert.ok(browserUi.includes("function syncAirPayCooldownUI()"), "Retry timer must be synchronized with the server");
assert.ok(browserUi.includes("function checkAirPayReadiness()"), "Retry button must fetch readiness without creating an invoice");
assert.ok(browserUi.includes('api("/api/membership/payment-config"'), "Readiness check must use GET config");
assert.ok(browserUi.includes('byId("membershipCheckoutRetry")?.addEventListener("click", checkAirPayReadiness)'));
assert.ok(!browserUi.includes('window.setTimeout(() => {retry.disabled = false; retry.textContent = "Coba buat QRIS lagi";}'),
  "Old one-shot 90-second retry must not return");

const storage = new MemoryStorage();
const store = new MembershipStore({ storage }, {
  AIRPAY_API_KEY: "ak_test_429_regression",
  ARYANZZ_PAYMENT_MODE: "sandbox"
});
const cookie = "aryanzz_device_lock=" + "c".repeat(64);
const request = (path, method = "GET") => new Request("https://aryanzz.test" + path, {
  method, headers: { cookie, ...(method === "POST" ? {"content-type":"application/json"} : {}) },
  ...(method === "POST" ? {body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"qris"})} : {})
});
const originalFetch = globalThis.fetch;
let providerCalls = 0;
try {
  globalThis.fetch = async (url) => {
    assert.equal(new URL(url).pathname, "/api/qris/create");
    providerCalls++;
    return new Response(JSON.stringify({success:false,message:"Too many requests"}), {
      status:429,
      headers:{"content-type":"application/json","retry-after":"90"}
    });
  };
  const initial = await store.fetch(request("/api/membership/orders","POST"));
  assert.equal(initial.status, 429);
  const first = await initial.json();
  assert.equal(first.code, "AIRPAY_RATE_LIMITED");
  assert.equal(first.retryAfterSeconds, 90);
  assert.equal(first.rateLimitAttempts, 1);
  assert.equal(providerCalls, 1);

  const config = await (await store.fetch(request("/api/membership/payment-config"))).json();
  assert.equal(config.rateLimited, true, "All devices should know AirPay is currently throttling");
  assert.equal(config.rateLimitAttempts, 1);
  assert.ok(config.retryAfterSeconds > 0);
  const second = await store.fetch(request("/api/membership/orders","POST"));
  assert.equal(second.status, 429, "A repeat click during cooldown must be handled locally");
  assert.equal(providerCalls, 1, "A second request must not reach AirPay");

  // Simulate provider cooldown elapsing; AirPay is STILL returning 429.
  let prior = await storage.get("airpay-create-rate-limit-v2");
  await storage.put("airpay-create-rate-limit-v2", {...prior,until:Date.now()-1000});
  await storage.put("airpay-create-rate-limit-until", Date.now()-1000);
  const third = await (await store.fetch(request("/api/membership/orders","POST"))).json();
  assert.equal(providerCalls, 2, "One explicit new attempt may reach AirPay after the wait");
  assert.equal(third.rateLimitAttempts, 2);
  assert.ok(third.retryAfterSeconds >= 180, "Persistent 429 must back off beyond 90 seconds");

  prior = await storage.get("airpay-create-rate-limit-v2");
  await storage.put("airpay-create-rate-limit-v2", {...prior,until:Date.now()-1000});
  await storage.put("airpay-create-rate-limit-until", Date.now()-1000);
  const fourth = await (await store.fetch(request("/api/membership/orders","POST"))).json();
  assert.equal(providerCalls, 3);
  assert.equal(fourth.rateLimitAttempts, 3);
  assert.ok(fourth.retryAfterSeconds >= 360, "Consecutive 429s must not reset to 90");
  assert.equal((await store.fetch(request("/api/membership/orders","POST"))).status, 429);
  assert.equal(providerCalls, 3, "Global backoff must prevent requests from any client");

  const me = await (await store.fetch(request("/api/membership/me"))).json();
  assert.notEqual(me.membership?.status, "active", "Repeated 429s must never grant Membership");
  assert.ok(me.orders.every(order => order.status !== "pending"), "Failed gateway creations cannot look payable");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("ARYANZZ repeat AirPay HTTP 429 cooldown and manual-readiness regression passed.");
