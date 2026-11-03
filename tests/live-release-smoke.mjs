import assert from "node:assert/strict";

const base = (process.env.WORKER_URL || "https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/, "");
let health;
let lastError;
for (let attempt = 0; attempt < 18; attempt++) {
  try {
    const response = await fetch(base + "/api/health", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.ok) health = await response.json();
    if (health?.version === "88.14") break;
    lastError = new Error("Worker still reports " + String(health?.version || "no version"));
  } catch (error) { lastError = error; }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
assert.equal(health?.version, "88.14", "Live Worker did not report V88.14: " + String(lastError?.message || ""));
assert.equal(health?.mode, "cloudflare-worker-zero-server-hybrid");
assert.equal(health?.securityActive, true);

const securityResponse = await fetch(base + "/api/security/status", { cache: "no-store", signal: AbortSignal.timeout(10000) });
assert.equal(securityResponse.status, 200);
const security = await securityResponse.json();
assert.equal(security?.security?.active, true);

const homeResponse = await fetch(base + "/", { cache: "no-store", signal: AbortSignal.timeout(10000) });
assert.equal(homeResponse.status, 200);
const html = await homeResponse.text();
assert.ok(html.includes("V88.14 · GRATIS"));
assert.ok(html.includes("/v674.js?v=88.14"));
assert.ok(html.includes("v8814-unified-app-shell"));
assert.ok(html.includes('id="securityCenter"'));

for (const path of ["/v674.js?v=88.14", "/v674.css?v=85.5.0", "/sw.js"]) {
  const response = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, "Missing live asset " + path);
}
console.log("✔ Cloudflare Worker health: V88.14");
console.log("✔ Security middleware and status endpoint are active");
console.log("✔ V88.14 homepage, unified navigation and versioned assets are live");
