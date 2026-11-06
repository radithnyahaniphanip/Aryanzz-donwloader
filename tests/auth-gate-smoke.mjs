import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/auth-gate.js", import.meta.url), "utf8");
for (const id of ["aryRegPasswordConfirm","aryLoginIdentifier","aryAuthCaptcha","aryForgotPassword","aryRegisterVerifyForm","aryResetStartForm","aryResetVerifyForm","profileSummary"]) {
  assert.ok(html.includes('id="' + id + '"') || html.includes('id="' + id + '"'), "Missing auth/profile control: " + id);
}
assert.ok(client.includes("async function login") && client.includes("localLogin"), "Login must work in standalone mode");
assert.ok(client.includes("async function register") && client.includes("users.push(user)"), "Registration must work in standalone mode");
assert.ok(client.includes("aryResetRecoveryCode") || html.includes('id="aryResetRecoveryCode"'), "Password reset must use a Recovery Code");
assert.ok(client.includes("user.recoveryHash = \"\""), "Recovery Code must be one-time use");
assert.ok(client.includes("/api/auth/legacy/start"), "Legacy accounts need a verified migration path");
assert.ok(client.includes("password !== confirm"), "Registration and reset must compare confirmation password");
assert.ok(client.includes("identifier"), "Login must accept email or account ID");
assert.ok(client.includes("checkLocalCaptcha") && client.includes("refreshLocalCaptcha"), "Local human verification must be present on auth forms");
assert.ok(client.includes("aryanzz.local.accounts.v94"), "Old local accounts must be preserved for migration");
assert.ok(client.includes("localSession") && client.includes("sessionUser"), "Existing local sessions must be restored");
assert.ok(html.includes('id="aryLoginPasswordConfirm"') && html.includes('id="aryLoginCaptchaAnswer"'), "Login must include password confirmation and human verification");
assert.ok(html.includes('id="aryRegCaptchaAnswer"'), "Registration must include human verification");
assert.ok(client.includes('window.aryanzzIsDeveloper = isDeveloper'), "Developer UI state must use the existing protected account ID");
console.log("ARYANZZ V1 auth gate client checks passed.");
