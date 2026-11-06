import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/auth-gate.js", import.meta.url), "utf8");
for (const id of ["aryRegPasswordConfirm","aryLoginIdentifier","aryAuthCaptcha","aryForgotPassword","aryRegisterVerifyForm","aryResetStartForm","aryResetVerifyForm","profileSummary"]) {
  assert.ok(html.includes('id="' + id + '"') || html.includes('id="' + id + '"'), "Missing auth/profile control: " + id);
}
assert.ok(client.includes("/api/auth/login"));
assert.ok(client.includes("/api/auth/register/start"));
assert.ok(client.includes("/api/auth/reset/start"));
assert.ok(client.includes("/api/auth/reset/verify"));
assert.ok(client.includes("/api/auth/legacy/start"), "Legacy accounts need a verified migration path");
assert.ok(client.includes("password !== confirm"), "Registration and reset must compare confirmation password");
assert.ok(client.includes("identifier"), "Login must accept email or account ID");
assert.ok(client.includes("challenges.cloudflare.com/turnstile"), "CAPTCHA widget must be loaded");
assert.ok(client.includes("aryanzz.local.accounts.v94"), "Old local accounts must be preserved for migration");
assert.ok(client.includes("activeLegacy"), "An active local session can migrate without re-entering the old password");
assert.ok(client.includes("window.turnstile.reset"), "CAPTCHA must be reset after use");
assert.ok(client.includes('window.aryanzzIsDeveloper = isDeveloper'), "Developer UI state must use the existing protected account ID");
console.log("ARYANZZ V1 auth gate client checks passed.");
