import assert from "node:assert/strict";
import { MembershipStore } from "../src/membership-store.js";

class MemoryStorage {
  constructor() { this.values = new Map(); this.alarmAt = null; }
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async delete(key) { return this.values.delete(key); }
  async list({ prefix = "", limit = 1000 } = {}) {
    const result = new Map();
    for (const [key, value] of this.values) {
      if (String(key).startsWith(prefix) && result.size < limit) result.set(key, structuredClone(value));
    }
    return result;
  }
  async getAlarm() { return this.alarmAt; }
  async setAlarm(value) { this.alarmAt = value; }
  async deleteAlarm() { this.alarmAt = null; }
}

const deviceToken = "a".repeat(64);
const requestHeaders = { cookie: "aryanzz_device_lock=" + deviceToken };
const storage = new MemoryStorage();
const ctx = { storage };
const env = { AIRPAY_API_KEY: "ak_test_aryanzz-membership-smoke" };
let invoice = null;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.pathname === "/api/qris/create") {
    const body = JSON.parse(init.body || "{}");
    invoice = {
      transaction_id: "AIRPAY-SMOKE-001",
      external_id: body.external_id,
      status: "Pending",
      base_amount: Number(body.amount),
      fee_amount: 25,
      total_amount: Number(body.amount) + 25,
      qr_url: "https://airpaygateway.site/qr/smoke.png",
      pay_url: "https://airpaygateway.site/invoice/smoke",
      expiry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
    return new Response(JSON.stringify({ success: true, data: invoice }), { status: 200 });
  }
  if (url.pathname === "/api/qris/status") {
    assert.equal(url.searchParams.get("transaction_id"), invoice.transaction_id);
    return new Response(JSON.stringify({
      success: true,
      data: { ...invoice, status: "Success" }
    }), { status: 200 });
  }
  throw new Error("Unexpected mocked URL: " + url.href);
};

try {
  const store = new MembershipStore(ctx, env);
  const request = path => new Request("https://aryanzz.test" + path, { headers: requestHeaders });

  const catalog = await store.fetch(request("/api/membership/catalog"));
  const catalogData = await catalog.json();
  assert.equal(catalogData.plans.find(plan => plan.id === "starter").monthlyPrice, 10000);
  assert.equal(catalogData.plans.find(plan => plan.id === "starter").yearlyPrice, 40000);
  assert.equal(catalogData.plans.find(plan => plan.id === "pro").monthlyPrice, 66000);
  assert.equal(catalogData.plans.find(plan => plan.id === "pro").yearlyPrice, 127000);
  assert.equal(catalogData.plans.find(plan => plan.id === "ultra").monthlyPrice, 200000);
  assert.equal(catalogData.plans.find(plan => plan.id === "ultra").yearlyPrice, 370000);
  assert.equal(catalogData.plans.find(plan => plan.id === "max").monthlyPrice, 600000);
  assert.equal(catalogData.plans.find(plan => plan.id === "max").yearlyPrice, 1600000);

  const config = await store.fetch(request("/api/membership/payment-config"));
  const configData = await config.json();
  assert.equal(configData.checkoutEnabled, true, "device-bound checkout should work without D1");
  assert.equal(configData.identityMode, "device");
  assert.equal(configData.authReady, false, "cross-device account sync remains optional without D1");

  const create = await store.fetch(new Request("https://aryanzz.test/api/membership/orders", {
    method: "POST",
    headers: { ...requestHeaders, "content-type": "application/json" },
    body: JSON.stringify({ planId: "starter", billingPeriod: "monthly" })
  }));
  assert.equal(create.status, 201);
  const created = await create.json();
  assert.equal(created.ok, true);
  assert.match(created.order.id, /^ARYM-/);
  assert.equal(created.order.amount, 10000);
  assert.equal(created.order.totalAmount, 10025);
  assert.equal(created.order.checkoutExpired, false);
  assert.equal(created.order.checkoutExpiresAt - created.order.createdAt, 10 * 60 * 1000);
  assert.equal(created.payment.qrUrl, "https://airpaygateway.site/qr/smoke.png");

  const status = await store.fetch(request("/api/membership/orders/status?orderId=" + encodeURIComponent(created.order.id)));
  assert.equal(status.status, 200);
  const statusData = await status.json();
  assert.equal(statusData.order.status, "paid");
  assert.equal(statusData.membership.tier, "starter");
  assert.equal(statusData.membership.status, "active");
  assert.ok(statusData.membership.expiresAt > Date.now());

  console.log("MembershipStore AirPay smoke test passed.");
} finally {
  globalThis.fetch = originalFetch;
}
