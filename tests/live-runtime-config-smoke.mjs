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
assert.ok(!(auth.missingLogin||[]).some(x=>String(x).includes("AUTH_DB")),"Production Worker must retain the AUTH_DB binding after deployment");
assert.ok(!(auth.missing||[]).some(x=>String(x).includes("TURNSTILE_SECRET_KEY")),"Production Worker must retain the Turnstile verification secret after deployment");

const payment=await read("/api/membership/payment-config");
assert.equal(payment.dbReady,true,"Membership must retain the D1 database binding");
assert.equal(payment.apiKeyReady,true,"Poketo API key must remain configured after deployment");
assert.equal(payment.webhookReady,true,"Poketo webhook signing secret must remain configured after deployment");
assert.equal(payment.mode,"sandbox","Release smoke tests must never require live payments");
assert.equal(payment.webhookUrl,base+"/api/membership/webhook","Poketo webhook URL must follow the new ARYANZZ hostname");

console.log("ARYANZZ production runtime bindings verified: AUTH_DB, Turnstile and Poketo Sandbox.");
