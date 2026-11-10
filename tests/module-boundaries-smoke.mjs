import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("public/workspace-manifest.json", root), "utf8"));
const html = fs.readFileSync(new URL("public/index.html", root), "utf8");
const authCss = fs.readFileSync(new URL("public/auth-gate.css", root), "utf8");
const authJs = fs.readFileSync(new URL("public/auth-gate.js", root), "utf8");
const profileJs = fs.readFileSync(new URL("public/v25.js", root), "utf8");
const ownerJs = fs.readFileSync(new URL("public/owner.js", root), "utf8");
const navigationJs = fs.readFileSync(new URL("public/workspace-navigation.js", root), "utf8");

for (const key of ["home","tools","library","owner","profile","navigation","auth","security"]) {
  assert.ok(manifest.workspaces[key]?.root, "Missing module ownership: " + key);
}
assert.ok(manifest.workspaces.auth.css.includes("/auth-gate.css"));
assert.ok(manifest.workspaces.auth.js.includes("/auth-gate.js"));
assert.ok(manifest.workspaces.security.js.includes("src/auth.js"));
assert.ok(html.includes('src="/auth-gate.js?v=__ARYANZZ_VERSION__"'));
assert.ok(!profileJs.includes("aryAuthGate") && !ownerJs.includes("aryAuthGate"), "Profile and Owner must not own or mutate Auth UI");
assert.ok(!navigationJs.includes("localStorage.setItem(SESSION_KEY") && !navigationJs.includes("aryanzz.local.session"), "Navigation must not create or rewrite account sessions");
assert.ok(!authJs.includes("const sessionUser = session && Array.isArray(users)"), "Auth must not restore bypassable browser-only login sessions");
assert.ok(authCss.includes(".ary-auth-gate") && !/(^|[},])\s*(body|html|\.panel|input|button)\s*\{/m.test(authCss), "Auth CSS must remain scoped to Auth components");
assert.ok(manifest.architectureGuard?.requiredChecks?.includes("module-boundaries-smoke"));
const scamModule = manifest.featureModules.find(item => item.root === "#v1LightTools");
assert.ok(scamModule?.js?.includes("/stage1-scam-evidence.js") && scamModule?.css?.includes("/stage1-scam-evidence.css"), "Scam Evidence must remain owned by the modular Tools workspace");
const scamSource = fs.readFileSync(new URL("public/stage1-scam-evidence.js", root), "utf8");
assert.ok(!scamSource.includes("navigator.geolocation") && !/\\bfetch\\s*\\(/.test(scamSource), "Scam Evidence must not track a person or upload private evidence automatically");
console.log("ARYANZZ V1 module-boundary and feature-isolation checks passed.");
