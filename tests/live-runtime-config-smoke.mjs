import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
async function read(path){
  const response=await fetch(base+path,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15000),cache:"no-store"});
  assert.equal(response.status,200,path+" must return HTTP 200");
  const body=await response.json();
  assert.equal(body.ok,true,path+" must return ok=true");
  return body;
}
const auth=await read("/api/auth/config");
assert.ok(auth.captchaSiteKey,"Cloudflare Turnstile site key must be available to the browser");
assert.equal(auth.loginReady,true,"Production Worker must have an active online account database after deployment");
assert.ok(!(auth.missingLogin||[]).some(x=>String(x).includes("Turso database")),"Production Worker must retain its configured external account database after deployment");
assert.ok(!(auth.missing||[]).some(x=>String(x).includes("TURNSTILE_SECRET_KEY")),"Production Worker must retain the Turnstile verification secret after deployment");

const payment=await read("/api/membership/payment-config");
assert.equal(payment.provider,"AirPay QRIS","Membership checkout must use AirPay QRIS");
assert.equal(payment.webhookAvailable,true,"Signed AirPay webhook route must be available");
assert.equal(payment.statusVerification,"webhook-and-server-side-polling","Paid status must be verified by webhook and server-side status polling");
assert.equal(typeof payment.apiKeyReady,"boolean","AirPay API key readiness must be reported without exposing the secret");
assert.equal(typeof payment.authReady,"boolean","ARYANZZ identity database readiness must be reported");
assert.equal(typeof payment.identityReady,"boolean","The current browser identity must be reported");
assert.equal(typeof payment.checkoutEnabled,"boolean","Checkout readiness must be explicit");
assert.equal(payment.identityReady,false,"Unauthenticated deployment smoke requests must not claim a device membership session");
assert.equal(payment.checkoutEnabled,false,"An unauthenticated deployment smoke request must not receive checkout access");
assert.ok(["sandbox","live","not-configured"].includes(payment.mode),"AirPay mode must be explicit");
assert.equal(payment.webhookUrl,base+"/api/membership/webhook","AirPay webhook URL must follow the deployed ARYANZZ hostname");
if(!payment.apiKeyReady)assert.ok(payment.missing.some(item=>String(item).includes("AIRPAY_API_KEY")),"A missing AirPay key must be clearly reported as a deployment prerequisite");

console.log("ARYANZZ production runtime bindings verified: online account database, Turnstile, AirPay QRIS, signed webhook, and device-bound membership.");
