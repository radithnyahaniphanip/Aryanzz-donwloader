import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MembershipStore } from "../src/membership-store.js";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const html = read("public/index.html");
const ui = read("public/membership-ui.js");
const css = read("public/membership.css");
const queue = read("public/download-queue.js");
const speed = read("public/speed-test.js");
const guides = read("public/workspace-guides.css");
const profile = read("public/auth-profile-v1.css");

assert.ok(html.includes('id="membershipClearFailed"'), "Remove failed history action must exist");
assert.ok(!html.includes("Buka halaman pembayaran resmi AirPay"), "Unneeded provider redirect text must be removed");
assert.ok(!html.includes("Di HP yang sama, buka halaman pembayaran AirPay"), "Checkout must remain compact");
assert.ok(ui.includes('"CANCELLED"') && ui.includes("checkoutExpired"), "Expired local checkout should be labelled CANCELLED");
assert.ok(ui.includes('/api/membership/orders/clear-failed'), "Failed-only history action must call server");
assert.ok(ui.includes("error.retryAfterSeconds"), "429 responses must convey retry delay");
assert.ok(css.includes("#membership .ary-membership-orders-heading"), "Clear history layout must remain usable");
assert.ok(css.includes("#membership .ary-membership-order-status.status-cancelled"), "Cancelled orders should be legible");
assert.ok(speed.includes("qualityFromMbps") && speed.includes("navigator.onLine") &&
  speed.includes("Browser tidak menyediakan data kecepatan atau sinyal radio."),
  "Network strength estimates must not fabricate unavailable browser readings");
assert.ok(html.includes('id="speedSignalLevel"') && html.includes('id="speedSignalConfidence"'), "Pre-test connection guidance must be visible");
assert.ok(profile.includes("spacious banner, avatar sits below its cover"), "Profile banner and avatar spacing must be restored");
assert.ok(guides.includes("real interactive Knowledge Center"), "Guide list should not overlap in Android desktop site mode");
assert.ok(queue.includes("queueLimit()") && queue.includes("queueLimit=()"), "Queue must enforce available member slots");
for (const [panel, tier] of [
  ["gradientStudio", "starter"], ["mediaStudio", "pro"], ["queue", "pro"],
  ["musicFinder", "pro"], ["editor", "ultra"], ["audioStudio", "ultra"],
  ["emoteStudio", "max"], ["imageTools", "max"]
]) {
  assert.ok(html.includes('data-panel="' + panel + '" data-membership-min="' + tier + '"'),
    "Tool " + panel + " should be gated to " + tier);
}

class Storage {
  constructor() { this.map = new Map(); }
  async get(k) { return structuredClone(this.map.get(k)); }
  async put(k, v) { this.map.set(k, structuredClone(v)); }
  async delete(k) { return this.map.delete(k); }
}
const storage = new Storage();
const store = new MembershipStore({ storage }, {
  AIRPAY_API_KEY: "ak_test_v2_experience_only",
  ARYANZZ_PAYMENT_MODE: "sandbox"
});
const cookie = "aryanzz_device_lock=" + "a".repeat(64);
const rq = (path, method = "GET") => new Request("https://aryanzz.test" + path, {
  method, headers: { cookie, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
  ...(method === "POST" ? { body: "{}" } : {})
});
const catalog = await (await store.fetch(rq("/api/membership/catalog"))).json();
const plans = catalog.plans;
assert.equal(plans.length, 4);
assert.equal(plans[0].queueSlots.weekly, 0);
for (const id of ["pro", "ultra", "max"]) {
  const p = plans.find(p => p.id === id);
  assert.ok(p && p.queueSlots.weekly < p.queueSlots.monthly &&
    p.queueSlots.monthly < p.queueSlots.yearly, id + " must have genuinely different period limits");
  assert.ok(p.features.every(f => !/^semua fasilitas /i.test(f)), "No inherited copy in " + id);
}
assert.ok(plans.find(p=>p.id==="pro").queueSlots.weekly < plans.find(p=>p.id==="ultra").queueSlots.weekly);
assert.ok(plans.find(p=>p.id==="ultra").queueSlots.weekly < plans.find(p=>p.id==="max").queueSlots.weekly);

const session = await store.session(rq("/api/membership/me"));
const now = Date.now();
const base = { userId: session.id, planId: "starter", planName: "Starter",
  billingPeriod: "monthly", amount: 10000, createdAt: now - 900000 };
const pending = { ...base, id: "ARYM-TEST-PENDING", status: "pending", checkoutExpiresAt: now - 1000, transactionId: "TEST-PENDING" };
const paid = { ...base, id: "ARYM-TEST-PAID", status: "paid", paidAt: now };
const rejected = { ...base, id: "ARYM-TEST-REJECTED", status: "rejected" };
const expired = { ...base, id: "ARYM-TEST-EXPIRED", status: "expired" };
const orderList = [pending, paid, rejected, expired];
await storage.put("orders:" + session.id, orderList);
for (const order of orderList) await storage.put("order:" + order.id, order);
const clear = await store.fetch(rq("/api/membership/orders/clear-failed", "POST"));
assert.equal(clear.status, 200);
assert.equal((await clear.json()).hidden, 2, "Only terminal failures can be removed");
const me = await (await store.fetch(rq("/api/membership/me"))).json();
assert.deepEqual(me.orders.map(order => order.id), [pending.id, paid.id], "Pending and paid receipts must be retained");
assert.equal(me.orders[0].checkoutExpired, true, "Checkout can expire while gateway is still pending");
assert.equal((await storage.get("order:" + rejected.id)).hiddenFromHistory, true, "Failed invoice remains stored for audit");
assert.equal((await storage.get("order:" + paid.id)).status, "paid");
assert.equal((await store.fetch(rq("/api/membership/orders/clear-failed", "POST"))).status, 200);
assert.equal((await store.fetch(new Request("https://aryanzz.test/api/membership/orders/clear-failed", { method: "POST" }))).status, 401);

await storage.put("airpay-create-rate-limit-until", Date.now() + 90000);
const limited = await store.fetch(rq("/api/membership/orders", "POST"));
assert.equal(limited.status, 429, "Repeated live invoice attempts must back off without contacting AirPay");
assert.equal((await limited.json()).code, "AIRPAY_RATE_LIMITED");

console.log("ARYANZZ V2 Membership history, quotas, network hints and UI smoke test passed.");
