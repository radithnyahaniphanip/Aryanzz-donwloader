import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../public/auth-gate.js",import.meta.url),"utf8");
for(const id of ["aryRegPasswordConfirm","aryLoginIdentifier","aryAuthCaptcha","aryForgotPassword","aryRegisterVerifyForm","aryResetStartForm","aryResetVerifyForm","profileSummary","aryAccountOpen","aryAccountStatus","accountLogout","aryAuthClose"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing account/profile control: "+id);
}
assert.ok(client.includes("async function login")&&client.includes("config.ready")&&client.includes("localLogin"),"Login must support server authentication and a clearly scoped local-browser fallback");
assert.ok(client.includes("async function register")&&client.includes("config.registrationReady")&&client.includes("/api/auth/register/start"),"Registration must use verified server email when configured and local CAPTCHA otherwise");
assert.ok(client.includes("const ownerMode = false;")&&!client.includes("if(!ownerMode){setUser(null);return;}"),"The retired administrator-only gate must not block public account access");
assert.ok(client.includes("function openAccount")&&client.includes("function closeAccount")&&client.includes("window.ARYANZZAccount"),"The public login dialog must open and close on demand");
assert.ok(client.includes('gate.hidden = !!user || (!ownerMode && !window.ARYANZZAccountOpen)'),"Guests must remain in public mode until they explicitly open the account dialog");
assert.ok(client.includes('node.hidden = needsServerCaptcha'),"Local CAPTCHA should be shown only when server CAPTCHA is unavailable");
assert.ok(client.includes("window.aryanzzAuthReady"),"Guest identity bootstrap must wait for account restoration");
assert.ok(client.includes("const saved=localSession()")&&client.includes("setUser(localUser,true)"),"Existing same-browser local accounts must be restored");
assert.ok(client.includes("accountUser=user?{...user,localOnly:!!localOnly}:null"),"The client must label local-only accounts so Membership does not treat them as server accounts");
assert.ok(client.includes('post("/api/auth/login"')&&client.includes('post("/api/auth/register/start"'),"Online login and registration must use the account API when configured");
assert.ok(client.includes('post("/api/auth/reset/device/start"')&&client.includes('post("/api/auth/reset/device/verify"'),"Online password reset must verify the previously registered device");
assert.ok(client.includes("currentDeviceHash")&&client.includes("deviceKeyHash"),"Password reset must match the registered browser device");
assert.ok(client.includes("/api/auth/legacy/start"),"Legacy accounts need a verified migration path");
assert.ok(client.includes("password !== confirm"),"Registration and reset must compare confirmation password");
assert.ok(client.includes("identifier"),"Login must accept email or account ID");
assert.ok(client.includes('get("/api/auth/config")'),"Auth client must detect server-backed account availability");
assert.ok(client.includes("checkLocalCaptcha")&&client.includes("refreshLocalCaptcha"),"Local-only account creation and login must retain human verification");
assert.ok(client.includes("aryanzz.local.accounts.v94"),"Old local accounts must be preserved for migration");
assert.ok(!client.includes('value = "login"; }'),"Unavailable email delivery must not silently redirect users away from the registration form");
assert.ok(!html.includes('id="aryLoginPasswordConfirm"')&&!html.includes('id="aryLoginConfirmEye"'),"Login must not ask users to confirm the password a second time");
assert.ok(client.includes("registrationReady")&&client.includes("missingRegistration"),"Registration readiness must remain separate from login readiness");
assert.ok(client.includes('window.aryanzzIsDeveloper = isDeveloper'),"Developer UI state must use the existing protected account ID");
assert.ok(html.includes('id="aryRegCaptchaAnswer"'),"Registration must include human verification");
assert.ok(!html.includes('id="aryRecoveryCodeDisplay"')&&!html.includes('id="aryResetRecoveryCode"'),"Recovery Code UI must remain absent");
console.log("ARYANZZ V2 optional public login/registration and local-account checks passed.");
