import assert from "node:assert/strict";

const base = (process.env.WORKER_URL || "https://aryanzz-donwloader.radithnyahaniphanip.workers.dev").replace(/\/$/, "");
let health;
let lastError;
for (let attempt = 0; attempt < 18; attempt++) {
  try {
    const response = await fetch(base + "/api/health", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.ok) health = await response.json();
    if (health?.version === "90.4") break;
    lastError = new Error("Worker still reports " + String(health?.version || "no version"));
  } catch (error) { lastError = error; }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
assert.equal(health?.version, "90.4", "Live Worker did not report V90.4: " + String(lastError?.message || ""));
assert.equal(health?.mode, "cloudflare-worker-zero-server-hybrid");
assert.equal(health?.securityActive, true);

const securityResponse = await fetch(base + "/api/security/status", { cache: "no-store", signal: AbortSignal.timeout(10000) });
assert.equal(securityResponse.status, 200);
const security = await securityResponse.json();
assert.equal(security?.security?.active, true);

const homeResponse = await fetch(base + "/", { cache: "no-store", signal: AbortSignal.timeout(10000) });
assert.equal(homeResponse.status, 200);
const html = await homeResponse.text();
assert.ok(html.includes("V90.4 · GRATIS"));
assert.ok(html.includes("/v674.js?v=89.2"));
assert.ok(html.includes("/v89.css?v=90.0"));
assert.ok(html.includes("/audio-studio.js?v=90.4"));
assert.ok(html.includes('id="audioStudioPreviewNote"'));
assert.ok(html.includes('id="audioStudioPreviewConvert"'));
assert.ok(html.includes('id="v89Welcome"'));
assert.ok(html.includes("Semua berawal"));
assert.ok(html.includes("dari satu tautan"));
assert.ok(html.includes('id="securityCenter"'));
assert.ok(!html.includes('class="audio-studio-disclaimer"'));

for (const path of ["/v89.css?v=90.0", "/v674.js?v=89.2", "/v674.css?v=85.5.0", "/audio-studio.js?v=90.4", "/audio-studio.css?v=90.4", "/ffmpeg-worker-local.js?v=90.4", "/sw.js?v=90.4"]) {
  const response = await fetch(base + path, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, "Missing live asset " + path);
}
console.log("✔ Cloudflare Worker health: V90.4");
console.log("✔ Security middleware and release endpoints are active");
console.log("✔ V90.4 homepage, FFmpeg worker, H.264 preview and converter assets are live");
