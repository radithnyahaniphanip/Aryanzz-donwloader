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
const env = { AIRPAY_API_KEY: "ak_test_aryanzz-membership-smoke", AIRPAY_WEBHOOK_TEST_KEY: "ak_test_aryanzz-webhook-test-only", ARYANZZ_PAYMENT_MODE: "sandbox" };
let invoice = null;
let gatewayStatus = "Pending";
let createCalls = 0;
let rejectApiKey = false;
let rejectMerchant = false;
let failNextCreate = false;
const requestBodies = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.pathname === "/api/qris/create") {
    if (rejectApiKey) return new Response(JSON.stringify({success:false,message:"Invalid API key"}),{status:401,headers:{"content-type":"application/json"}});
    if (rejectMerchant) return new Response(JSON.stringify({success:false,message:"Merchant banned"}),{status:403,headers:{"content-type":"application/json"}});
    createCalls += 1;
    const body = JSON.parse(init.body || "{}");
    requestBodies.push(body);
    if (failNextCreate) {
      failNextCreate = false;
      throw new TypeError("Simulated upstream connection reset after receiving invoice request");
    }
    const amount = Number(body.amount);
    const fee = amount < 150000 ? Math.ceil(amount * 0.007 + 295) : Math.ceil(amount * 0.0095);
    invoice = {
      transaction_id: "AIRPAY-SMOKE-" + createCalls,
      external_id: body.external_id,
      status: gatewayStatus,
      base_amount: amount,
      fee_amount: fee,
      total_amount: amount + fee,
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
      data: { ...invoice, status: gatewayStatus }
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
  assert.equal(configData.checkoutEnabled, true, "isolated sandbox staging checkout should work without D1");
  assert.equal(configData.gatewayAuthorization, "not-verified", "Installed keys cannot prove merchant eligibility until AirPay accepts an invoice");
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
  assert.equal(created.order.totalAmount, 10365, "the Starter invoice includes the published AirPay fee");
  assert.equal(created.order.checkoutExpired, false);
  assert.equal(created.order.checkoutExpiresAt - created.order.createdAt, 10 * 60 * 1000);
  assert.equal(created.payment.qrUrl, "https://airpaygateway.site/qr/smoke.png");

  const methods = await store.fetch(request("/api/membership/payment-methods"));
  const methodsData = await methods.json();
  assert.deepEqual(methodsData.methods.map(method => method.id), ["qris"]);
  assert.match(methodsData.methods[0].description, /DANA.*GoPay.*LinkAja.*OVO.*mobile banking/i);

  const duplicate = await store.fetch(new Request("https://aryanzz.test/api/membership/orders", {
    method: "POST",
    headers: { ...requestHeaders, "content-type": "application/json" },
    body: JSON.stringify({ planId: "starter", billingPeriod: "monthly" })
  }));
  assert.equal(duplicate.status, 409, "a second invoice must not be created while the first QR is still pending");
  const duplicateData = await duplicate.json();
  assert.equal(duplicateData.code, "PENDING_ORDER_EXISTS");
  assert.equal(duplicateData.order.id, created.order.id);
  assert.equal(createCalls, 1, "AirPay should receive only one create request for the pending order");

  const storedOrder = await storage.get("order:" + created.order.id);
  storedOrder.checkoutExpiresAt = Date.now() - 1;
  await storage.put("order:" + storedOrder.id, storedOrder);
  const expiredCheckout = await store.fetch(request("/api/membership/orders/status?orderId=" + encodeURIComponent(created.order.id)));
  const expiredCheckoutData = await expiredCheckout.json();
  assert.equal(expiredCheckoutData.order.status, "pending", "the backend keeps reconciling the real AirPay invoice after the local 10-minute checkout closes");
  assert.equal(expiredCheckoutData.order.checkoutExpired, true, "the 10-minute checkout must be hidden from the customer after timeout");

  // AirPay's dashboard signs webhook.test with a sandbox key, not the live
  // invoice key. Test events must return 200 without changing an order.
  const { createHmac } = await import("node:crypto");
  const dashboardTestBody = JSON.stringify({
    event: "webhook.test",
    status: "Success",
    data: { external_id: created.order.id, transaction_id: invoice.transaction_id, status: "Success" }
  });
  const sign = (key, body) => createHmac("sha256", key).update(body).digest("hex");
  const webhookWith = (body, signature, extraHeaders = {}) => new Request("https://aryanzz.test/api/membership/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "X-AirPay-Signature": signature, ...extraHeaders },
    body
  });
  const dashboardTest = await store.fetch(webhookWith(dashboardTestBody, sign(env.AIRPAY_WEBHOOK_TEST_KEY, dashboardTestBody)));
  assert.equal(dashboardTest.status, 200, "signed dashboard webhook.test should be acknowledged");
  assert.equal((await dashboardTest.json()).event, "webhook.test");
  assert.equal((await storage.get("order:" + created.order.id)).status, "pending", "dashboard test must never mark a paid order");
  assert.equal((await storage.list({ prefix: "membership:" })).size, 0, "dashboard test must not activate any membership");

  const invalidTest = await store.fetch(webhookWith(dashboardTestBody, sign("ak_test_wrong", dashboardTestBody)));
  assert.equal(invalidTest.status, 401, "unknown sandbox signatures must be rejected");

  const forgedLiveEvent = JSON.stringify({
    event: "payment.success",
    data: { external_id: created.order.id, transaction_id: invoice.transaction_id, status: "Success" }
  });
  const sandboxSignedPayment = await store.fetch(webhookWith(forgedLiveEvent, sign(env.AIRPAY_WEBHOOK_TEST_KEY, forgedLiveEvent)));
  assert.equal(sandboxSignedPayment.status, 401, "sandbox test key must not authorize payment events");

  const headerOnlyTestBody = JSON.stringify({ status: "test", message: "AirPay webhook test" });
  const headerOnlyTest = await store.fetch(webhookWith(
    headerOnlyTestBody, sign(env.AIRPAY_WEBHOOK_TEST_KEY, headerOnlyTestBody), { "X-AirPay-Event": "webhook.test" }
  ));
  assert.equal(headerOnlyTest.status, 200, "test event named in the header must be accepted when signed");

  gatewayStatus = "Success";
  const rawWebhook = JSON.stringify({
    event: "payment.success",
    data: {
      external_id: created.order.id,
      transaction_id: invoice.transaction_id,
      status: "Success",
      base_amount: 10000,
      total_amount: invoice.total_amount
    }
  });
  const signature = sign(env.AIRPAY_API_KEY, rawWebhook);
  const webhookRequest = () => new Request("https://aryanzz.test/api/membership/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "X-AirPay-Signature": signature },
    body: rawWebhook
  });
  const webhook = await store.fetch(webhookRequest());
  assert.equal(webhook.status, 200);
  const webhookData = await webhook.json();
  assert.equal(webhookData.status, "paid");
  const duplicateWebhook = await store.fetch(webhookRequest());
  assert.equal((await duplicateWebhook.json()).duplicate, true, "replayed webhook payloads must be idempotent");

  const status = await store.fetch(request("/api/membership/orders/status?orderId=" + encodeURIComponent(created.order.id)));
  assert.equal(status.status, 200);
  const statusData = await status.json();
  assert.equal(statusData.order.status, "paid");
  assert.equal(statusData.membership.tier, "starter");
  assert.equal(statusData.membership.status, "active");
  assert.ok(statusData.membership.expiresAt > Date.now());

  // The Pro yearly invoice has a published MDR above Rp999. It must still
  // be accepted and its full payable total must be shown to the customer.
  gatewayStatus = "Pending";
  const proYearly = await store.fetch(new Request("https://aryanzz.test/api/membership/orders", {
    method: "POST",
    headers: { ...requestHeaders, "content-type": "application/json" },
    body: JSON.stringify({ planId: "pro", billingPeriod: "yearly" })
  }));
  assert.equal(proYearly.status, 201);
  const proYearlyData = await proYearly.json();
  assert.equal(proYearlyData.order.amount, 127000);
  assert.equal(proYearlyData.order.feeAmount, 1184);
  assert.equal(proYearlyData.order.totalAmount, 128184);

  // Every UI option represents a QRIS scanner preference, not a separate
  // wallet direct-transfer API. Verify one authentic AirPay invoice is created
  // per new device-bound checkout, with no additional sensitive banking data.
  for (const paymentMethod of ["qris","dana","gopay","linkaja","ovo","shopeepay","mobile_banking"]) {
    gatewayStatus = "Pending";
    const isolatedStore = new MembershipStore({storage:new MemoryStorage()},env);
    const before = createCalls;
    const testOrder = await isolatedStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
      method:"POST",
      headers:{...requestHeaders,"content-type":"application/json"},
      body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod})
    }));
    const data = await testOrder.json();
    assert.equal(testOrder.status,201,"Method "+paymentMethod+" must create a QRIS invoice: "+JSON.stringify(data));
    assert.equal(data.order.paymentMethod,paymentMethod);
    assert.equal(data.payment.provider,"AirPay QRIS");
    assert.ok(data.payment.qrUrl.startsWith("https://airpaygateway.site/qr/"));
    assert.equal(createCalls,before+1,"Only one AirPay invoice must be created per method click");
  }

  // Recover an interrupted invoice response by reusing the SAME external_id.
  // A retry must never create a different order identifier or a second charge.
  const retryStore = new MembershipStore({storage:new MemoryStorage()},env);
  const previousBodies = requestBodies.length;
  const beforeRetry = createCalls;
  failNextCreate = true;
  const recovered = await retryStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"dana"})
  }));
  const recoveredData = await recovered.json();
  assert.equal(recovered.status,201,"An idempotent retry should restore a valid AirPay QRIS invoice");
  assert.equal(recoveredData.order.paymentMethod,"dana");
  assert.equal(createCalls,beforeRetry+2,"Only one internal retry is allowed after a transient network error");
  assert.equal(requestBodies[previousBodies].external_id,requestBodies[previousBodies+1].external_id,"AirPay retry must reuse the exact external order ID");
  assert.equal(requestBodies[previousBodies].amount,requestBodies[previousBodies+1].amount,"AirPay retry must reuse the original amount");

  // Reject unsupported methods before calling the live gateway.
  const beforeInvalid = createCalls;
  const invalidMethod = await new MembershipStore({storage:new MemoryStorage()},env).fetch(
    new Request("https://aryanzz.test/api/membership/orders",{
      method:"POST",
      headers:{...requestHeaders,"content-type":"application/json"},
      body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"bank_transfer_direct",bankAccount:"123456"})
    })
  );
  assert.equal(invalidMethod.status,400);
  assert.equal(createCalls,beforeInvalid,"Unsupported payment rails must never reach AirPay");

  rejectApiKey=true;
  const rejectedKeyStore=new MembershipStore({storage:new MemoryStorage()},env);
  const priorCreates=createCalls;
  const failedInvoice=await rejectedKeyStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"qris"})
  }));
  const failedData=await failedInvoice.json();
  assert.equal(failedInvoice.status,503,"Invalid AirPay key must fail without a QRIS invoice");
  assert.equal(failedData.ok,false);
  assert.equal(failedData.code,"AIRPAY_INVALID_API_KEY");
  assert.match(failedData.error,/AIRPAY_API_KEY/);
  assert.equal(createCalls,priorCreates,"Rejected gateway authorization must not create a valid invoice");
  const failedMember=await rejectedKeyStore.fetch(request("/api/membership/me"));
  const failedMemberData=await failedMember.json();
  assert.notEqual(failedMemberData.membership?.status,"active","Rejected API key must never grant membership");
  rejectApiKey=false;

  // AirPay documents HTTP 403 as banned merchant. This must never become a
  // misleading "try QR again" status or grant membership.
  rejectMerchant = true;
  const blockedStorage = new MemoryStorage();
  const blockedStore = new MembershipStore({storage:blockedStorage},env);
  const blockedResponse = await blockedStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"qris"})
  }));
  const blockedData = await blockedResponse.json();
  assert.equal(blockedResponse.status,503);
  assert.equal(blockedData.code,"AIRPAY_MERCHANT_BLOCKED");
  assert.match(blockedData.error,/403/);
  const blockedAccount = await blockedStore.fetch(request("/api/membership/me"));
  assert.notEqual((await blockedAccount.json()).membership?.status,"active");

  // One remote HTTP 403 should pause ALL fresh checkout attempts on this
  // merchant Worker for two minutes, while leaving catalog and plan access.
  const blockedConfig = await (await blockedStore.fetch(request("/api/membership/payment-config"))).json();
  assert.equal(blockedConfig.merchantBlocked,true);
  assert.equal(blockedConfig.gatewayAuthorization,"merchant-blocked");
  assert.equal(blockedConfig.checkoutEnabled,false);
  const blockedCatalog = await (await blockedStore.fetch(request("/api/membership/catalog"))).json();
  assert.equal(blockedCatalog.paymentEnabled,false);
  const blockedCalls = createCalls;
  const blockedAgain = await blockedStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"pro",billingPeriod:"yearly",paymentMethod:"gopay"})
  }));
  assert.equal(blockedAgain.status,503);
  assert.equal((await blockedAgain.json()).code,"AIRPAY_MERCHANT_BLOCKED");
  assert.equal(createCalls,blockedCalls,"403 circuit breaker must prevent repeated remote invoice requests");

  // When AirPay restores the account and the short hold expires, the same
  // Worker must resume real checkout automatically without redeploying.
  rejectMerchant = false;
  const hold = await blockedStorage.get("airpay-merchant-block");
  assert.ok(hold.blockedUntil > Date.now());
  await blockedStorage.put("airpay-merchant-block",{...hold,blockedUntil:Date.now()-1});
  const recoveredFromBlock = await blockedStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"qris"})
  }));
  assert.equal(recoveredFromBlock.status,201,"Checkout should recover after block expires and merchant permission is restored");
  const recoveredConfig = await (await blockedStore.fetch(request("/api/membership/payment-config"))).json();
  assert.equal(recoveredConfig.merchantBlocked,false);
  assert.equal(recoveredConfig.checkoutEnabled,true);

  // A sandbox credential accidentally configured on the *production* Worker
  // must never be allowed to issue an invoice or activate paid privileges.
  const prodEnv={...env,ARYANZZ_PUBLIC_ORIGIN:"https://aryanzz-donwloader.aryanz.workers.dev"};
  const prodStore=new MembershipStore({storage:new MemoryStorage()},prodEnv);
  const prodConfig=await prodStore.fetch(request("/api/membership/payment-config"));
  const prodConfigData=await prodConfig.json();
  assert.equal(prodConfigData.checkoutEnabled,false);
  assert.equal(prodConfigData.sandboxBlocked,true);
  assert.equal(prodConfigData.mode,"sandbox-blocked");
  const prodBefore=createCalls;
  const prodInvoice=await prodStore.fetch(new Request("https://aryanzz.test/api/membership/orders",{
    method:"POST",headers:{...requestHeaders,"content-type":"application/json"},
    body:JSON.stringify({planId:"starter",billingPeriod:"monthly",paymentMethod:"qris"})
  }));
  assert.equal(prodInvoice.status,503);
  assert.equal((await prodInvoice.json()).code,"AIRPAY_SANDBOX_PRODUCTION_BLOCKED");
  assert.equal(createCalls,prodBefore,"Production must not contact AirPay with a sandbox credential");
  const prodMember=await prodStore.fetch(request("/api/membership/me"));
  assert.notEqual((await prodMember.json()).membership?.status,"active");

  console.log("MembershipStore AirPay smoke test passed.");
} finally {
  globalThis.fetch = originalFetch;
}
