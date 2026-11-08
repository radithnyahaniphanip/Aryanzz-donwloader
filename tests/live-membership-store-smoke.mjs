import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const key=String(process.env.POKETO_SECRET_KEY||"");
const timeout=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const [meResponse,configResponse]=await Promise.all([
 fetch(base+"/api/membership/me",{cache:"no-store",signal:AbortSignal.timeout(15000)}),
 fetch(base+"/api/membership/payment-config",{cache:"no-store",signal:AbortSignal.timeout(15000)})
]);
assert.equal(meResponse.status,200,"Anonymous Membership must load without login or D1");
const me=await meResponse.json();
assert.equal(me.ok,true,"Membership session endpoint must return a valid response");
assert.equal(me.user?.role,"guest","Membership must use a guest session without registration");
const cookie=(meResponse.headers.get("set-cookie")||"").split(";")[0];
assert.match(cookie,/^aryanzz_member=/,"Membership must issue a persistent guest cookie");
assert.equal(configResponse.status,200,"Membership payment configuration endpoint must be available");
const config=await configResponse.json();
assert.equal(config.storageReady,true,"Durable Object Membership storage must be active without D1");
assert.equal(config.dbReady,false,"Membership checkout must not depend on D1");
assert.equal(config.checkoutEnabled,!!(config.apiKeyReady&&config.webhookReady),"Checkout readiness must require both gateway API and webhook secrets");
console.log("Live Membership storage check passed: guest session and D1-independent storage are available.");

if(key.startsWith("sk_test_")){
 assert.equal(config.apiKeyReady,true,"Sandbox API key must be configured on the Worker");
 assert.equal(config.webhookReady,true,"Sandbox webhook signing secret must be configured on the Worker");
 const orderResponse=await fetch(base+"/api/membership/orders",{method:"POST",headers:{cookie,"content-type":"application/json"},body:JSON.stringify({planId:"starter"}),signal:AbortSignal.timeout(20000)});
 const order=await orderResponse.json();
 assert.equal(orderResponse.status,201,"Sandbox guest checkout must create an invoice without login, name or email");
 assert.equal(order.ok,true);
 assert.ok(order.payment?.invoiceId,"Poketo must return an invoice ID");
 const simulateResponse=await fetch("https://poketo.id/api/v1/invoices/"+encodeURIComponent(order.payment.invoiceId)+"/simulate",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({result:"paid",paymentMethod:"QRIS"}),signal:AbortSignal.timeout(20000)});
 const simulated=await simulateResponse.json();
 assert.equal(simulateResponse.ok,true,"Poketo sandbox must accept a QRIS paid simulation: "+JSON.stringify(simulated.error||simulated));
 let activated=null;
 for(let attempt=0;attempt<15;attempt++){
  await timeout(2000);
  const statusResponse=await fetch(base+"/api/membership/me",{headers:{cookie},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const state=await statusResponse.json();
  if(state.membership?.status==="active"&&state.orders?.some(x=>x.id===order.order.id&&x.status==="paid")){activated=state;break}
 }
 assert.ok(activated,"Membership must become active from the verified Poketo webhook after sandbox QRIS payment");
 console.log("End-to-end Poketo sandbox passed: invoice created, QRIS payment simulated, signed webhook received, Membership activated.");
}else{
 console.log("Sandbox transaction simulation skipped: provide POKETO_SECRET_KEY as a GitHub Actions sandbox secret to run the end-to-end payment test. No live charge was attempted.");
}
