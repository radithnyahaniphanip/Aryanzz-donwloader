import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/auth-gate.js", import.meta.url), "utf8");
for (const id of ["aryRegPasswordConfirm","aryLoginIdentifier","aryAuthCaptcha","aryForgotPassword","aryRegisterVerifyForm","aryResetStartForm","aryResetVerifyForm","profileSummary"]) {
  assert.ok(html.includes('id="' + id + '"') || html.includes('id="' + id + '"'), "Missing auth/profile control: " + id);
}
assert.ok(client.includes("async function login") && client.includes("config.ready") && client.includes("Login online belum aktif"), "Login must require the protected server authentication service");
assert.ok(client.includes("async function register") && client.includes("Pendaftaran sementara ditutup") && client.includes("registrationReady") && client.includes("/api/auth/register/start"), "Registration must require server authentication and verified email delivery");
assert.ok(client.includes('get("owner") === "1"') && client.includes("if(!ownerMode){setUser(null);return;}") && client.includes("registerTab.hidden = true") && client.includes("gate.hidden = !ownerMode || !!user"), "Public visitors must bypass the auth gate while the separate owner route retains admin login only");
assert.ok(!client.includes('value = "login"; }'), "Unavailable email delivery must not silently redirect users away from the registration form");
assert.ok(html.includes('id="aryResetProgressFill"') && html.includes('id="aryResetPasswordStage"'), "Password reset must show device-check progress and new-password stage");
assert.ok(client.includes("currentDeviceHash") && client.includes("deviceKeyHash"), "Password reset must match the registered browser device");
assert.ok(client.includes("/api/auth/legacy/start"), "Legacy accounts need a verified migration path");
assert.ok(client.includes("password !== confirm"), "Registration and reset must compare confirmation password");
assert.ok(client.includes("identifier"), "Login must accept email or account ID");
assert.ok(client.includes('get("/api/auth/config")'), "Auth client must detect server-backed account availability");
assert.ok(client.includes('post("/api/auth/login"') && client.includes('post("/api/auth/register/start"'), "Online login and registration must use the account API");
assert.ok(client.includes('post("/api/auth/reset/device/start"') && client.includes('post("/api/auth/reset/device/verify"'), "Online password reset must verify the previously registered device");
assert.ok(html.includes('id="profileAccountEmail"') && html.includes('id="profileAccountNote"'), "Profile must display the registered email and account storage mode");
assert.ok(client.includes("checkLocalCaptcha") && client.includes("refreshLocalCaptcha"), "Local human verification must be present on auth forms");
assert.ok(client.includes("aryanzz.local.accounts.v94"), "Old local accounts must be preserved for migration");
assert.ok(client.includes("aryanzz.local.accounts.v94") && client.includes("Login lokal dinonaktifkan") && !client.includes("const sessionUser = session && Array.isArray(users)"), "Legacy account data must be preserved for migration but insecure local sessions must not restore");
assert.ok(!html.includes('id="aryLoginPasswordConfirm"') && !html.includes('id="aryLoginConfirmEye"'), "Login must not ask users to confirm the password a second time");
assert.ok(client.includes("registrationReady") && client.includes("missingRegistration"), "Registration readiness and email-delivery requirements must be separate from login readiness");
assert.ok(client.includes("missingLogin.join") && client.includes("Akses administrator siap"), "The admin-only login UI must show missing security configuration without requiring email-provider settings");
assert.ok(client.includes("node.hidden = true"), "Local arithmetic CAPTCHA must not be presented as a substitute for server CAPTCHA");
assert.ok(html.includes('id="aryRegCaptchaAnswer"'), "Registration must include human verification");
assert.ok(!html.includes('id="aryRecoveryCodeDisplay"') && !html.includes('id="aryResetRecoveryCode"'), "Recovery Code UI must be removed");
assert.ok(client.includes('window.aryanzzIsDeveloper = isDeveloper'), "Developer UI state must use the existing protected account ID");
console.log("ARYANZZ V1 auth gate client checks passed.");

assert.ok(client.includes("resetUsesLocalAccount"), "Legacy local accounts must be eligible for same-device password reset when the server has no migrated account");
assert.ok(client.includes('["DEVICE_NOT_RECOGNIZED","ACCOUNT_NOT_FOUND"].includes(serverError.code)'), "Reset must fall back only for unmigrated local accounts, not arbitrary server errors");
