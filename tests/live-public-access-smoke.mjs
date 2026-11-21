import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const version=String(process.env.EXPECTED_BUILD_VERSION||"");
assert.ok(version,"Public-access smoke test requires EXPECTED_BUILD_VERSION");

const response=await fetch(base+"/",{cache:"no-store",signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200,"Public homepage must return HTTP 200");
const html=await response.text();
assert.ok(html.includes('name="aryanzz-build-id" content="'+version+'"'),"Public homepage must serve the expected V2 build");
assert.ok(/<div id="aryAuthGate"[^>]*\shidden(?:\s|>)/.test(html),"Authentication overlay must be hidden by default in the public HTML");
assert.ok(html.includes('/auth-gate.js?v='+version),"The public page must load the current authentication gate asset");
assert.ok(html.includes('/guest-access.js?v='+version),"The public page must load the current automatic guest identity asset");

const [authResponse,guestResponse]=await Promise.all([
  fetch(base+"/auth-gate.js?v="+version,{cache:"no-store",signal:AbortSignal.timeout(15000)}),
  fetch(base+"/guest-access.js?v="+version,{cache:"no-store",signal:AbortSignal.timeout(15000)})
]);
assert.equal(authResponse.status,200,"Current auth-gate.js asset must be available");
assert.equal(guestResponse.status,200,"Current guest-access.js asset must be available");
const [auth,guest]=await Promise.all([authResponse.text(),guestResponse.text()]);
assert.ok(auth.includes("const ownerMode = false;"),"Retired Administrator authentication must remain disabled");
assert.ok(auth.includes('gate.hidden = true;gate.setAttribute("aria-hidden","true")')&&auth.includes('gate.hidden = !!user || (!ownerMode && !window.ARYANZZAccountOpen)'),"Public route must hide account dialog by default and show it only when explicitly requested");
assert.ok(auth.includes('function openAccount(initialMode="login")')&&auth.includes('window.ARYANZZAccount=Object.freeze({open:openAccount,close:closeAccount')&&auth.includes('$("aryAccountOpen")?.addEventListener("click",()=>openAccount("login"))'),"Optional account dialog must be accessible from Profile without forcing sign-in for public visitors");
assert.ok(guest.includes("/api/auth/guest/bootstrap")&&guest.includes("localFallback()"),"Public visitors must receive an automatic guest ID, with a local fallback if D1 is unavailable");
assert.ok(guest.includes('document.dispatchEvent(new CustomEvent("aryanzz:guest-ready"'),"Guest identity must announce readiness to the profile and app");

console.log("ARYANZZ public-access smoke test passed: account dialog hidden by default, optional login from Profile, and automatic guest identity loaded.");
