import assert from "node:assert/strict";
const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const [meResponse,configResponse]=await Promise.all([
 fetch(base+"/api/membership/me",{cache:"no-store",signal:AbortSignal.timeout(15000)}),
 fetch(base+"/api/membership/payment-config",{cache:"no-store",signal:AbortSignal.timeout(15000)})
]);
assert.equal(meResponse.status,200,"Anonymous Membership must load without login or D1");
const me=await meResponse.json();
assert.equal(me.ok,true,"Membership session endpoint must return a valid response");
assert.equal(me.user?.role,"guest","Membership must use a guest session without registration");
assert.match(meResponse.headers.get("set-cookie")||"",/aryanzz_member=/,"Membership must issue a persistent secure guest cookie");
assert.equal(configResponse.status,200,"Membership payment configuration endpoint must be available");
const config=await configResponse.json();
assert.equal(config.storageReady,true,"Durable Object Membership storage must be active without D1");
assert.equal(config.checkoutEnabled,true,"Checkout must not be blocked by missing D1");
assert.equal(config.provider,"Poketo","Configured payment provider must be reported");
assert.equal(config.apiKeyReady,true,"POKETO_SECRET_KEY must be configured as a Worker secret");
assert.equal(config.webhookReady,true,"POKETO_WEBHOOK_SECRET must be configured as a Worker secret");
console.log("Live Membership storage check passed: anonymous guest session and D1-independent persistent checkout are ready.");
