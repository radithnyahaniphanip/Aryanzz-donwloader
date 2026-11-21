import assert from "node:assert/strict";
import fs from "node:fs";
import { handleAuthRequest } from "../src/auth.js";

const backend=fs.readFileSync(new URL("../src/auth.js",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../migrations/0001_auth.sql",import.meta.url),"utf8");
const deviceMigration=fs.readFileSync(new URL("../migrations/0002_trusted_devices.sql",import.meta.url),"utf8");
const moderationMigration=fs.readFileSync(new URL("../migrations/0003_account_moderation.sql",import.meta.url),"utf8");
assert.ok(backend.includes("api.resend.com/emails"),"Email codes must be sent by the configured provider");
assert.ok(backend.includes("turnstile/v0/siteverify"),"CAPTCHA must be verified server-side");
assert.ok(backend.includes("PBKDF2"),"Passwords must be hashed");
assert.ok(backend.includes("HttpOnly; Secure; SameSite=Lax"),"Sessions must use secure HttpOnly cookies");
assert.ok(backend.includes("Number(row.attempts) >= 5"),"OTP attempts must be bounded");
for(const table of ["auth_users","auth_verifications","auth_sessions"])assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS "+table));
assert.ok(backend.includes("auth_trusted_devices")&&deviceMigration.includes("CREATE TABLE IF NOT EXISTS auth_trusted_devices"),"Trusted devices must be stored server-side");
assert.ok(backend.includes("startDeviceReset")&&backend.includes("verifyDeviceReset"),"Password reset must use a trusted-device flow without email OTP");
assert.ok(backend.includes("rememberTrustedDevice")&&backend.includes("deviceHash"),"Registration and login must register the current device");
assert.ok(backend.includes("auth_user_bans")&&backend.includes("auth_banned_devices")&&moderationMigration.includes("CREATE TABLE IF NOT EXISTS auth_user_bans")&&moderationMigration.includes("CREATE TABLE IF NOT EXISTS auth_banned_devices"),"Permanent account and device bans must be stored server-side");
assert.ok(backend.includes("DEVICE_BANNED")&&backend.includes("ACCOUNT_BANNED"),"Banned users and their known devices must be denied");
assert.ok(backend.includes("/api/auth/admin/ban")&&backend.includes("adminModerate"),"Only authenticated owner/admin sessions can moderate accounts");
assert.ok(backend.includes("WHERE email=?1 COLLATE NOCASE OR id=?2 COLLATE NOCASE"),"Online login must accept email or account ID");
assert.ok(!backend.includes("PUBLIC_LOGIN_DISABLED")&&!backend.includes("adminAllowed=user.id"),"Regular verified accounts must be allowed to log in; admin privileges remain separately protected");
assert.ok(backend.includes("AUTH_PUBLIC_ACCOUNTS_ENABLED")&&backend.includes("registrationAllowed"),"Public registration must have an explicit server-side kill switch");

const missingConfig=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"),{});
assert.equal(missingConfig.status,200);
const missingBody=await missingConfig.json();
assert.equal(missingBody.ready,false,"Auth must fail closed until service configuration exists");
assert.ok(missingBody.missing.includes("Cloudflare D1 (AUTH_DB)"),"Config should report a missing D1 binding without exposing secrets");
assert.equal(missingBody.registrationReady,false);
const unavailable=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/register/start",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email:"person@gmail.com",password:"StrongPassword!123",passwordConfirm:"StrongPassword!123"})
}),{});
assert.equal(unavailable.status,503);
assert.equal((await unavailable.json()).code,"AUTH_NOT_CONFIGURED");

const readyEnv={
  AUTH_DB:{prepare(){return {}}},
  AUTH_SESSION_SECRET:"s".repeat(40),
  TURNSTILE_SECRET_KEY:"turnstile-secret",
  AUTH_TURNSTILE_SITE_KEY:"turnstile-site"
};
const loginReady=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"),readyEnv);
const loginBody=await loginReady.json();
assert.equal(loginBody.loginReady,true,"D1, session secret and Turnstile should enable server login");
assert.equal(loginBody.registrationReady,false,"Online registration must wait for the email sender");
assert.equal(loginBody.registrationEnabled,false);
assert.equal(loginBody.publicAccess,true);
assert.ok(loginBody.missingRegistration.includes("RESEND_API_KEY")&&loginBody.missingRegistration.includes("AUTH_EMAIL_FROM"));

const fullReady=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"),{
  ...readyEnv,RESEND_API_KEY:"resend-secret",AUTH_EMAIL_FROM:"ARYANZZ <auth@example.com>"
});
const fullBody=await fullReady.json();
assert.equal(fullBody.loginReady,true);
assert.equal(fullBody.registrationReady,true,"Adding Resend and a sender address should enable verified public registration");
assert.equal(fullBody.registrationEnabled,true);
assert.deepEqual(fullBody.missingRegistration,[]);

const disabledRegistration=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"),{
  ...readyEnv,RESEND_API_KEY:"resend-secret",AUTH_EMAIL_FROM:"ARYANZZ <auth@example.com>",AUTH_PUBLIC_ACCOUNTS_ENABLED:"false"
});
assert.equal((await disabledRegistration.json()).registrationReady,false,"The public registration kill switch must be respected");

const aliasReady=await handleAuthRequest(new Request("https://aryanzz.example/api/auth/config"),{
  AUTH_DB:{prepare(){return {}}},AUTH_SESSION_SECRET:"s".repeat(40),
  CF_TURNSTILE_SECRET_KEY:"turnstile-secret-alias",TURNSTILE_SITE_KEY:"turnstile-site-alias",
  RESEND_API_KEY:"resend-secret",AUTH_EMAIL_FROM:"ARYANZZ <auth@example.com>"
});
const aliasBody=await aliasReady.json();
assert.equal(aliasBody.loginReady,true);
assert.equal(aliasBody.registrationReady,true);
assert.equal(aliasBody.captchaSiteKey,"turnstile-site-alias");
assert.ok(!aliasBody.missingLogin.some(item=>item.includes("TURNSTILE")));

assert.ok(backend.includes("auth_device_accounts"),"Server registration must use a persistent primary-device registry");
assert.ok(backend.includes("primaryDeviceOwner(deviceHash, env)"),"Registration/login must check the existing primary account on this browser installation");
assert.ok(backend.includes("previouslyTrusted.user_id !== user.id"),"Legacy trusted-device ownership must be preserved when upgrading to the primary-device registry");
assert.ok(backend.includes("Dilarang membuat akun baru di perangkat ini"),"Duplicate-account block must explain that the primary account should be used");
assert.ok(backend.includes("moderationGate")&&backend.includes("DEVICE_BANNED"),"Banned device must be rejected by the Worker before serving routes");
assert.ok(backend.includes("auth_moderation_events")&&backend.includes("restored:true"),"Ban and restoration actions must be audited");
assert.ok(backend.includes("auth_device_lock_accounts")&&backend.includes("rememberDeviceLock"),"Device lock identity must be linked to anonymous guest IDs");
assert.ok(fs.readFileSync(new URL("../migrations/0008_device_lock_accounts.sql",import.meta.url),"utf8").includes("lock_hash TEXT PRIMARY KEY"));
assert.ok(backend.includes("aryanzz_device_lock")&&backend.includes("HttpOnly; Secure; SameSite=Lax"));
assert.ok(backend.includes("MODERATION_NOT_CONFIGURED"));
assert.ok(backend.includes("async function guestBootstrap")&&backend.includes("/api/auth/guest/bootstrap"));

const workflow=fs.readFileSync(new URL("../.github/workflows/deploy-cloudflare.yml",import.meta.url),"utf8");
assert.match(workflow,/Provision persistent AUTH_SESSION_SECRET when absent/,
  "CI must offer secure server-side session key provisioning");
assert.match(workflow,/wrangler secret list --format json/,
  "CI must check Cloudflare for a previously created session key");
assert.match(workflow,/select\(\.name == "AUTH_SESSION_SECRET"\)/,
  "CI must never rotate existing session keys on ordinary releases");
assert.match(workflow,/randomBytes\(32\)\.toString\("hex"\)/,
  "CI must use a cryptographic random generator rather than a hard-coded secret");
assert.match(workflow,/wrangler secret put AUTH_SESSION_SECRET/,
  "CI must put the freshly generated key directly in Cloudflare");
assert.ok(workflow.includes("Recover missing Turnstile secret through Cloudflare API"),
  "Deployment must be able to provision Turnstile server validation");
assert.ok(workflow.includes("/challenges/widgets/$SITEKEY/rotate_secret"),
  "Turnstile secret must be rotated through Cloudflare's official API");
assert.ok(workflow.includes('"invalidate_immediately":true'),
  "The exposed old Turnstile secret must be invalidated after rotation");
assert.ok(workflow.includes("wrangler secret put TURNSTILE_SECRET_KEY"),
  "The replacement secret must be stored in Cloudflare, not committed");
assert.ok(workflow.includes('select(.name == "TURNSTILE_SECRET_KEY")'),
  "Routine deployments should preserve the installed Turnstile secret");
console.log("ARYANZZ V2 public account backend, email verification and fail-closed security checks passed.");
