import assert from "node:assert/strict";

const base=(process.env.WORKER_URL||"https://aryanzz-donwloader.aryanz.workers.dev").replace(/\/$/,"");
const version=String(process.env.EXPECTED_BUILD_VERSION||"");
assert.ok(version,"Public-access smoke test requires EXPECTED_BUILD_VERSION");

const response=await fetch(base+"/",{cache:"no-store",signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200,"Public homepage must return HTTP 200");
const html=await response.text();
assert.ok(html.includes('name="aryanzz-build-id" content="'+version+'"'),"Public homepage must serve the expected V1 build");
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
assert.ok(auth.includes("if (!ownerMode && gate)")&&auth.includes('gate.style.setProperty("display", "none", "important")'),"Public route must immediately hide the login/register overlay");
assert.ok(auth.includes('if(!ownerMode){setUser(null);return;}'),"Public visitors must bypass the administrator login initialization");
assert.ok(guest.includes("/api/auth/guest/bootstrap")&&guest.includes("localFallback()"),"Public visitors must receive an automatic guest ID, with a local fallback if D1 is unavailable");
assert.ok(guest.includes('document.dispatchEvent(new CustomEvent("aryanzz:guest-ready"'),"Guest identity must announce readiness to the profile and app");

console.log("ARYANZZ public-access smoke test passed: no login/register overlay or Administrator route; automatic guest identity is loaded.");
