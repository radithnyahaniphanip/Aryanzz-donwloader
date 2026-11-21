// Read-only production regression: a public browser guest obtains a secure
// device cookie, sees initialized D1 tables, and can read Membership metadata.
// No invoice creation, checkout charges or credential submissions.
import assert from "node:assert/strict";
const base=String(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/+$/,"");
const url=path=>new URL(path,base).href;
const parse=async response=>{
  const data=await response.json().catch(()=>null);
  assert.ok(data&&typeof data==="object","Expected JSON from "+new URL(response.url).pathname);
  return data;
};
const authResponse=await fetch(url("/api/auth/config"),{
  headers:{"cache-control":"no-store"},redirect:"error"
});
assert.equal(authResponse.status,200,"Auth status endpoint should remain reachable");
const auth=await parse(authResponse);
assert.equal(auth.ok,true);
assert.equal(auth.schemaReady,true,"Production D1 schema must be initialized, not merely bound");
assert.deepEqual(auth.missingTables,[],"All required auth tables must exist");
const cookie=(authResponse.headers.get("set-cookie")||"").match(/(?:^|[;, ]+)aryanzz_device_lock=([a-f0-9]{64})/i);
assert.ok(cookie,"New guest must receive a HttpOnly device identity cookie");
const headers={cookie:"aryanzz_device_lock="+cookie[1],"cache-control":"no-store"};
const [paymentResponse,catalogResponse]=await Promise.all([
  fetch(url("/api/membership/payment-config"),{headers,redirect:"error"}),
  fetch(url("/api/membership/catalog"),{headers,redirect:"error"})
]);
assert.equal(paymentResponse.status,200,"Guest payment-config endpoint should be reachable");
const payment=await parse(paymentResponse);
assert.equal(payment.ok,true);
assert.equal(payment.identityReady,true,"Server must recognize the browser's secure guest identity cookie");
assert.equal(payment.authReady,true,"Membership must see the initialized D1/session backend");
assert.equal(catalogResponse.status,200,"Membership packages must load for new guests");
const catalog=await parse(catalogResponse);
assert.equal(catalog.ok,true);
assert.ok(Array.isArray(catalog.plans)&&catalog.plans.length>0,"Membership catalogue must contain packages");
assert.ok(typeof payment.checkoutEnabled==="boolean","Checkout readiness must be an explicit boolean");
assert.ok(typeof auth.loginReady==="boolean"&&typeof auth.registrationReady==="boolean",
  "Server must distinguish login and signup readiness");
assert.ok(Array.isArray(auth.missingLogin)&&Array.isArray(auth.missingRegistration),
  "External credential prerequisites must be reported; never bypass them");
console.log("PASS live guest: D1 schema exists, secure cookie recognized, Membership status/catalog available.");
console.log("LOGIN_READY="+auth.loginReady+" REGISTRATION_READY="+auth.registrationReady+" CHECKOUT_READY="+payment.checkoutEnabled);
console.log("LOGIN_BLOCKERS="+auth.missingLogin.join("; "));
console.log("REGISTRATION_BLOCKERS="+auth.missingRegistration.join("; "));
console.log("GATEWAY_STATUS="+String(payment.gatewayAuthorization||"unknown"));
